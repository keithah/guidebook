import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import alertFixture from '../../test/fixtures/511-alerts.json';
import { useTransitAlerts } from '../useTransitAlerts.js';
import { resetRequestCoordinatorForTests } from '../../lib/requestCoordinator.js';
import { providerResponseStore } from '../../lib/responseStore.js';

const startTime = Date.parse('2026-07-28T19:00:00.000Z');
const originalFetch = globalThis.fetch;

function alertResponse() {
  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(JSON.stringify(alertFixture)),
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function waitForHook(assertion) {
  await vi.waitFor(assertion, { timeout: 2_000, interval: 5 });
}

describe('useTransitAlerts', () => {
  beforeEach(async () => {
    resetRequestCoordinatorForTests();
    await providerResponseStore.clear();
    vi.useFakeTimers();
    vi.setSystemTime(startTime);
    vi.stubEnv('VITE_API_511_KEY', 'test-key-not-a-credential');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('shares a ten-minute alert cache and exposes refresh metadata', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(alertResponse());
    const first = renderHook(() => useTransitAlerts('SF'));
    await waitForHook(() =>
      expect(first.result.current.alerts).toHaveLength(2),
    );
    expect(first.result.current).toMatchObject({
      status: 'live',
      error: null,
    });
    expect(first.result.current.updatedAt).toBeGreaterThanOrEqual(startTime);
    expect(first.result.current.refresh).toEqual(expect.any(Function));

    const second = renderHook(() => useTransitAlerts('SF'));
    await waitForHook(() =>
      expect(second.result.current.status).toBe('cached'),
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });
    await waitForHook(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));

    first.unmount();
    second.unmount();
  });

  it('manual refresh applies fresh data and resets the scheduled poll', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(alertResponse());
    const hook = renderHook(() => useTransitAlerts('SF'));
    await waitForHook(() => expect(hook.result.current.status).toBe('live'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9 * 60_000);
    });
    vi.spyOn(providerResponseStore, 'get').mockResolvedValueOnce(undefined);
    vi.spyOn(providerResponseStore, 'put').mockResolvedValueOnce(undefined);
    let refresh;
    act(() => {
      refresh = hook.result.current.refresh();
    });
    await refresh;
    await waitForHook(() => expect(hook.result.current.status).toBe('live'));
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(hook.result.current.status).toBe('live');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(hook.result.current.status).toBe('live');
    hook.unmount();
  });

  it('settles an in-flight manual refresh without applying it after unmount', async () => {
    const pendingRefresh = deferred();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(alertResponse())
      .mockReturnValueOnce(pendingRefresh.promise);
    const hook = renderHook(() => useTransitAlerts('SF'));
    await waitForHook(() => expect(hook.result.current.status).toBe('live'));
    vi.spyOn(providerResponseStore, 'get').mockResolvedValueOnce(undefined);

    let refresh;
    act(() => {
      refresh = hook.result.current.refresh();
    });
    await waitForHook(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    hook.unmount();

    await expect(refresh).resolves.toMatchObject({ ok: false });
    pendingRefresh.resolve(alertResponse());
  });

  it('keeps failed alert refreshes stale for at most 60 minutes', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(alertResponse())
      .mockRejectedValue(new TypeError('offline'));
    const hook = renderHook(() => useTransitAlerts('SF'));
    await waitForHook(() => expect(hook.result.current.status).toBe('live'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });
    await waitForHook(() => expect(hook.result.current.status).toBe('stale'));
    expect(hook.result.current.alerts).toHaveLength(2);
    expect(hook.result.current.error).toBe('network');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50 * 60_000);
    });
    await waitForHook(() =>
      expect(hook.result.current.status).toBe('unavailable'),
    );
    expect(hook.result.current.alerts).toEqual([]);
    expect(hook.result.current.updatedAt).toBeNull();

    hook.unmount();
  });

  it('ignores a pending request and poller from the previous agency', async () => {
    const regionalFixture = structuredClone(alertFixture);
    regionalFixture.Entities = [regionalFixture.Entities[0]];
    regionalFixture.Entities[0].Id = 'rg-current';
    regionalFixture.Entities[0].Alert.InformedEntities[0].AgencyId = 'RG';
    let resolveSf;
    let firstSfRequest = true;
    globalThis.fetch = vi.fn((url) => {
      const agency = url.searchParams.get('agency');
      if (agency === 'SF' && firstSfRequest) {
        firstSfRequest = false;
        return new Promise((resolve) => {
          resolveSf = resolve;
        });
      }
      return Promise.resolve(
        agency === 'RG'
          ? {
              ok: true,
              status: 200,
              text: vi.fn().mockResolvedValue(JSON.stringify(regionalFixture)),
            }
          : alertResponse(),
      );
    });
    const hook = renderHook(({ agency }) => useTransitAlerts(agency), {
      initialProps: { agency: 'SF' },
    });
    await waitForHook(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));

    hook.rerender({ agency: 'RG' });
    await waitForHook(() =>
      expect(hook.result.current.alerts[0]?.id).toBe('rg-current'),
    );
    resolveSf(alertResponse());
    await act(async () => {
      await vi.waitFor(async () =>
        expect(await providerResponseStore.get('511:alerts:SF')).toBeDefined(),
      );
    });

    expect(hook.result.current.alerts[0]?.id).toBe('rg-current');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });
    await waitForHook(() => expect(globalThis.fetch).toHaveBeenCalledTimes(3));
    expect(globalThis.fetch.mock.calls[2][0].searchParams.get('agency')).toBe(
      'RG',
    );

    hook.unmount();
  });
});
