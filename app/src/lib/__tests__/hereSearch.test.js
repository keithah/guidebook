import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import fixture from '../../test/fixtures/here-geocode.json';
import {
  buildHereSearchUrl,
  isAddressDestination,
  normalizeHereCandidates,
  searchHereDestinations,
} from '../hereSearch.js';
import { resetRequestCoordinatorForTests } from '../requestCoordinator.js';
import { providerResponseStore } from '../responseStore.js';

const center = { lat: 37.7879, lng: -122.4075 };
const apiKey = 'test-key-not-a-credential';
const fetchedAt = 10_000;

function hereResponse(payload = fixture, options = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: new Headers(options.headers),
    json: vi.fn().mockResolvedValue(payload),
  };
}

describe('normalizeHereCandidates', () => {
  it('keeps only address and locality result types with valid coordinates', () => {
    const candidates = normalizeHereCandidates(fixture);

    expect(candidates.map(({ resultType }) => resultType)).toEqual([
      'houseNumber',
      'street',
      'intersection',
      'postalCodePoint',
      'locality',
      'administrativeArea',
    ]);
    expect(candidates.map(({ id }) => id)).not.toContain(
      'here:pds:place:coffee-shop',
    );
    expect(candidates.every(({ categories }) => categories.length === 0)).toBe(
      true,
    );
    expect(candidates[0]).toEqual({
      id: 'here:af:houseNumber:1620-howard',
      title: '1620 Howard St',
      address: '1620 Howard St, San Francisco, CA 94103, United States',
      position: { lat: 37.77154, lng: -122.41761 },
      resultType: 'houseNumber',
      categories: [],
      distanceMeters: 25,
    });
    expect(candidates[1].distanceMeters).toBeNull();
  });

  it('normalizes an address-block result as an address destination', () => {
    expect(
      normalizeHereCandidates({
        items: [
          {
            id: 'here:af:addressBlock:mission',
            title: 'Mission District',
            address: { label: 'Mission District, San Francisco, CA' },
            position: { lat: 37.75993, lng: -122.41808 },
            resultType: 'addressBlock',
          },
        ],
      }),
    ).toEqual([
      {
        id: 'here:af:addressBlock:mission',
        title: 'Mission District',
        address: 'Mission District, San Francisco, CA',
        position: { lat: 37.75993, lng: -122.41808 },
        resultType: 'addressBlock',
        categories: [],
        distanceMeters: null,
      },
    ]);
  });

  it.each([
    ['address', false],
    ['addressBlock', true],
    ['houseNumber', true],
    ['street', true],
    ['intersection', true],
    ['postalCodePoint', true],
    ['locality', true],
    ['administrativeArea', true],
    ['place', false],
    ['airport', false],
    [undefined, false],
  ])('classifies %s as an address destination: %s', (resultType, accepted) => {
    expect(isAddressDestination({ resultType })).toBe(accepted);
  });
});

describe('buildHereSearchUrl', () => {
  it('builds a centered, limited English HERE Geocode request', () => {
    const url = buildHereSearchUrl(
      'Mission District, San Francisco, CA',
      { lat: 37.77154, lng: -122.41761 },
      apiKey,
    );

    expect(url.origin).toBe('https://geocode.search.hereapi.com');
    expect(url.pathname).toBe('/v1/geocode');
    expect(url.searchParams.get('q')).toBe(
      'Mission District, San Francisco, CA',
    );
    expect(url.searchParams.get('at')).toBe('37.77154,-122.41761');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('lang')).toBe('en-US');
    expect(url.searchParams.get('apiKey')).toBe(apiKey);
  });
});

