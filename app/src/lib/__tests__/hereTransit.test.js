import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import fixture from '../../test/fixtures/here-transit.json';
import {
  buildHereTransitUrl,
  fetchHereTransitRoutes,
  normalizeHereRoutes,
} from '../hereTransit.js';
import { resetRequestCoordinatorForTests } from '../requestCoordinator.js';
import { providerResponseStore } from '../responseStore.js';

const origin = { lat: 37.7401, lng: -122.4661 };
const destination = { lat: 37.7879, lng: -122.4075 };
const apiKey = 'test-key-not-a-credential';
const departureTime = new Date('2026-07-28T18:00:00.000Z');
const plannedAt = departureTime.toISOString();
const fetchedAt = 10_000;

function hereResponse(payload = fixture, options = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: new Headers(options.headers),
    json: vi.fn().mockResolvedValue(payload),
  };
}

describe('normalizeHereRoutes', () => {
  it('normalizes route summary values and preserves section order', () => {
    const trips = normalizeHereRoutes(fixture, plannedAt);

    expect(trips[0]).toMatchObject({
      id: 'route-k',
      departureTime: '2026-07-28T18:00:00-07:00',
      arrivalTime: '2026-07-28T18:30:00-07:00',
      durationSeconds: 1800,
      transferCount: 0,
      walkingDurationSeconds: 660,
      lines: [{ name: 'K Ingleside', headsign: 'Embarcadero' }],
      plannedAt,
    });
    expect(trips[0].sections.map((section) => section.type)).toEqual([
      'pedestrian',
      'transit',
      'pedestrian',
    ]);
    expect(trips[1]).toMatchObject({
      id: 'route-transfer',
      departureTime: '2026-07-28T18:02:00-07:00',
      arrivalTime: '2026-07-28T18:29:00-07:00',
      durationSeconds: 1620,
      transferCount: 1,
      walkingDurationSeconds: 420,
      lines: [
        { name: 'N Judah', headsign: 'Caltrain' },
        { name: '38R Geary Rapid', headsign: 'Transit Center' },
      ],
      plannedAt,
    });
  });

  it('normalizes stops, platforms, intermediate stops, notices, and incidents', () => {
    const [trip] = normalizeHereRoutes(fixture, plannedAt);
    const transit = trip.sections[1];

    expect(transit).toMatchObject({
      id: 'route-k-ride',
      type: 'transit',
      departureTime: '2026-07-28T18:07:00-07:00',
      arrivalTime: '2026-07-28T18:24:00-07:00',
      durationSeconds: 1020,
      departure: {
        name: 'West Portal Station',
        id: 'west-portal',
        platform: '2',
        stopCode: '17217',
      },
      arrival: {
        name: 'Montgomery Street Station',
        id: 'montgomery',
        platform: 'Inbound',
        stopCode: 'MONT',
      },
      transport: {
        mode: 'lightRail',
        name: 'K Ingleside',
        shortName: 'K',
        headsign: 'Embarcadero',
      },
      agency: {
        id: 'SFMTA',
        name: 'San Francisco Municipal Transportation Agency',
      },
      intermediateStops: [
        {
          name: 'Forest Hill Station',
          platform: '2',
          stopCode: 'FH',
          departureTime: '2026-07-28T18:11:00-07:00',
        },
        {
          name: 'Castro Station',
          platform: 'Inbound',
          stopCode: 'CAST',
          departureTime: '2026-07-28T18:17:00-07:00',
        },
      ],
      notices: [
        {
          code: 'scheduledTimes',
          title: 'Times shown are scheduled',
          severity: 'info',
        },
      ],
      incidents: [
        {
          type: 'technicalProblem',
          effect: 'modifiedService',
          summary: 'K line boarding platform changed',
          description: 'Board from platform 2 at West Portal.',
          validFrom: '2026-07-28T17:30:00-07:00',
          validUntil: '2026-07-28T20:00:00-07:00',
          url: 'https://www.sfmta.com/alerts/k-platform',
        },
      ],
    });
    expect(trip.notices).toEqual([
      {
        code: 'excessiveWaitingTime',
        title: 'Allow extra time at West Portal',
        severity: 'info',
      },
      {
        code: 'scheduledTimes',
        title: 'Times shown are scheduled',
        severity: 'info',
      },
    ]);
  });

  it('keeps pre, travel, and post actions in instruction order', () => {
    const [trip] = normalizeHereRoutes(fixture, plannedAt);

    expect(trip.sections[0].actions.map((action) => action.instruction)).toEqual(
      [
        'Leave SF Cottage toward Ulloa Street.',
        'Turn right onto West Portal Avenue.',
        'Arrive at West Portal Station.',
      ],
    );
    expect(trip.sections[1].actions).toEqual([
      {
        type: 'board',
        instruction: 'Board the K Ingleside toward Embarcadero.',
        durationSeconds: 0,
      },
      {
        type: 'deboard',
        instruction: 'Leave the train at Montgomery Street.',
        durationSeconds: 0,
      },
    ]);
    expect(trip.sections[0].actions[1]).toMatchObject({
      type: 'turn',
      durationSeconds: 180,
      lengthMeters: 220,
      offset: 2,
      direction: 'right',
    });
  });

  it('retains unknown sections and actions as generic instructions', () => {
    const trips = normalizeHereRoutes(fixture, plannedAt);

    expect(trips[2].sections).toEqual([
      {
        type: 'unknown',
        label: 'Gondola portal',
        instruction: 'Step into the transfer portal.',
      },
    ]);

    const payloadWithUnknownAction = structuredClone(fixture);
    payloadWithUnknownAction.routes[0].sections[0].actions.splice(1, 0, {
      action: 'moonwalk',
      duration: 5,
      instruction: 'Moonwalk across the plaza.',
    });
    const [trip] = normalizeHereRoutes(payloadWithUnknownAction, plannedAt);
    expect(trip.sections[0].actions[1]).toEqual({
      type: 'unknown',
      label: 'Moonwalk',
      instruction: 'Moonwalk across the plaza.',
    });
  });

  it('drops a purely pedestrian alternative only when transit is available', () => {
    const pedestrianRoute = {
      id: 'walk-only',
      sections: [fixture.routes[0].sections[0]],
    };

    expect(
      normalizeHereRoutes(
        { routes: [pedestrianRoute, ...fixture.routes] },
        plannedAt,
      ).map((trip) => trip.id),
    ).toEqual(['route-k', 'route-transfer', 'route-future-mode']);
    expect(
      normalizeHereRoutes({ routes: [pedestrianRoute] }, plannedAt),
    ).toHaveLength(1);
  });

  it('returns an empty collection for malformed route payloads', () => {
    expect(normalizeHereRoutes(undefined, plannedAt)).toEqual([]);
    expect(normalizeHereRoutes({ routes: null }, plannedAt)).toEqual([]);
  });
});

