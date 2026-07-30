import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import walkingFixture from '../../test/fixtures/here-walking.json';
import {
  buildHereWalkingUrl,
  fetchHereWalkingRoute,
  normalizeHereWalking,
} from '../hereWalking.js';
import { resetRequestCoordinatorForTests } from '../requestCoordinator.js';
import { providerResponseStore } from '../responseStore.js';

const origin = { lat: 37.77154, lng: -122.41761 };
const destination = { lat: 37.7596, lng: -122.4269 };
const apiKey = 'test-key-not-a-credential';
const fetchedAt = 10_000;
const cacheKey =
  'here-walking:37.77154,-122.41761:37.7596,-122.4269:fast:imperial:en-US';

function hereResponse(payload = walkingFixture, options = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: new Headers(options.headers),
    json: vi.fn().mockResolvedValue(payload),
  };
}

describe('buildHereWalkingUrl', () => {
  it('builds the exact HERE pedestrian routing request', () => {
    const url = buildHereWalkingUrl(origin, destination, apiKey);

    expect(url.origin + url.pathname).toBe(
      'https://router.hereapi.com/v8/routes',
    );
    expect(url.searchParams.get('origin')).toBe('37.77154,-122.41761');
    expect(url.searchParams.get('destination')).toBe(
      '37.7596,-122.4269',
    );
    expect(url.searchParams.get('routingMode')).toBe('fast');
    expect(url.searchParams.get('transportMode')).toBe('pedestrian');
    expect(url.searchParams.get('return')).toBe(
      'polyline,summary,actions,instructions',
    );
    expect(url.searchParams.get('units')).toBe('imperial');
    expect(url.searchParams.get('lang')).toBe('en-US');
    expect(url.searchParams.get('apiKey')).toBe(apiKey);
  });
});

describe('normalizeHereWalking', () => {
  it('preserves every section and action while summing route totals', () => {
    const route = normalizeHereWalking(walkingFixture);

    expect(route).toMatchObject({
      id: 'walking-route-mission-dolores',
      durationSeconds: 720,
      lengthMeters: 1_050,
      sections: expect.any(Array),
      actions: expect.any(Array),
      notices: expect.any(Array),
    });
    expect(route.sections).toHaveLength(2);
    expect(route.sections.map(({ id }) => id)).toEqual([
      'walk-section-1',
      'walk-section-2',
    ]);
    expect(route.sections.map(({ durationSeconds }) => durationSeconds)).toEqual(
      [420, 300],
    );
    expect(route.sections.map(({ actions }) => actions.length)).toEqual([2, 2]);
    expect(route.actions).toHaveLength(4);
    expect(route.actions.map(({ instruction }) => instruction)).toEqual([
      'Head southwest on Howard Street.',
      'Turn right onto 16th Street.',
      'Take the stairs up to Dolores Street.',
      'Arrive at Mission Dolores Park on your left.',
    ]);
    expect(route.notices).toEqual([
      {
        code: 'pedestrian.multiPurposeOnly',
        title: 'Part of this route uses a multi-use path',
        severity: 'info',
      },
    ]);
    expect(route.sections[0]).toMatchObject({
      type: 'pedestrian',
      departureTime: '2026-07-30T10:00:00-07:00',
      arrivalTime: '2026-07-30T10:07:00-07:00',
      departure: {
        name: 'The SF Cottage',
        location: origin,
      },
      arrival: {
        name: 'Market Street crossing',
        location: { lat: 37.7652, lng: -122.4218 },
      },
      polyline: 'BFoz5xJ67i1B1B7PzIhaxL7Y',
    });
  });

  it('maps unknown action types to a readable lossless fallback', () => {
    const route = normalizeHereWalking(walkingFixture);

    expect(route.actions[2]).toEqual({
      type: 'unknown',
      label: 'Stairs up',
      instruction: 'Take the stairs up to Dolores Street.',
    });
  });

  it.each([
    [null],
    [{}],
    [{ routes: null }],
    [{ routes: [] }],
    [{ routes: [{ id: 'empty', sections: [] }] }],
    [{ routes: [{ id: 'null-section', sections: [null] }] }],
    [{ routes: [{ id: 'empty-section', sections: [{}] }] }],
    [
      {
        routes: [
          {
            id: 'malformed-summary',
            sections: [
              {
                id: 'bad-section',
                type: 'pedestrian',
                summary: { duration: '420', length: null },
              },
            ],
          },
        ],
      },
    ],
  ])('returns null when no valid walking route exists', (payload) => {
    expect(normalizeHereWalking(payload)).toBeNull();
  });

  it('skips malformed route candidates and normalizes the next valid route', () => {
    const payload = {
      routes: [
        { id: 'malformed', sections: [null] },
        walkingFixture.routes[0],
      ],
    };

    expect(normalizeHereWalking(payload)).toMatchObject({
      id: 'walking-route-mission-dolores',
      durationSeconds: 720,
      lengthMeters: 1_050,
    });
  });
});

