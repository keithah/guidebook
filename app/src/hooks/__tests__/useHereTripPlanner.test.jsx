import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { searchHereDestinations } from '../../lib/hereSearch.js';
import { fetchHereTransitRoutes } from '../../lib/hereTransit.js';
import { useHereTripPlanner } from '../useHereTripPlanner.js';

vi.mock('../../lib/hereSearch.js', () => ({
  searchHereDestinations: vi.fn(),
}));

vi.mock('../../lib/hereTransit.js', () => ({
  fetchHereTransitRoutes: vi.fn(),
}));

const origin = { lat: 37.7226, lng: -122.4547 };
const unionSquare = {
  id: 'here:union-square',
  title: 'Union Square',
  address: '333 Post St, San Francisco, CA',
  position: { lat: 37.7879, lng: -122.4075 },
  resultType: 'place',
  categories: ['Landmark'],
  distanceMeters: 8_100,
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

describe('useHereTripPlanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aborts a superseded search and ignores its late result', async () => {
    const first = deferred();
    const second = deferred();
    const staleCandidate = { ...unionSquare, id: 'here:stale', title: 'Stale' };
    searchHereDestinations
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useHereTripPlanner({ origin }));

    let firstSearch;
    act(() => {
      firstSearch = result.current.search('First');
    });
    const firstSignal = searchHereDestinations.mock.calls[0][2].signal;

    let secondSearch;
    act(() => {
      secondSearch = result.current.search('Second');
    });
    expect(firstSignal.aborted).toBe(true);

    second.resolve({ ok: true, candidates: [unionSquare] });
    await act(async () => {
      await secondSearch;
    });
    expect(result.current.query).toBe('Second');
    expect(result.current.candidates).toEqual([unionSquare]);
    expect(result.current.selectedDestination).toBeNull();
    expect(fetchHereTransitRoutes).not.toHaveBeenCalled();

    first.resolve({ ok: true, candidates: [staleCandidate] });
    await act(async () => {
      await firstSearch;
    });
    expect(result.current.candidates).toEqual([unionSquare]);
  });

  it('searches without selecting or routing and reports an empty result', async () => {
    searchHereDestinations.mockResolvedValue({ ok: true, candidates: [] });
    const { result } = renderHook(() => useHereTripPlanner({ origin }));

    await act(async () => {
      await result.current.search('Nowhere');
    });

    expect(result.current.query).toBe('Nowhere');
    expect(result.current.searchStatus).toEqual({ status: 'empty' });
    expect(result.current.selectedDestination).toBeNull();
    expect(result.current.routeResult).toBeNull();
    expect(fetchHereTransitRoutes).not.toHaveBeenCalled();
  });

  it('settles search feedback when selecting a retained candidate during a pending search', async () => {
    const pending = deferred();
    searchHereDestinations
      .mockResolvedValueOnce({ ok: true, candidates: [unionSquare] })
      .mockReturnValueOnce(pending.promise);
    fetchHereTransitRoutes.mockResolvedValue({
      ok: false,
      reason: 'network',
    });
    const { result } = renderHook(() => useHereTripPlanner({ origin }));

    await act(async () => {
      await result.current.search('Union Square');
    });
    let pendingSearch;
    act(() => {
      pendingSearch = result.current.search('A newer query');
    });
    expect(result.current.searchStatus).toEqual({ status: 'loading' });
    const pendingSignal = searchHereDestinations.mock.calls[1][2].signal;

    await act(async () => {
      await result.current.selectDestination(unionSquare);
    });

    expect(pendingSignal.aborted).toBe(true);
    expect(result.current.searchStatus).toEqual({ status: 'success' });
    expect(result.current.selectedDestination).toEqual(unionSquare);

    pending.resolve({
      ok: true,
      candidates: [{ ...unionSquare, id: 'here:late-result' }],
    });
    await act(async () => {
      await pendingSearch;
    });
    expect(result.current.searchStatus).toEqual({ status: 'success' });
  });

  it('routes only after selection and refetches when the origin changes', async () => {
    const firstRoute = {
      ok: true,
      trips: [{ id: 'route-one', plannedAt: '2026-07-28T19:00:00.000Z' }],
      source: 'network',
      fetchedAt: 1,
    };
    const secondRoute = {
      ...firstRoute,
      trips: [{ id: 'route-two', plannedAt: '2026-07-28T19:05:00.000Z' }],
      fetchedAt: 2,
    };
    fetchHereTransitRoutes
      .mockResolvedValueOnce(firstRoute)
      .mockResolvedValueOnce(secondRoute);
    const { result, rerender } = renderHook(
      ({ currentOrigin }) => useHereTripPlanner({ origin: currentOrigin }),
      { initialProps: { currentOrigin: origin } },
    );

    await act(async () => {
      await result.current.selectDestination(unionSquare);
    });
    expect(result.current.selectedDestination).toEqual(unionSquare);
    expect(result.current.routeResult).toEqual(firstRoute);
    expect(fetchHereTransitRoutes).toHaveBeenCalledTimes(1);
    expect(fetchHereTransitRoutes).toHaveBeenLastCalledWith(
      origin,
      unionSquare.position,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    rerender({ currentOrigin: { lat: 37.71, lng: -122.44 } });
    await waitForHook(() => expect(result.current.routeResult).toEqual(secondRoute));
    expect(fetchHereTransitRoutes).toHaveBeenCalledTimes(2);
  });

  it('clears all destination work and retries routes without losing context', async () => {
    const pendingRoute = deferred();
    const retried = {
      ok: false,
      reason: 'network',
    };
    fetchHereTransitRoutes
      .mockReturnValueOnce(pendingRoute.promise)
      .mockResolvedValueOnce(retried);
    const { result } = renderHook(() => useHereTripPlanner({ origin }));

    act(() => result.current.setQuery('Union Square'));
    let selection;
    act(() => {
      selection = result.current.selectDestination(unionSquare);
    });
    const firstRouteSignal = fetchHereTransitRoutes.mock.calls[0][2].signal;

    await act(async () => {
      await result.current.retryRoutes();
    });
    expect(firstRouteSignal.aborted).toBe(true);
    expect(result.current.query).toBe('Union Square');
    expect(result.current.selectedDestination).toEqual(unionSquare);
    expect(result.current.routeResult).toEqual(retried);

    act(() => result.current.clearDestination());
    expect(result.current.query).toBe('');
    expect(result.current.candidates).toEqual([]);
    expect(result.current.selectedDestination).toBeNull();
    expect(result.current.routeResult).toBeNull();

    pendingRoute.resolve({ ok: true, trips: [{ id: 'stale-route' }] });
    await act(async () => {
      await selection;
    });
    expect(result.current.routeResult).toBeNull();
  });
});