describe('buildHereTransitUrl', () => {
  it('builds a three-option English imperial public transit request', () => {
    const url = buildHereTransitUrl(
      origin,
      destination,
      departureTime,
      apiKey,
    );

    expect(url.origin).toBe('https://transit.router.hereapi.com');
    expect(url.pathname).toBe('/v8/routes');
    expect(url.searchParams.get('origin')).toBe('37.7401,-122.4661');
    expect(url.searchParams.get('destination')).toBe('37.7879,-122.4075');
    expect(url.searchParams.get('departureTime')).toBe(plannedAt);
    expect(url.searchParams.get('alternatives')).toBe('2');
    expect(url.searchParams.get('units')).toBe('imperial');
    expect(url.searchParams.get('lang')).toBe('en-US');
    expect(url.searchParams.get('return')).toBe(
      'intermediate,actions,travelSummary,incidents,sourceFeedMapping',
    );
    expect(url.searchParams.get('apiKey')).toBe(apiKey);
  });
});

describe('fetchHereTransitRoutes', () => {
  beforeEach(async () => {
    resetRequestCoordinatorForTests();
    await providerResponseStore.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns normalized routes from the network', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse(fixture, { headers: { 'cache-control': 'no-store' } }),
    );

    await expect(
      fetchHereTransitRoutes(origin, destination, {
        departureTime,
        apiKey,
        fetchImpl,
        now: () => fetchedAt,
      }),
    ).resolves.toEqual({
      ok: true,
      trips: normalizeHereRoutes(fixture, plannedAt),
      source: 'network',
      fetchedAt,
      expiresAt: null,
    });
  });

  it('rejects a missing API key without fetching', async () => {
    const fetchImpl = vi.fn();

    await expect(
      fetchHereTransitRoutes(origin, destination, { apiKey: '', fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'missing-api-key' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

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
      fetchHereTransitRoutes(origin, destination, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason });
  });

  it('maps AbortError to aborted', async () => {
    const error = new Error('request aborted');
    error.name = 'AbortError';
    const fetchImpl = vi.fn().mockRejectedValue(error);

    await expect(
      fetchHereTransitRoutes(origin, destination, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'aborted' });
  });

  it('maps other fetch failures to network', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('offline'));

    await expect(
      fetchHereTransitRoutes(origin, destination, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'network' });
  });

  it('maps malformed JSON to invalid-response', async () => {
    const response = hereResponse();
    response.json.mockRejectedValue(new SyntaxError('invalid JSON'));
    const fetchImpl = vi.fn().mockResolvedValue(response);

    await expect(
      fetchHereTransitRoutes(origin, destination, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });

  it('maps an abort while reading the response body to aborted', async () => {
    const error = new Error('response body aborted');
    error.name = 'AbortError';
    const response = hereResponse();
    response.json.mockRejectedValue(error);
    const fetchImpl = vi.fn().mockResolvedValue(response);

    await expect(
      fetchHereTransitRoutes(origin, destination, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'aborted' });
  });

  it('returns no-route for an empty or invalid routes collection', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(hereResponse({ routes: [] }))
      .mockResolvedValueOnce(hereResponse({ routes: null }));

    await expect(
      fetchHereTransitRoutes(origin, destination, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'no-route' });
    resetRequestCoordinatorForTests();
    await expect(
      fetchHereTransitRoutes(origin, destination, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'no-route' });
  });

  it('does not persist a response marked no-store or without positive caching headers', async () => {
    const put = vi.spyOn(providerResponseStore, 'put');
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        hereResponse(fixture, { headers: { 'cache-control': 'no-store' } }),
      )
      .mockResolvedValueOnce(hereResponse(fixture));

    await fetchHereTransitRoutes(origin, destination, {
      departureTime,
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });
    resetRequestCoordinatorForTests();
    await fetchHereTransitRoutes(origin, destination, {
      departureTime: new Date(departureTime.getTime() + 1_000),
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(put).not.toHaveBeenCalled();
  });

  it('uses the network when persistent storage operations fail', async () => {
    vi.spyOn(providerResponseStore, 'get').mockRejectedValueOnce(
      new Error('IndexedDB unavailable'),
    );
    vi.spyOn(providerResponseStore, 'put').mockRejectedValue(
      new Error('IndexedDB unavailable'),
    );
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse(fixture, { headers: { 'cache-control': 'max-age=60' } }),
    );

    const result = await fetchHereTransitRoutes(origin, destination, {
      departureTime,
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(result).toMatchObject({
      ok: true,
      source: 'network',
      expiresAt: 70_000,
    });
  });

  it('persists permitted responses, reuses them, and deletes them after expiry', async () => {
    const put = vi.spyOn(providerResponseStore, 'put');
    const remove = vi.spyOn(providerResponseStore, 'delete');
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse(fixture, { headers: { 'cache-control': 'max-age=60' } }),
    );
    let currentTime = fetchedAt;
    const options = {
      departureTime,
      apiKey,
      fetchImpl,
      now: () => currentTime,
    };

    const first = await fetchHereTransitRoutes(origin, destination, options);
    const second = await fetchHereTransitRoutes(origin, destination, options);

    expect(first.source).toBe('network');
    expect(second).toEqual({
      ok: true,
      trips: normalizeHereRoutes(fixture, plannedAt),
      source: 'cache',
      fetchedAt,
      expiresAt: 70_000,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    const entry = put.mock.calls[0][0];
    expect(entry.key).toBe(
      'here-transit:37.7401,-122.4661:37.7879,-122.4075:2026-07-28T18%3A00%3A00.000Z',
    );
    expect(entry.key).not.toContain(apiKey);
    expect(entry.data).toEqual({ trips: normalizeHereRoutes(fixture, plannedAt) });
    expect(entry).not.toHaveProperty('rawUrl');

    currentTime = 70_001;
    await fetchHereTransitRoutes(origin, destination, options);

    expect(remove).toHaveBeenCalledWith(entry.key);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('continues to the network when deleting an expired entry fails', async () => {
    vi.spyOn(providerResponseStore, 'get').mockResolvedValue({
      key: 'expired',
      data: { trips: normalizeHereRoutes(fixture, plannedAt) },
      fetchedAt: 1_000,
      expiresAt: 2_000,
      staleUntil: 2_000,
    });
    vi.spyOn(providerResponseStore, 'delete').mockRejectedValue(
      new Error('IndexedDB unavailable'),
    );
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse(fixture, { headers: { 'cache-control': 'no-store' } }),
    );

    const result = await fetchHereTransitRoutes(origin, destination, {
      departureTime,
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(result).toMatchObject({ ok: true, source: 'network' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent route requests', async () => {
    let resolveResponse;
    const fetchImpl = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );
    const options = { departureTime, apiKey, fetchImpl, now: () => fetchedAt };
    const first = fetchHereTransitRoutes(origin, destination, options);
    const second = fetchHereTransitRoutes(origin, destination, options);

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    resolveResponse(hereResponse());

    expect(await first).toEqual(await second);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('isolates each caller abort from a shared request', async () => {
    let resolveResponse;
    const fetchImpl = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );
    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = fetchHereTransitRoutes(origin, destination, {
      departureTime,
      apiKey,
      fetchImpl,
      signal: firstController.signal,
      now: () => fetchedAt,
    });
    const second = fetchHereTransitRoutes(origin, destination, {
      departureTime,
      apiKey,
      fetchImpl,
      signal: secondController.signal,
      now: () => fetchedAt,
    });

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    secondController.abort();
    resolveResponse(hereResponse());

    await expect(second).resolves.toEqual({ ok: false, reason: 'aborted' });
    await expect(first).resolves.toMatchObject({ ok: true, source: 'network' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not start work for an already-aborted caller', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn();

    await expect(
      fetchHereTransitRoutes(origin, destination, {
        departureTime,
        apiKey,
        fetchImpl,
        signal: controller.signal,
      }),
    ).resolves.toEqual({ ok: false, reason: 'aborted' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('aborts a hung shared route fetch at its deadline and allows a fresh retry', async () => {
    vi.useFakeTimers();
    vi.spyOn(providerResponseStore, 'get').mockResolvedValue(undefined);
    let firstSignal;
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce((_url, { signal } = {}) => {
        firstSignal = signal;
        return new Promise(() => {});
      })
      .mockResolvedValueOnce(hereResponse());

    const first = fetchHereTransitRoutes(origin, destination, {
      departureTime,
      apiKey,
      fetchImpl,
      timeoutMs: 1_000,
      now: () => fetchedAt,
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(first).resolves.toEqual({ ok: false, reason: 'timeout' });
    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal.aborted).toBe(true);

    const retry = fetchHereTransitRoutes(origin, destination, {
      departureTime,
      apiKey,
      fetchImpl,
      timeoutMs: 1_000,
      now: () => fetchedAt,
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    await expect(retry).resolves.toMatchObject({
      ok: true,
      source: 'network',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
