import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { savedStateStore } from '../../lib/responseStore.js';
import { useSavedDestinations } from '../useSavedDestinations.js';

const STORE_KEY = 'saved-destinations';
const unionSquare = {
  id: 'here:union-square',
  title: 'Union Square',
  address: '333 Post St, San Francisco, CA',
  position: { lat: 37.7879, lng: -122.4075 },
  resultType: 'place',
  categories: ['Landmark'],
  distanceMeters: 8_100,
  rawUrl: 'https://example.test/?apiKey=secret',
  fetchedAt: 123,
};
const ferryBuilding = {
  ...unionSquare,
  id: 'here:ferry-building',
  title: 'Ferry Building',
  address: '1 Ferry Building, San Francisco, CA',
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function waitUntilLoaded(result) {
  await waitFor(() => expect(result.current.loading).toBe(false));
}

describe('useSavedDestinations', () => {
  beforeEach(async () => {
    await savedStateStore.delete(STORE_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts empty and persists only a normalized candidate across remounts', async () => {
    const first = renderHook(() => useSavedDestinations());
    await waitUntilLoaded(first.result);
    expect(first.result.current.savedDestinations).toEqual([]);

    await act(async () => {
      await first.result.current.toggleSaved(unionSquare);
    });
    expect(first.result.current.isSaved(unionSquare.id)).toBe(true);
    expect(await savedStateStore.get(STORE_KEY)).toEqual([
      {
        id: 'here:union-square',
        title: 'Union Square',
        address: '333 Post St, San Francisco, CA',
        position: { lat: 37.7879, lng: -122.4075 },
        resultType: 'place',
        categories: ['Landmark'],
        distanceMeters: 8_100,
      },
    ]);
    first.unmount();

    const second = renderHook(() => useSavedDestinations());
    await waitUntilLoaded(second.result);
    expect(second.result.current.savedDestinations[0].title).toBe(
      'Union Square',
    );

    await act(async () => {
      await second.result.current.toggleSaved(unionSquare);
    });
    expect(second.result.current.savedDestinations).toEqual([]);
    expect(await savedStateStore.get(STORE_KEY)).toEqual([]);
  });

  it('deduplicates stored candidates by ID when loading', async () => {
    await savedStateStore.put(STORE_KEY, [
      unionSquare,
      { ...unionSquare, title: 'Older duplicate' },
    ]);

    const hook = renderHook(() => useSavedDestinations());
    await waitUntilLoaded(hook.result);

    expect(hook.result.current.savedDestinations).toHaveLength(1);
    expect(hook.result.current.savedDestinations[0].title).toBe('Union Square');
  });

  it('merges a toggle made before hydration with the stored collection', async () => {
    const pendingLoad = deferred();
    vi.spyOn(savedStateStore, 'get').mockReturnValueOnce(pendingLoad.promise);

    const hook = renderHook(() => useSavedDestinations());
    expect(hook.result.current.loading).toBe(true);

    await act(async () => {
      await hook.result.current.toggleSaved(unionSquare);
    });
    expect(hook.result.current.isSaved(unionSquare.id)).toBe(true);

    pendingLoad.resolve([ferryBuilding]);
    await waitUntilLoaded(hook.result);

    expect(
      hook.result.current.savedDestinations.map((place) => place.id),
    ).toEqual([unionSquare.id, ferryBuilding.id]);
    expect(await savedStateStore.get(STORE_KEY)).toEqual(
      hook.result.current.savedDestinations,
    );
  });

  it('keeps an already-stored destination when Save is tapped before hydration', async () => {
    const pendingLoad = deferred();
    vi.spyOn(savedStateStore, 'get').mockReturnValueOnce(pendingLoad.promise);
    const hook = renderHook(() => useSavedDestinations());

    await act(async () => hook.result.current.toggleSaved(unionSquare));
    pendingLoad.resolve([unionSquare, ferryBuilding]);
    await waitUntilLoaded(hook.result);

    expect(
      hook.result.current.savedDestinations.map(({ id }) => id),
    ).toEqual([unionSquare.id, ferryBuilding.id]);
  });

  it('replays multiple pre-hydration actions as their intended final states', async () => {
    const pendingLoad = deferred();
    vi.spyOn(savedStateStore, 'get').mockReturnValueOnce(pendingLoad.promise);
    const hook = renderHook(() => useSavedDestinations());

    await act(async () => hook.result.current.toggleSaved(unionSquare));
    await act(async () => hook.result.current.toggleSaved(unionSquare));
    await act(async () => hook.result.current.toggleSaved(ferryBuilding));
    pendingLoad.resolve([unionSquare]);
    await waitUntilLoaded(hook.result);

    expect(
      hook.result.current.savedDestinations.map(({ id }) => id),
    ).toEqual([ferryBuilding.id]);
  });

  it('does not write when the initial saved-state read fails', async () => {
    vi.spyOn(savedStateStore, 'get').mockRejectedValueOnce(
      new Error('temporary IndexedDB read failure'),
    );
    const put = vi.spyOn(savedStateStore, 'put');
    const hook = renderHook(() => useSavedDestinations());

    await waitUntilLoaded(hook.result);

    expect(put).not.toHaveBeenCalled();
  });

  it('keeps later toggles in memory without writing after a failed read', async () => {
    vi.spyOn(savedStateStore, 'get').mockRejectedValueOnce(
      new Error('temporary IndexedDB read failure'),
    );
    const put = vi.spyOn(savedStateStore, 'put');
    const hook = renderHook(() => useSavedDestinations());
    await waitUntilLoaded(hook.result);

    await act(async () => hook.result.current.toggleSaved(unionSquare));

    expect(hook.result.current.isSaved(unionSquare.id)).toBe(true);
    expect(put).not.toHaveBeenCalled();
  });

  it('keeps queued intent when a cancelled StrictMode read fails', async () => {
    const cancelledLoad = deferred();
    const activeLoad = deferred();
    vi.spyOn(savedStateStore, 'get')
      .mockReturnValueOnce(cancelledLoad.promise)
      .mockReturnValueOnce(activeLoad.promise);
    const hook = renderHook(() => useSavedDestinations(), {
      wrapper: StrictMode,
    });

    await act(async () => hook.result.current.toggleSaved(unionSquare));
    await act(async () => {
      cancelledLoad.reject(new Error('cancelled IndexedDB read failure'));
    });
    activeLoad.resolve([ferryBuilding]);
    await waitUntilLoaded(hook.result);

    expect(
      hook.result.current.savedDestinations.map(({ id }) => id),
    ).toEqual([unionSquare.id, ferryBuilding.id]);
  });

  it('keeps persistence enabled when a cancelled StrictMode read fails late', async () => {
    const cancelledLoad = deferred();
    const activeLoad = deferred();
    vi.spyOn(savedStateStore, 'get')
      .mockReturnValueOnce(cancelledLoad.promise)
      .mockReturnValueOnce(activeLoad.promise);
    const put = vi.spyOn(savedStateStore, 'put');
    const hook = renderHook(() => useSavedDestinations(), {
      wrapper: StrictMode,
    });

    activeLoad.resolve([ferryBuilding]);
    await waitUntilLoaded(hook.result);
    await act(async () => {
      cancelledLoad.reject(new Error('cancelled IndexedDB read failure'));
    });
    const writesBeforeToggle = put.mock.calls.length;

    await act(async () => hook.result.current.toggleSaved(unionSquare));

    expect(put).toHaveBeenCalledTimes(writesBeforeToggle + 1);
  });

  it('keeps the ten most recently saved places', async () => {
    const hook = renderHook(() => useSavedDestinations());
    await waitUntilLoaded(hook.result);

    for (let index = 1; index <= 11; index += 1) {
      await act(async () => {
        await hook.result.current.toggleSaved({
          ...unionSquare,
          id: `here:place-${index}`,
          title: `Place ${index}`,
        });
      });
    }

    expect(
      hook.result.current.savedDestinations.map((place) => place.id),
    ).toEqual([
      'here:place-11',
      'here:place-10',
      'here:place-9',
      'here:place-8',
      'here:place-7',
      'here:place-6',
      'here:place-5',
      'here:place-4',
      'here:place-3',
      'here:place-2',
    ]);
    expect(await savedStateStore.get(STORE_KEY)).toHaveLength(10);
  });
});