describe('searchHereDestinations', () => {
  beforeEach(async () => {
    resetRequestCoordinatorForTests();
    await providerResponseStore.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns normalized candidates from the network', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        hereResponse(fixture, { headers: { 'cache-control': 'no-store' } }),
      );

    const result = await searchHereDestinations('  Union Square  ', center, {
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(result).toEqual({
      ok: true,
      candidates: normalizeHereCandidates(fixture).slice(0, 5),
      source: 'network',
      fetchedAt,
      expiresAt: null,
    });
    const [requestUrl] = fetchImpl.mock.calls[0];
    expect(requestUrl.searchParams.get('q')).toBe('Union Square');
  });

  it('treats an empty candidate list as a successful search', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(hereResponse({ items: [] }));

    await expect(
      searchHereDestinations('nowhere', center, {
        apiKey,
        fetchImpl,
        now: () => fetchedAt,
      }),
    ).resolves.toEqual({
      ok: true,
      candidates: [],
      source: 'network',
      fetchedAt,
      expiresAt: null,
    });
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
      searchHereDestinations('coffee', center, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason });
  });

  it('maps AbortError to aborted', async () => {
    const error = new Error('request aborted');
    error.name = 'AbortError';
    const fetchImpl = vi.fn().mockRejectedValue(error);

    await expect(
      searchHereDestinations('coffee', center, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'aborted' });
  });

  it('maps other fetch failures to network', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('offline'));

    await expect(
      searchHereDestinations('coffee', center, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'network' });
  });

  it('maps malformed JSON to invalid-response', async () => {
    const response = hereResponse();
    response.json.mockRejectedValue(new SyntaxError('invalid JSON'));
    const fetchImpl = vi.fn().mockResolvedValue(response);

    await expect(
      searchHereDestinations('coffee', center, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });

  it('maps an abort while reading the response body to aborted', async () => {
    const error = new Error('response body aborted');
    error.name = 'AbortError';
    const response = hereResponse();
    response.json.mockRejectedValue(error);
    const fetchImpl = vi.fn().mockResolvedValue(response);

    await expect(
      searchHereDestinations('coffee', center, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'aborted' });
  });

  it('rejects a missing API key without fetching', async () => {
    const fetchImpl = vi.fn();

    await expect(
      searchHereDestinations('coffee', center, { apiKey: '', fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'missing-api-key' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects an empty trimmed query without fetching', async () => {
    const fetchImpl = vi.fn();

    await expect(
      searchHereDestinations('   ', center, { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'empty-query' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [{ lat: Number.NaN, lng: center.lng }],
    [{ lat: center.lat, lng: Number.POSITIVE_INFINITY }],
    [undefined],
  ])(
    'rejects an invalid search center without storage or network work',
    async (invalidCenter) => {
      const get = vi.spyOn(providerResponseStore, 'get');
      const fetchImpl = vi.fn();

      await expect(
        searchHereDestinations('coffee', invalidCenter, { apiKey, fetchImpl }),
      ).resolves.toEqual({ ok: false, reason: 'invalid-request' });
      expect(get).not.toHaveBeenCalled();
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('does not start work for an already-aborted caller', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn();

    await expect(
      searchHereDestinations('coffee', center, {
        apiKey,
        fetchImpl,
        signal: controller.signal,
      }),
    ).resolves.toEqual({ ok: false, reason: 'aborted' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not persist a response marked no-store', async () => {
    const put = vi.spyOn(providerResponseStore, 'put');
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        hereResponse(fixture, { headers: { 'cache-control': 'no-store' } }),
      );

    await searchHereDestinations('coffee', center, {
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(put).not.toHaveBeenCalled();
  });

  it('uses the network when reading the persistent cache fails', async () => {
    vi.spyOn(providerResponseStore, 'get').mockRejectedValue(
      new Error('IndexedDB unavailable'),
    );
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        hereResponse(fixture, { headers: { 'cache-control': 'no-store' } }),
      );

    const result = await searchHereDestinations('coffee', center, {
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(result).toEqual({
      ok: true,
      candidates: normalizeHereCandidates(fixture).slice(0, 5),
      source: 'network',
      fetchedAt,
      expiresAt: null,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('uses the network when deleting an expired cache entry fails', async () => {
    vi.spyOn(providerResponseStore, 'get').mockResolvedValue({
      key: 'here-geocode:coffee:37.788,-122.408',
      data: { candidates: [] },
      fetchedAt: 1_000,
      expiresAt: 2_000,
      staleUntil: 2_000,
    });
    vi.spyOn(providerResponseStore, 'delete').mockRejectedValue(
      new Error('IndexedDB unavailable'),
    );
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        hereResponse(fixture, { headers: { 'cache-control': 'no-store' } }),
      );

    const result = await searchHereDestinations('coffee', center, {
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(result).toEqual({
      ok: true,
      candidates: normalizeHereCandidates(fixture).slice(0, 5),
      source: 'network',
      fetchedAt,
      expiresAt: null,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns network candidates when persistent cache writes fail', async () => {
    vi.spyOn(providerResponseStore, 'put').mockRejectedValue(
      new Error('IndexedDB unavailable'),
    );
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        hereResponse(fixture, { headers: { 'cache-control': 'max-age=60' } }),
      );

    const result = await searchHereDestinations('coffee', center, {
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(result).toEqual({
      ok: true,
      candidates: normalizeHereCandidates(fixture).slice(0, 5),
      source: 'network',
      fetchedAt,
      expiresAt: 70_000,
    });
  });

  it('persists normalized max-age responses and reuses a fresh cache entry', async () => {
    const put = vi.spyOn(providerResponseStore, 'put');
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        hereResponse(fixture, { headers: { 'cache-control': 'max-age=60' } }),
      );
    const options = { apiKey, fetchImpl, now: () => fetchedAt };

    const first = await searchHereDestinations('coffee', center, options);
    const second = await searchHereDestinations('coffee', center, options);

    expect(first.source).toBe('network');
    expect(second).toEqual({
      ok: true,
      candidates: normalizeHereCandidates(fixture).slice(0, 5),
      source: 'cache',
      fetchedAt,
      expiresAt: 70_000,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    const entry = put.mock.calls[0][0];
    expect(entry.key).toBe('here-geocode:coffee:37.788,-122.408');
    expect(entry.key).not.toContain(apiKey);
    expect(entry.data).toEqual({
      candidates: normalizeHereCandidates(fixture).slice(0, 5),
    });
    expect(entry).not.toHaveProperty('rawUrl');
  });

  it('deduplicates concurrent network requests for the same search', async () => {
    let resolveResponse;
    const fetchImpl = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );
    const options = { apiKey, fetchImpl, now: () => fetchedAt };
    const first = searchHereDestinations('coffee', center, options);
    const second = searchHereDestinations('coffee', center, options);

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    resolveResponse(hereResponse());

    expect(await first).toEqual(await second);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('lets a later deduplicated caller abort without cancelling the first caller', async () => {
    let resolveResponse;
    const fetchImpl = vi.fn(
      (_url, { signal } = {}) =>
        new Promise((resolve, reject) => {
          resolveResponse = resolve;
          signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('request aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true },
          );
        }),
    );
    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = searchHereDestinations('coffee', center, {
      apiKey,
      fetchImpl,
      signal: firstController.signal,
      now: () => fetchedAt,
    });
    const second = searchHereDestinations('coffee', center, {
      apiKey,
      fetchImpl,
      signal: secondController.signal,
      now: () => fetchedAt,
    });

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    secondController.abort();
    resolveResponse(hereResponse());

    await expect(second).resolves.toEqual({ ok: false, reason: 'aborted' });
    expect((await first).source).toBe('network');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('lets the first deduplicated caller abort without cancelling a later caller', async () => {
    let resolveResponse;
    const fetchImpl = vi.fn(
      (_url, { signal } = {}) =>
        new Promise((resolve, reject) => {
          resolveResponse = resolve;
          signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('request aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true },
          );
        }),
    );
    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = searchHereDestinations('coffee', center, {
      apiKey,
      fetchImpl,
      signal: firstController.signal,
      now: () => fetchedAt,
    });
    const second = searchHereDestinations('coffee', center, {
      apiKey,
      fetchImpl,
      signal: secondController.signal,
      now: () => fetchedAt,
    });

    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    firstController.abort();

    await expect(first).resolves.toEqual({ ok: false, reason: 'aborted' });
    resolveResponse(hereResponse());
    expect((await second).source).toBe('network');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('aborts a hung shared fetch at its deadline and releases the key for retry', async () => {
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

    const first = searchHereDestinations('coffee', center, {
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

    const retry = searchHereDestinations('coffee', center, {
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
