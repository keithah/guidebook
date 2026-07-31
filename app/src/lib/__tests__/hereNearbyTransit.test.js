import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import departureFixture from '../../test/fixtures/here-departures.json';
import stationFixture from '../../test/fixtures/here-stations.json';
import {
  buildHereDeparturesUrl,
  buildHereStationsUrl,
  fetchHereNearbyTransit,
  joinNearbyStations,
  normalizeHereDepartureBoards,
  normalizeHereStations,
} from '../hereNearbyTransit.js';
import { resetRequestCoordinatorForTests } from '../requestCoordinator.js';
import { providerResponseStore } from '../responseStore.js';

const origin = { lat: 37.77154, lng: -122.41761 };
const apiKey = 'test-key-not-a-credential';
const fetchedAt = 10_000;

function hereResponse(payload, options = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: new Headers(options.headers),
    json: vi.fn().mockResolvedValue(payload),
  };
}

function successfulFetch(options = {}) {
  return vi
    .fn()
    .mockResolvedValueOnce(hereResponse(stationFixture, options.stations))
    .mockResolvedValueOnce(hereResponse(departureFixture, options.departures));
}

describe('HERE nearby transit URL builders', () => {
  it('builds a radius-limited station request with transport metadata', () => {
    const url = buildHereStationsUrl(origin, apiKey);

    expect(url.origin).toBe('https://transit.hereapi.com');
    expect(url.pathname).toBe('/v8/stations');
    expect(url.searchParams.get('in')).toBe(
      '37.77154,-122.41761;r=1200',
    );
    expect(url.searchParams.get('maxPlaces')).toBe('10');
    expect(url.searchParams.get('return')).toBe('transport');
    expect(url.searchParams.get('apiKey')).toBe(apiKey);
  });

  it('builds one departure request for the exact ordered member IDs', () => {
    const ids = ['3516_3408', 'platform-a', 'platform-b'];
    const url = buildHereDeparturesUrl(ids, apiKey);

    expect(url.origin).toBe('https://transit.hereapi.com');
    expect(url.pathname).toBe('/v8/departures');
    expect(url.searchParams.get('ids')).toBe(ids.join(','));
    expect(url.searchParams.get('timespan')).toBe('60');
    expect(url.searchParams.get('maxPerTransport')).toBe('2');
    expect(url.searchParams.get('sort')).toBe('transport');
    expect(url.searchParams.get('apiKey')).toBe(apiKey);
  });
});