describe('fetchHereWalkingRoute', () => {
  beforeEach(async () => {
    resetRequestCoordinatorForTests();
    await providerResponseStore.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns a normalized walking route from the network', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse(walkingFixture, {
        headers: { 'cache-control': 'no-store' },
      }),
    );

    await expect(
      fetchHereWalkingRoute(origin, destination, {
        apiKey,
        fetchImpl,
        now: () => fetchedAt,
      }),
    ).resolves.toEqual({
      ok: true,
      route: normalizeHereWalking(walkingFixture),
      source: 'network',
      fetchedAt,
      expiresAt: null,
    });
  });

  it('rejects a missing API key before storage or network work', async () => {
    const get = vi.spyOn(providerResponseStore, 'get');
    const fetchImpl = vi.fn();

    await expect(
      fetchHereWalkingRoute(origin, destination, { apiKey: '', fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'missing-api-key' });
    expect(get).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [{ lat: Number.NaN, lng: origin.lng }, destination],
    [origin, { lat: destination.lat, lng: Number.POSITIVE_INFINITY }],
  ])(
    'rejects invalid coordinates before storage or network work',
    async (invalidOrigin, invalidDestination) => {
      const get = vi.spyOn(providerResponseStore, 'get');
      const fetchImpl = vi.fn();

      await expect(
        fetchHereWalkingRoute(invalidOrigin, invalidDestination, {
          apiKey,
          fetchImpl,
        }),
      ).resolves.toEqual({ ok: false, reason: 'invalid-request' });
      expect(get).not.toHaveBeenCalled();
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'rate-limited'],
    [500, 'network'],
  ])('maps an HTTP %i response to %s', async (status, reason) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(hereResponse(undefined, { ok: false, status }));

    await expect(
      fetchHereWalkingRoute(origin, destination, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason });
  });

  it('maps an AbortError to aborted', async () => {
    const error = new Error('request aborted');
    error.name = 'AbortError';
    const fetchImpl = vi.fn().mockRejectedValue(error);

    await expect(
      fetchHereWalkingRoute(origin, destination, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'aborted' });
  });

  it('does not start work for an already-aborted caller', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn();

    await expect(
      fetchHereWalkingRoute(origin, destination, {
        apiKey,
        fetchImpl,
        signal: controller.signal,
      }),
    ).resolves.toEqual({ ok: false, reason: 'aborted' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps other fetch failures to network', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('offline'));

    await expect(
      fetchHereWalkingRoute(origin, destination, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'network' });
  });

  it('maps malformed JSON to invalid-response', async () => {
    const response = hereResponse();
    response.json.mockRejectedValue(new SyntaxError('invalid JSON'));

    await expect(
      fetchHereWalkingRoute(origin, destination, {
        apiKey,
        fetchImpl: vi.fn().mockResolvedValue(response),
      }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });

  it('returns no-route for an empty route response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(hereResponse({ routes: [] }));

    await expect(
      fetchHereWalkingRoute(origin, destination, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'no-route' });
  });

  it('returns no-route rather than throwing for malformed route sections', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse({
        routes: [
          { id: 'null-section', sections: [null] },
          { id: 'empty-section', sections: [{}] },
        ],
      }),
    );

    await expect(
      fetchHereWalkingRoute(origin, destination, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'no-route' });
  });

  it('aborts a hung provider fetch at its deadline', async () => {
    vi.useFakeTimers();
    vi.spyOn(providerResponseStore, 'get').mockResolvedValue(undefined);
    let providerSignal;
    const fetchImpl = vi.fn((_url, { signal } = {}) => {
      providerSignal = signal;
      return new Promise(() => {});
    });

    const request = fetchHereWalkingRoute(origin, destination, {
      apiKey,
      fetchImpl,
      timeoutMs: 1_000,
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(request).resolves.toEqual({ ok: false, reason: 'timeout' });
    expect(providerSignal.aborted).toBe(true);
  });

  it('caches permitted responses under a credential-free journey key', async () => {
    const put = vi.spyOn(providerResponseStore, 'put');
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse(walkingFixture, {
        headers: { 'cache-control': 'max-age=60' },
      }),
    );
    const options = { apiKey, fetchImpl, now: () => fetchedAt };

    const first = await fetchHereWalkingRoute(origin, destination, options);
    const second = await fetchHereWalkingRoute(origin, destination, options);

    expect(first.source).toBe('network');
    expect(second).toEqual({
      ok: true,
      route: normalizeHereWalking(walkingFixture),
      source: 'cache',
      fetchedAt,
      expiresAt: 70_000,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0]).toMatchObject({
      key: cacheKey,
      data: { route: normalizeHereWalking(walkingFixture) },
      fetchedAt,
      expiresAt: 70_000,
      staleUntil: 70_000,
    });
    expect(put.mock.calls[0][0].key).not.toContain(apiKey);
  });

  it.each([
    ['marked no-store', { 'cache-control': 'no-store' }],
    ['missing positive cache headers', undefined],
  ])('does not persist a response %s', async (_label, headers) => {
    const put = vi.spyOn(providerResponseStore, 'put');
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(hereResponse(walkingFixture, { headers }));

    await expect(
      fetchHereWalkingRoute(origin, destination, {
        apiKey,
        fetchImpl,
        now: () => fetchedAt,
      }),
    ).resolves.toMatchObject({
      ok: true,
      source: 'network',
      expiresAt: null,
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('returns the network result when cache reads and writes fail', async () => {
    vi.spyOn(providerResponseStore, 'get').mockRejectedValueOnce(
      new Error('IndexedDB unavailable'),
    );
    vi.spyOn(providerResponseStore, 'put').mockRejectedValueOnce(
      new Error('IndexedDB unavailable'),
    );
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse(walkingFixture, {
        headers: { 'cache-control': 'max-age=60' },
      }),
    );

    await expect(
      fetchHereWalkingRoute(origin, destination, {
        apiKey,
        fetchImpl,
        now: () => fetchedAt,
      }),
    ).resolves.toMatchObject({
      ok: true,
      source: 'network',
      fetchedAt,
      expiresAt: 70_000,
    });
  });
});
