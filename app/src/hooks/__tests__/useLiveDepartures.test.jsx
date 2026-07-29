import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLiveDepartures } from '../useLiveDepartures.js';
import { resetRequestCoordinatorForTests } from '../../lib/requestCoordinator.js';
import { providerResponseStore } from '../../lib/responseStore.js';

const startTime = Date.parse('2026-07-28T19:00:00.000Z');
const stops = [{ line: 'K', stopCode: '15794', agency: 'SF' }];
const originalFetch = globalThis.fetch;
const stopPayload = {
  ServiceDelivery: {
    StopMonitoringDelivery: {
      MonitoredStopVisit: [
        {
          MonitoredVehicleJourney: {
            MonitoredCall: {
              ExpectedArrivalTime: '2026-07-28T19:04:00.000Z',
            },
          },
        },
      ],
    },
  },
};

function stopResponse() {
  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(JSON.stringify(stopPayload)),
  };
}

async function waitForHook(assertion) {
  await vi.waitFor(assertion, { timeout: 2_000, interval: 5 });
}

describe('useLiveDepartures', () => {
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

  it('shares a five-minute departure cache across consumers', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(stopResponse());

    const first = renderHook(() => useLiveDepartures(stops));
    await waitForHook(() => expect(first.result.current.times[0]).toBe('4′'));
    expect(first.result.current.meta[0]).toMatchObject({
      status: 'live',
    });
    expect(first.result.current.meta[0].updatedAt).toBeGreaterThanOrEqual(
      startTime,
    );

    const second = renderHook(() => useLiveDepartures(stops));
    await waitForHook(() =>
      expect(second.result.current.meta[0]?.status).toBe('cached'),
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });
    await waitForHook(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));

    first.unmount();
    second.unmount();
  });

  it('labels stale departures after failure and removes them at 30 minutes', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(stopResponse())
      .mockRejectedValue(new TypeError('offline'));
    const hook = renderHook(() => useLiveDepartures(stops));
    await waitForHook(() => expect(hook.result.current.times[0]).toBe('4′'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });
    await waitForHook(() =>
      expect(hook.result.current.meta[0]?.status).toBe('stale'),
    );
    expect(hook.result.current.times[0]).toBe('4′');
    expect(hook.result.current.meta[0].error).toBe('network');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25 * 60_000);
    });
    await waitForHook(() =>
      expect(hook.result.current.meta[0]?.status).toBe('unavailable'),
    );
    expect(hook.result.current.times[0]).toBeUndefined();

    hook.unmount();
  });
});
