import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchHereWalkingRoute } from '../../lib/hereWalking.js';
import { useWalkingRoute } from '../useWalkingRoute.js';

vi.mock('../../lib/hereWalking.js', () => ({
  fetchHereWalkingRoute: vi.fn(),
}));

const origin = { lat: 37.77154, lng: -122.41761 };
const destination = { lat: 37.7596, lng: -122.4269 };
const otherDestination = { lat: 37.768, lng: -122.482 };
const successfulResult = {
  ok: true,
  route: { id: 'walking-route', actions: [] },
  source: 'network',
  fetchedAt: 1,
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

describe('useWalkingRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads lazily only after walking is enabled', async () => {
    fetchHereWalkingRoute.mockResolvedValue(successfulResult);
    const hook = renderHook(
      ({ enabled, currentDestination }) =>
        useWalkingRoute({
          origin,
          destination: currentDestination,
          enabled,
        }),
      {
        initialProps: { enabled: false, currentDestination: destination },
      },
    );

    expect(hook.result.current.routeResult).toBeNull();
    expect(fetchHereWalkingRoute).not.toHaveBeenCalled();

    hook.rerender({ enabled: true, currentDestination: destination });
    await waitForHook(() =>
      expect(hook.result.current.routeResult).toEqual(successfulResult),
    );
    expect(fetchHereWalkingRoute).toHaveBeenCalledTimes(1);
    expect(fetchHereWalkingRoute).toHaveBeenCalledWith(
      origin,
      destination,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('aborts and ignores a superseded destination result', async () => {
    const first = deferred();
    const second = deferred();
    fetchHereWalkingRoute
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const hook = renderHook(
      ({ currentDestination }) =>
        useWalkingRoute({
          origin,
          destination: currentDestination,
          enabled: true,
        }),
      { initialProps: { currentDestination: destination } },
    );
    await waitForHook(() =>
      expect(fetchHereWalkingRoute).toHaveBeenCalledTimes(1),
    );
    const firstSignal = fetchHereWalkingRoute.mock.calls[0][2].signal;

    hook.rerender({ currentDestination: otherDestination });
    await waitForHook(() =>
      expect(fetchHereWalkingRoute).toHaveBeenCalledTimes(2),
    );
    expect(firstSignal.aborted).toBe(true);

    const currentResult = {
      ...successfulResult,
      route: { id: 'current-walking-route', actions: [] },
    };
    second.resolve(currentResult);
    await waitForHook(() =>
      expect(hook.result.current.routeResult).toEqual(currentResult),
    );

    first.resolve({
      ...successfulResult,
      route: { id: 'stale-walking-route', actions: [] },
    });
    await act(async () => {
      await first.promise;
    });
    expect(hook.result.current.routeResult).toEqual(currentResult);
  });

  it('aborts on unmount so a late result cannot be applied', async () => {
    const pending = deferred();
    fetchHereWalkingRoute.mockReturnValue(pending.promise);
    const hook = renderHook(() =>
      useWalkingRoute({ origin, destination, enabled: true }),
    );
    await waitForHook(() =>
      expect(fetchHereWalkingRoute).toHaveBeenCalledTimes(1),
    );
    const signal = fetchHereWalkingRoute.mock.calls[0][2].signal;

    hook.unmount();
    expect(signal.aborted).toBe(true);

    pending.resolve(successfulResult);
    await act(async () => {
      await pending.promise;
    });
  });

  it('retries with the same origin and destination after a failure', async () => {
    const failure = { ok: false, reason: 'network' };
    fetchHereWalkingRoute
      .mockResolvedValueOnce(failure)
      .mockResolvedValueOnce(successfulResult);
    const { result } = renderHook(() =>
      useWalkingRoute({ origin, destination, enabled: true }),
    );
    await waitForHook(() => expect(result.current.routeResult).toEqual(failure));

    await act(async () => {
      await result.current.retryWalking();
    });

    expect(result.current.routeResult).toEqual(successfulResult);
    expect(fetchHereWalkingRoute).toHaveBeenCalledTimes(2);
    expect(fetchHereWalkingRoute.mock.calls[0].slice(0, 2)).toEqual([
      origin,
      destination,
    ]);
    expect(fetchHereWalkingRoute.mock.calls[1].slice(0, 2)).toEqual([
      origin,
      destination,
    ]);
  });

  it('does not retry while walking mode is disabled', async () => {
    const { result } = renderHook(() =>
      useWalkingRoute({ origin, destination, enabled: false }),
    );

    let retryResult;
    await act(async () => {
      retryResult = await result.current.retryWalking();
    });

    expect(retryResult).toBeNull();
    expect(result.current.routeResult).toBeNull();
    expect(fetchHereWalkingRoute).not.toHaveBeenCalled();
  });

  it('preserves a successful result while disabled and reuses it on re-enable', async () => {
    fetchHereWalkingRoute.mockResolvedValue(successfulResult);
    const hook = renderHook(
      ({ enabled }) => useWalkingRoute({ origin, destination, enabled }),
      { initialProps: { enabled: true } },
    );
    await waitForHook(() =>
      expect(hook.result.current.routeResult).toEqual(successfulResult),
    );

    hook.rerender({ enabled: false });
    expect(hook.result.current.routeResult).toEqual(successfulResult);

    hook.rerender({ enabled: true });
    await act(async () => {});
    expect(hook.result.current.routeResult).toEqual(successfulResult);
    expect(fetchHereWalkingRoute).toHaveBeenCalledTimes(1);
  });

  it('hides a successful result during the first render of a changed journey key', async () => {
    fetchHereWalkingRoute.mockResolvedValue(successfulResult);
    const renderSnapshots = [];
    const hook = renderHook(
      ({ enabled, currentDestination }) => {
        const walking = useWalkingRoute({
          origin,
          destination: currentDestination,
          enabled,
        });
        renderSnapshots.push({
          destinationLng: currentDestination.lng,
          routeResult: walking.routeResult,
        });
        return walking;
      },
      {
        initialProps: { enabled: true, currentDestination: destination },
      },
    );
    await waitForHook(() =>
      expect(hook.result.current.routeResult).toEqual(successfulResult),
    );

    renderSnapshots.length = 0;
    hook.rerender({ enabled: false, currentDestination: otherDestination });

    const changedJourneyRenders = renderSnapshots.filter(
      (snapshot) => snapshot.destinationLng === otherDestination.lng,
    );
    expect(changedJourneyRenders.length).toBeGreaterThan(0);
    changedJourneyRenders.forEach((snapshot) =>
      expect(snapshot.routeResult).toBeNull(),
    );
    expect(hook.result.current.routeResult).toBeNull();
    expect(fetchHereWalkingRoute).toHaveBeenCalledTimes(1);
  });

  it('aborts pending work when disabled without publishing an aborted result', async () => {
    const pending = deferred();
    fetchHereWalkingRoute.mockReturnValue(pending.promise);
    const hook = renderHook(
      ({ enabled }) => useWalkingRoute({ origin, destination, enabled }),
      { initialProps: { enabled: true } },
    );
    await waitForHook(() =>
      expect(fetchHereWalkingRoute).toHaveBeenCalledTimes(1),
    );
    const signal = fetchHereWalkingRoute.mock.calls[0][2].signal;

    hook.rerender({ enabled: false });
    expect(signal.aborted).toBe(true);

    pending.resolve({ ok: false, reason: 'aborted' });
    await act(async () => {
      await pending.promise;
    });
    expect(hook.result.current.routeResult).toBeNull();
  });

  it('clears a preserved result when the journey changes or is removed', async () => {
    fetchHereWalkingRoute.mockResolvedValue(successfulResult);
    const hook = renderHook(
      ({ currentDestination }) =>
        useWalkingRoute({
          origin,
          destination: currentDestination,
          enabled: false,
        }),
      { initialProps: { currentDestination: destination } },
    );

    hook.rerender({ currentDestination: destination });
    hook.rerender({ currentDestination: otherDestination });
    expect(hook.result.current.routeResult).toBeNull();

    hook.rerender({ currentDestination: null });
    expect(hook.result.current.routeResult).toBeNull();
    expect(fetchHereWalkingRoute).not.toHaveBeenCalled();
  });

  it('clears a successful result after the destination changes while disabled', async () => {
    fetchHereWalkingRoute.mockResolvedValue(successfulResult);
    const hook = renderHook(
      ({ enabled, currentDestination }) =>
        useWalkingRoute({
          origin,
          destination: currentDestination,
          enabled,
        }),
      {
        initialProps: { enabled: true, currentDestination: destination },
      },
    );
    await waitForHook(() =>
      expect(hook.result.current.routeResult).toEqual(successfulResult),
    );

    hook.rerender({ enabled: false, currentDestination: otherDestination });
    expect(hook.result.current.routeResult).toBeNull();

    expect(fetchHereWalkingRoute).toHaveBeenCalledTimes(1);
  });

  it('clears a successful result when its destination is removed while disabled', async () => {
    fetchHereWalkingRoute.mockResolvedValue(successfulResult);
    const hook = renderHook(
      ({ enabled, currentDestination }) =>
        useWalkingRoute({
          origin,
          destination: currentDestination,
          enabled,
        }),
      {
        initialProps: { enabled: true, currentDestination: destination },
      },
    );
    await waitForHook(() =>
      expect(hook.result.current.routeResult).toEqual(successfulResult),
    );

    hook.rerender({ enabled: false, currentDestination: destination });
    expect(hook.result.current.routeResult).toEqual(successfulResult);

    hook.rerender({ enabled: false, currentDestination: null });
    expect(hook.result.current.routeResult).toBeNull();
    expect(fetchHereWalkingRoute).toHaveBeenCalledTimes(1);
  });
});