describe('HERE nearby transit normalization', () => {
  it('drops malformed stations and sorts valid physical stations by Haversine distance', () => {
    const stations = normalizeHereStations(stationFixture, origin);

    expect(stations.map(({ id }) => id)).toEqual([
      'empty-board',
      '3516_3408',
      'same-name-east',
      'same-name-west',
      'civic-center',
      'sixth-nearest',
    ]);
    expect(stations.map(({ id }) => id)).not.toEqual(
      expect.arrayContaining([
        'invalid-location',
        'invalid-name',
        'invalid-transport',
      ]),
    );
    expect(stations[1].distanceMeters).toBeCloseTo(180, -1);
    expect(stations[1].distanceMeters).not.toBeCloseTo(145, -1);
  });

  it('groups only explicit physical parents and retains member and transport metadata', () => {
    const stations = normalizeHereStations(stationFixture, origin);
    const civicCenter = stations.find(({ id }) => id === 'civic-center');

    expect(civicCenter).toEqual({
      id: 'civic-center',
      memberIds: ['platform-a', 'platform-b'],
      name: 'Civic Center',
      position: { lat: 37.7795, lng: -122.4137 },
      distanceMeters: expect.any(Number),
      transports: [
        {
          mode: 'subway',
          shortName: 'Yellow',
          name: 'Yellow Line',
        },
        {
          mode: 'metro',
          shortName: 'K',
          name: 'K Ingleside',
          color: '#005B95',
          wheelchairAccessible: true,
        },
      ],
    });
    expect(
      stations.filter(({ name }) => name === 'Market Street').map(({ id }) => id),
    ).toEqual(['same-name-east', 'same-name-west']);
  });

  it('normalizes live and scheduled departures while rejecting unusable records', () => {
    const boards = normalizeHereDepartureBoards(departureFixture);
    const missionDepartures = boards.get('3516_3408');

    expect(boards).toBeInstanceOf(Map);
    expect(missionDepartures).toHaveLength(3);
    expect(
      missionDepartures.map(
        ({ scheduledTime, delaySeconds, isRealtime }) => ({
          scheduledTime,
          delaySeconds,
          isRealtime,
        }),
      ),
    ).toEqual([
      {
        scheduledTime: '2026-07-30T10:08:00-07:00',
        delaySeconds: 30,
        isRealtime: true,
      },
      {
        scheduledTime: '2026-07-30T10:03:00-07:00',
        delaySeconds: 0,
        isRealtime: true,
      },
      {
        scheduledTime: '2026-07-30T10:13:00-07:00',
        delaySeconds: null,
        isRealtime: false,
      },
    ]);
    expect(boards.get('empty-board')).toEqual([]);
  });

  it('joins member boards by operator, line, and headsign and keeps two effective departures', () => {
    const stations = normalizeHereStations(stationFixture, origin);
    const boards = normalizeHereDepartureBoards(departureFixture);
    const joined = joinNearbyStations(stations, boards);
    const mission = joined.find(({ id }) => id === '3516_3408');
    const civicCenter = joined.find(({ id }) => id === 'civic-center');

    expect(mission.services).toHaveLength(1);
    expect(mission.services[0]).toMatchObject({
      agency: { id: 'SFMTA', name: 'Muni' },
      transport: {
        mode: 'bus',
        shortName: '14',
        name: '14 Mission',
        color: '#C9413D',
      },
      headsign: 'Ferry Plaza',
      departures: [
        {
          scheduledTime: '2026-07-30T10:03:00-07:00',
          delaySeconds: 0,
          isRealtime: true,
        },
        {
          scheduledTime: '2026-07-30T10:08:00-07:00',
          delaySeconds: 30,
          isRealtime: true,
        },
      ],
    });
    expect(mission.services[0].key).toEqual(expect.any(String));
    expect(civicCenter.memberIds).toEqual(['platform-a', 'platform-b']);
    expect(civicCenter.services).toHaveLength(2);
    expect(civicCenter.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agency: { id: 'BART', name: 'Bay Area Rapid Transit' },
          transport: expect.objectContaining({ shortName: 'Yellow' }),
          headsign: 'Antioch',
        }),
        expect.objectContaining({
          agency: {
            id: 'SFMTA',
            name: 'San Francisco Municipal Transportation Agency',
          },
          transport: expect.objectContaining({ shortName: 'K' }),
          headsign: 'Balboa Park',
        }),
      ]),
    );
  });

  it('retains empty-board stations and caps joined results at five nearest stations', () => {
    const joined = joinNearbyStations(
      normalizeHereStations(stationFixture, origin),
      normalizeHereDepartureBoards(departureFixture),
    );

    expect(joined).toHaveLength(5);
    expect(joined.map(({ id }) => id)).not.toContain('sixth-nearest');
    const empty = joined.find(({ id }) => id === 'empty-board');
    expect(empty.services).toHaveLength(1);
    expect(empty.services[0].departures).toEqual([]);
  });

  it('uses agency ID with name as fallback so display-name variation cannot split a service', () => {
    const stationPayload = {
      stations: [
        {
          place: {
            id: 'member',
            name: 'One Stop',
            location: origin,
          },
          transports: [{ mode: 'bus', shortName: '14' }],
        },
      ],
    };
    const boardPayload = {
      boards: [
        {
          place: { id: 'member' },
          departures: [
            {
              time: '2026-07-30T10:03:00-07:00',
              agency: { id: 'SFMTA', name: 'Muni' },
              transport: { mode: 'bus', shortName: '14' },
            },
            {
              time: '2026-07-30T10:08:00-07:00',
              agency: {
                id: 'SFMTA',
                name: 'San Francisco Municipal Transportation Agency',
              },
              transport: { mode: 'bus', shortName: '14' },
            },
          ],
        },
      ],
    };

    const [joined] = joinNearbyStations(
      normalizeHereStations(stationPayload, origin),
      normalizeHereDepartureBoards(boardPayload),
    );

    expect(joined.services).toHaveLength(1);
    expect(joined.services[0].departures).toHaveLength(2);
  });
});

