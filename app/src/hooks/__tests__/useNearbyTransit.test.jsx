import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchHereNearbyTransit } from '../../lib/hereNearbyTransit.js';
import { useNearbyTransit } from '../useNearbyTransit.js';

vi.mock('../../lib/hereNearbyTransit.js', () => ({
  fetchHereNearbyTransit: vi.fn(),
}));

const howard = { lat: 37.77154, lng: -122.41761 };
const cottage = { lat: 37.7596, lng: -122.4269 };
const successfulResult = {
  ok: true,
  stations: [{ id: 'howard', name: 'Howard Street' }],
  source: 'network',
  fetchedAt: 1_000,
  expiresAt: null,
};

function deferred() {
  let resolve;
  const promise = new Promise((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

async function waitForHook(assertion) {
  await vi.waitFor(assertion, { timeout: 2_000, interval: 5 });
}

describe('useNearbyTransit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does no provider work while disabled', async () => {
    const { result } = renderHook(() =>
      useNearbyTransit({ origin: howard, enabled: false }),
    );

    expect(result.current.result).toBeNull();
    await expect(result.current.refresh()).resolves.toBeNull();
    expect(fetchHereNearbyTransit).not.toHaveBeenCalled();
  });

  it('requests nearby transit with an abort signal when enabled', async () => {
    fetchHereNearbyTransit.mockResolvedValue(successfulResult);
    const hook = renderHook(
      ({ enabled }) => useNearbyTransit({ origin: howard, enabled }),
      { initialProps: { enabled: false } },
    );

    hook.rerender({ enabled: true });

    await waitForHook(() =>
      expect(hook.result.current.result).toEqual(successfulResult),
    );
    expect(fetchHereNearbyTransit).toHaveBeenCalledWith(
      howard,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('aborts the old origin and hides it on the first changed-origin render', async () => {
    const howardRequest = deferred();
    const cottageRequest = deferred();
    fetchHereNearbyTransit
      .mockReturnValueOnce(howardRequest.promise)
      .mockReturnValueOnce(cottageRequest.promise);
    const renderSnapshots = [];
    const hook = renderHook(
      ({ origin }) => {
        const nearby = useNearbyTransit({ origin, enabled: true });
        renderSnapshots.push({ lng: origin.lng, result: nearby.result });
        return nearby;
      },
      { initialProps: { origin: howard } },
    );
    await waitForHook(() =>
      expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(1),
    );
    const howardSignal = fetchHereNearbyTransit.mock.calls[0][1].signal;

    renderSnapshots.length = 0;
    hook.rerender({ origin: cottage });

    expect(renderSnapshots[0]).toEqual({ lng: cottage.lng, result: null });
    await waitForHook(() =>
      expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(2),
    );
    expect(howardSignal.aborted).toBe(true);
  });

  it('does not let a late old-origin success replace the newer origin', async () => {
    const howardRequest = deferred();
    const cottageRequest = deferred();
    fetchHereNearbyTransit
      .mockReturnValueOnce(howardRequest.promise)
      .mockReturnValueOnce(cottageRequest.promise);
    const hook = renderHook(
      ({ origin }) => useNearbyTransit({ origin, enabled: true }),
      { initialProps: { origin: howard } },
    );
    await waitForHook(() =>
      expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(1),
    );

    hook.rerender({ origin: cottage });
    await waitForHook(() =>
      expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(2),
    );
    const cottageResult = {
      ...successfulResult,
      stations: [{ id: 'cottage', name: 'Cottage Station' }],
    };
    cottageRequest.resolve(cottageResult);
    await waitForHook(() =>
      expect(hook.result.current.result).toEqual(cottageResult),
    );

    howardRequest.resolve(successfulResult);
    await act(async () => {
      await howardRequest.promise;
    });
    expect(hook.result.current.result).toEqual(cottageResult);
  });

  it('keeps refresh stable and requests the latest committed origin', async () => {
    fetchHereNearbyTransit.mockResolvedValue(successfulResult);
    const hook = renderHook(
      ({ origin }) => useNearbyTransit({ origin, enabled: true }),
      { initialProps: { origin: howard } },
    );
    await waitForHook(() =>
      expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(1),
    );
    const refresh = hook.result.current.refresh;

    hook.rerender({ origin: cottage });
    await waitForHook(() =>
      expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(2),
    );
    expect(hook.result.current.refresh).toBe(refresh);

    await act(async () => {
      await refresh();
    });
    expect(fetchHereNearbyTransit).toHaveBeenLastCalledWith(
      cottage,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it.each(['disable', 'unmount'])(
    'aborts pending work and ignores late settlement without a timer on %s',
    async (action) => {
      vi.useFakeTimers();
      const pendingRequest = deferred();
      fetchHereNearbyTransit.mockReturnValue(pendingRequest.promise);
      const hook = renderHook(
        ({ enabled }) => useNearbyTransit({ origin: howard, enabled }),
        { initialProps: { enabled: true } },
      );
      await act(async () => {});
      expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(1);
      const signal = fetchHereNearbyTransit.mock.calls[0][1].signal;
      expect(vi.getTimerCount()).toBe(0);

      if (action === 'disable') hook.rerender({ enabled: false });
      else hook.unmount();

      expect(signal.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      pendingRequest.resolve(successfulResult);
      await act(async () => {
        await pendingRequest.promise;
      });
      expect(hook.result.current.result).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(300_000);
      expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(1);
    },
  );

  it('publishes provider failures without fallback stations', async () => {
    const failure = { ok: false, reason: 'network' };
    fetchHereNearbyTransit.mockResolvedValue(failure);
    const { result } = renderHook(() =>
      useNearbyTransit({ origin: howard, enabled: true }),
    );

    await waitForHook(() => expect(result.current.result).toEqual(failure));
    expect(result.current.result).not.toHaveProperty('stations');
  });

  it('clears a failure immediately and retries the current origin on refresh', async () => {
    const failure = { ok: false, reason: 'network' };
    const retryRequest = deferred();
    fetchHereNearbyTransit
      .mockResolvedValueOnce(failure)
      .mockReturnValueOnce(retryRequest.promise);
    const { result } = renderHook(() =>
      useNearbyTransit({ origin: howard, enabled: true }),
    );
    await waitForHook(() => expect(result.current.result).toEqual(failure));

    let refreshPromise;
    act(() => {
      refreshPromise = result.current.refresh();
    });

    expect(result.current.result).toBeNull();
    expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(2);
    retryRequest.resolve(successfulResult);
    await act(async () => {
      await refreshPromise;
    });
    expect(result.current.result).toEqual(successfulResult);
  });

  it('does not poll before five minutes and polls once at five minutes', async () => {
    vi.useFakeTimers();
    fetchHereNearbyTransit.mockResolvedValue(successfulResult);
    renderHook(() => useNearbyTransit({ origin: howard, enabled: true }));
    await act(async () => {});
    expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(299_999);
    expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(2);
  });

  it('waits for a later provider expiry before polling again', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const expiringResult = {
      ...successfulResult,
      expiresAt: 1_000_000 + 420_000,
    };
    fetchHereNearbyTransit.mockResolvedValue(expiringResult);
    renderHook(() => useNearbyTransit({ origin: howard, enabled: true }));
    await act(async () => {});

    await vi.advanceTimersByTimeAsync(419_999);
    expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(2);
  });

  it('chains bounded timers for an expiry beyond the platform timeout maximum', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const maximumTimeout = 2_147_483_647;
    const farExpiry = 1_000_000 + maximumTimeout * 2 + 420_000;
    fetchHereNearbyTransit.mockResolvedValue({
      ...successfulResult,
      expiresAt: farExpiry,
    });
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    renderHook(() => useNearbyTransit({ origin: howard, enabled: true }));
    await act(async () => {});

    const initialHookDelay = timeout.mock.calls.at(-1)[1];
    expect(initialHookDelay).toBe(maximumTimeout);
    await vi.advanceTimersByTimeAsync(maximumTimeout);
    expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(maximumTimeout);
    expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(419_999);
    expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(2);
  });

  it('uses the five-minute floor when expiresAt is non-finite', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    fetchHereNearbyTransit.mockResolvedValue({
      ...successfulResult,
      expiresAt: Number.NaN,
    });
    renderHook(() => useNearbyTransit({ origin: howard, enabled: true }));
    await act(async () => {});

    await vi.advanceTimersByTimeAsync(299_999);
    expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchHereNearbyTransit).toHaveBeenCalledTimes(2);
  });
});
