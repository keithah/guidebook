import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

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

async function waitUntilLoaded(result) {
  await waitFor(() => expect(result.current.loading).toBe(false));
}

describe('useSavedDestinations', () => {
  beforeEach(async () => {
    await savedStateStore.delete(STORE_KEY);
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
    expect(second.result.current.savedDestinations[0].title).toBe('Union Square');

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

    expect(hook.result.current.savedDestinations.map((place) => place.id)).toEqual([
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