describe('fetchHereNearbyTransit', () => {
  beforeEach(async () => {
    resetRequestCoordinatorForTests();
    await providerResponseStore.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetches stations then every normalized member ID and returns joined data', async () => {
    const fetchImpl = successfulFetch({
      stations: { headers: { 'cache-control': 'no-store' } },
      departures: { headers: { 'cache-control': 'no-store' } },
    });

    const result = await fetchHereNearbyTransit(origin, {
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(result).toMatchObject({
      ok: true,
      stations: expect.any(Array),
      source: 'network',
      fetchedAt,
      expiresAt: null,
    });
    expect(result.stations).toHaveLength(5);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0].searchParams.get('ids')).toBe(
      'empty-board,3516_3408,same-name-east,same-name-west,platform-a,platform-b,sixth-nearest',
    );
  });

  it('returns and caches an empty station result without requesting departures', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse(
        { stations: [] },
        { headers: { 'cache-control': 'max-age=60' } },
      ),
    );

    const result = await fetchHereNearbyTransit(origin, {
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(result).toEqual({
      ok: true,
      stations: [],
      source: 'network',
      fetchedAt,
      expiresAt: 70_000,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await providerResponseStore.get('here-nearby:37.772,-122.418')).toMatchObject({
      data: { stations: [] },
      expiresAt: 70_000,
    });
  });

  it('does not persist an empty station result when no-store prohibits caching', async () => {
    const put = vi.spyOn(providerResponseStore, 'put');
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse(
        { stations: [] },
        { headers: { 'cache-control': 'no-store' } },
      ),
    );

    await expect(
      fetchHereNearbyTransit(origin, {
        apiKey,
        fetchImpl,
        now: () => fetchedAt,
      }),
    ).resolves.toEqual({
      ok: true,
      stations: [],
      source: 'network',
      fetchedAt,
      expiresAt: null,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(put).not.toHaveBeenCalled();
  });

  it.each([
    ['', origin, 'missing-api-key'],
    [apiKey, { lat: Number.NaN, lng: origin.lng }, 'invalid-request'],
    [apiKey, { lat: origin.lat, lng: Number.POSITIVE_INFINITY }, 'invalid-request'],
    [apiKey, undefined, 'invalid-request'],
  ])(
    'rejects invalid key/origin before storage or network work',
    async (candidateKey, candidateOrigin, reason) => {
      const get = vi.spyOn(providerResponseStore, 'get');
      const fetchImpl = vi.fn();

      await expect(
        fetchHereNearbyTransit(candidateOrigin, {
          apiKey: candidateKey,
          fetchImpl,
        }),
      ).resolves.toEqual({ ok: false, reason });
      expect(get).not.toHaveBeenCalled();
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('does no storage or network work for an already-aborted caller', async () => {
    const controller = new AbortController();
    controller.abort();
    const get = vi.spyOn(providerResponseStore, 'get');
    const fetchImpl = vi.fn();

    await expect(
      fetchHereNearbyTransit(origin, {
        apiKey,
        fetchImpl,
        signal: controller.signal,
      }),
    ).resolves.toEqual({ ok: false, reason: 'aborted' });
    expect(get).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'rate-limited'],
    [500, 'network'],
  ])('maps HTTP %i from either request to %s', async (status, reason) => {
    const stationFailure = vi
      .fn()
      .mockResolvedValue(hereResponse(undefined, { ok: false, status }));
    await expect(
      fetchHereNearbyTransit(origin, { apiKey, fetchImpl: stationFailure }),
    ).resolves.toEqual({ ok: false, reason });

    resetRequestCoordinatorForTests();
    const departureFailure = vi
      .fn()
      .mockResolvedValueOnce(hereResponse(stationFixture))
      .mockResolvedValueOnce(
        hereResponse(undefined, { ok: false, status }),
      );
    await expect(
      fetchHereNearbyTransit(origin, { apiKey, fetchImpl: departureFailure }),
    ).resolves.toEqual({ ok: false, reason });
  });

  it.each([
    ['AbortError', 'aborted'],
    ['TypeError', 'network'],
  ])('maps a %s from either fetch to %s', async (name, reason) => {
    const error = new Error('synthetic provider failure');
    error.name = name;
    const fetchImpl = vi.fn().mockRejectedValue(error);

    await expect(
      fetchHereNearbyTransit(origin, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason });
  });

  it.each([
    ['AbortError', 'aborted'],
    ['TypeError', 'network'],
  ])(
    'maps a rejected %s departure fetch after a successful station fetch to %s',
    async (name, reason) => {
      const error = new Error('synthetic departure failure');
      error.name = name;
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(hereResponse(stationFixture))
        .mockRejectedValueOnce(error);

      await expect(
        fetchHereNearbyTransit(origin, { apiKey, fetchImpl }),
      ).resolves.toEqual({ ok: false, reason });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    },
  );

  it('maps malformed JSON from either response to invalid-response', async () => {
    const stationResponse = hereResponse(stationFixture);
    stationResponse.json.mockRejectedValue(new SyntaxError('broken stations'));
    await expect(
      fetchHereNearbyTransit(origin, {
        apiKey,
        fetchImpl: vi.fn().mockResolvedValue(stationResponse),
      }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-response' });

    resetRequestCoordinatorForTests();
    const departureResponse = hereResponse(departureFixture);
    departureResponse.json.mockRejectedValue(
      new SyntaxError('broken departures'),
    );
    await expect(
      fetchHereNearbyTransit(origin, {
        apiKey,
        fetchImpl: vi
          .fn()
          .mockResolvedValueOnce(hereResponse(stationFixture))
          .mockResolvedValueOnce(departureResponse),
      }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });

  it('rejects a cacheable HTTP-200 station body without a stations array', async () => {
    const put = vi.spyOn(providerResponseStore, 'put');
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse(
        { stations: null },
        { headers: { 'cache-control': 'max-age=60' } },
      ),
    );

    await expect(
      fetchHereNearbyTransit(origin, {
        apiKey,
        fetchImpl,
        now: () => fetchedAt,
      }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-response' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(put).not.toHaveBeenCalled();
  });

  it('rejects a cacheable HTTP-200 departure body without a boards array', async () => {
    const put = vi.spyOn(providerResponseStore, 'put');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        hereResponse(stationFixture, {
          headers: { 'cache-control': 'max-age=60' },
        }),
      )
      .mockResolvedValueOnce(
        hereResponse(
          { boards: {} },
          { headers: { 'cache-control': 'max-age=60' } },
        ),
      );

    await expect(
      fetchHereNearbyTransit(origin, {
        apiKey,
        fetchImpl,
        now: () => fetchedAt,
      }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-response' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(put).not.toHaveBeenCalled();
  });

  it('times out the whole two-request loader and aborts its active fetch', async () => {
    vi.useFakeTimers();
    let providerSignal;
    const fetchImpl = vi.fn((_url, { signal }) => {
      providerSignal = signal;
      return new Promise(() => {});
    });

    const request = fetchHereNearbyTransit(origin, {
      apiKey,
      fetchImpl,
      timeoutMs: 1_000,
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(request).resolves.toEqual({ ok: false, reason: 'timeout' });
    expect(providerSignal.aborted).toBe(true);
  });

  it.each([
    ['stations', 'no-store', 'max-age=120'],
    ['departures', 'max-age=120', 'no-store'],
  ])(
    'does not persist when the %s response prohibits storage',
    async (_responseName, stationCache, departureCache) => {
      const put = vi.spyOn(providerResponseStore, 'put');
      const fetchImpl = successfulFetch({
        stations: { headers: { 'cache-control': stationCache } },
        departures: { headers: { 'cache-control': departureCache } },
      });

      const result = await fetchHereNearbyTransit(origin, {
        apiKey,
        fetchImpl,
        now: () => fetchedAt,
      });

      expect(result.expiresAt).toBeNull();
      expect(put).not.toHaveBeenCalled();
    },
  );

  it('persists normalized results only through the earlier common expiry', async () => {
    const put = vi.spyOn(providerResponseStore, 'put');
    const fetchImpl = successfulFetch({
      stations: { headers: { 'cache-control': 'max-age=120' } },
      departures: { headers: { 'cache-control': 'max-age=60' } },
    });

    const result = await fetchHereNearbyTransit(origin, {
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(result.expiresAt).toBe(70_000);
    expect(put).toHaveBeenCalledTimes(1);
    const entry = put.mock.calls[0][0];
    expect(entry).toEqual({
      key: 'here-nearby:37.772,-122.418',
      data: { stations: result.stations },
      fetchedAt,
      expiresAt: 70_000,
      staleUntil: 70_000,
    });
    expect(JSON.stringify(entry)).not.toContain(apiKey);
    expect(entry).not.toHaveProperty('rawUrl');
  });

  it('serves a fresh cache entry without either network request', async () => {
    const stations = joinNearbyStations(
      normalizeHereStations(stationFixture, origin),
      normalizeHereDepartureBoards(departureFixture),
    );
    await providerResponseStore.put({
      key: 'here-nearby:37.772,-122.418',
      data: { stations },
      fetchedAt,
      expiresAt: 70_000,
      staleUntil: 70_000,
    });
    const fetchImpl = vi.fn();

    await expect(
      fetchHereNearbyTransit(origin, {
        apiKey,
        fetchImpl,
        now: () => 20_000,
      }),
    ).resolves.toEqual({
      ok: true,
      stations,
      source: 'cache',
      fetchedAt,
      expiresAt: 70_000,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rechecks cache expiry after an asynchronous response-store lookup', async () => {
    let resolveCache;
    vi.spyOn(providerResponseStore, 'get').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCache = resolve;
        }),
    );
    let currentTime = 20_000;
    const fetchImpl = successfulFetch({
      stations: { headers: { 'cache-control': 'no-store' } },
      departures: { headers: { 'cache-control': 'no-store' } },
    });
    const request = fetchHereNearbyTransit(origin, {
      apiKey,
      fetchImpl,
      now: () => currentTime,
    });
    await vi.waitFor(() => expect(resolveCache).toEqual(expect.any(Function)));

    currentTime = 80_000;
    resolveCache({
      key: 'here-nearby:37.772,-122.418',
      data: { stations: [{ id: 'expired-during-lookup' }] },
      fetchedAt,
      expiresAt: 70_000,
      staleUntil: 70_000,
    });

    const result = await request;
    expect(result).toMatchObject({ ok: true, source: 'network' });
    expect(result.stations).not.toContainEqual({ id: 'expired-during-lookup' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns aborted when the caller cancels during a response-store lookup', async () => {
    let resolveCache;
    vi.spyOn(providerResponseStore, 'get').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCache = resolve;
        }),
    );
    const controller = new AbortController();
    const fetchImpl = vi.fn();
    const request = fetchHereNearbyTransit(origin, {
      apiKey,
      fetchImpl,
      signal: controller.signal,
      now: () => 20_000,
    });
    await vi.waitFor(() => expect(resolveCache).toEqual(expect.any(Function)));

    controller.abort();
    resolveCache({
      key: 'here-nearby:37.772,-122.418',
      data: { stations: [{ id: 'still-fresh' }] },
      fetchedAt,
      expiresAt: 70_000,
      staleUntil: 70_000,
    });

    await expect(request).resolves.toEqual({ ok: false, reason: 'aborted' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('deletes an expired cache entry and never returns it', async () => {
    const staleStations = [{ id: 'stale-station' }];
    await providerResponseStore.put({
      key: 'here-nearby:37.772,-122.418',
      data: { stations: staleStations },
      fetchedAt: 1_000,
      expiresAt: 2_000,
      staleUntil: 2_000,
    });
    const remove = vi.spyOn(providerResponseStore, 'delete');
    const fetchImpl = successfulFetch({
      stations: { headers: { 'cache-control': 'no-store' } },
      departures: { headers: { 'cache-control': 'no-store' } },
    });

    const result = await fetchHereNearbyTransit(origin, {
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(remove).toHaveBeenCalledWith('here-nearby:37.772,-122.418');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: true, source: 'network' });
    expect(result.stations).not.toEqual(staleStations);
  });
});
