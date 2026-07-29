import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import fixture from '../../test/fixtures/here-discover.json';
import {
  buildHereSearchUrl,
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
  it('normalizes HERE places and addresses and omits non-numeric coordinates', () => {
    expect(normalizeHereCandidates(fixture)).toEqual([
      {
        id: 'here:af:streetsection:union-square',
        title: 'Union Square',
        address: 'Union Square, San Francisco, CA 94108, United States',
        position: { lat: 37.7879, lng: -122.4075 },
        resultType: 'place',
        categories: [],
        distanceMeters: 7900,
      },
      {
        id: 'here:af:streetsection:market-street',
        title: '1 Market Street',
        address: '1 Market Street, San Francisco, CA 94105, United States',
        position: { lat: 37.7936, lng: -122.3958 },
        resultType: 'address',
        categories: ['Restaurant'],
        distanceMeters: 1250,
      },
    ]);
  });
});

describe('buildHereSearchUrl', () => {
  it('builds a bounded, limited English HERE Discover request', () => {
    const url = buildHereSearchUrl('coffee & tea', center, apiKey);

    expect(url.origin).toBe('https://discover.search.hereapi.com');
    expect(url.pathname).toBe('/v1/discover');
    expect(url.searchParams.get('q')).toBe('coffee & tea');
    expect(url.searchParams.get('in')).toBe(
      'circle:37.7879,-122.4075;r=80000',
    );
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('lang')).toBe('en-US');
    expect(url.searchParams.get('apiKey')).toBe(apiKey);
    expect(url.toString()).toContain('q=coffee+%26+tea');
  });
});

describe('searchHereDestinations', () => {
  beforeEach(async () => {
    resetRequestCoordinatorForTests();
    await providerResponseStore.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns normalized candidates from the network', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse(fixture, { headers: { 'cache-control': 'no-store' } }),
    );

    const result = await searchHereDestinations('  Union Square  ', center, {
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(result).toEqual({
      ok: true,
      candidates: normalizeHereCandidates(fixture),
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

  it('does not persist a response marked no-store', async () => {
    const put = vi.spyOn(providerResponseStore, 'put');
    const fetchImpl = vi.fn().mockResolvedValue(
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
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse(fixture, { headers: { 'cache-control': 'no-store' } }),
    );

    const result = await searchHereDestinations('coffee', center, {
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(result).toEqual({
      ok: true,
      candidates: normalizeHereCandidates(fixture),
      source: 'network',
      fetchedAt,
      expiresAt: null,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('uses the network when deleting an expired cache entry fails', async () => {
    vi.spyOn(providerResponseStore, 'get').mockResolvedValue({
      key: 'here-discover:coffee:37.788,-122.408',
      data: { candidates: [] },
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

    const result = await searchHereDestinations('coffee', center, {
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(result).toEqual({
      ok: true,
      candidates: normalizeHereCandidates(fixture),
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
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse(fixture, { headers: { 'cache-control': 'max-age=60' } }),
    );

    const result = await searchHereDestinations('coffee', center, {
      apiKey,
      fetchImpl,
      now: () => fetchedAt,
    });

    expect(result).toEqual({
      ok: true,
      candidates: normalizeHereCandidates(fixture),
      source: 'network',
      fetchedAt,
      expiresAt: 70_000,
    });
  });

  it('persists normalized max-age responses and reuses a fresh cache entry', async () => {
    const put = vi.spyOn(providerResponseStore, 'put');
    const fetchImpl = vi.fn().mockResolvedValue(
      hereResponse(fixture, { headers: { 'cache-control': 'max-age=60' } }),
    );
    const options = { apiKey, fetchImpl, now: () => fetchedAt };

    const first = await searchHereDestinations('coffee', center, options);
    const second = await searchHereDestinations('coffee', center, options);

    expect(first.source).toBe('network');
    expect(second).toEqual({
      ok: true,
      candidates: normalizeHereCandidates(fixture),
      source: 'cache',
      fetchedAt,
      expiresAt: 70_000,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    const entry = put.mock.calls[0][0];
    expect(entry.key).toBe('here-discover:coffee:37.788,-122.408');
    expect(entry.key).not.toContain(apiKey);
    expect(entry.data).toEqual({
      candidates: normalizeHereCandidates(fixture),
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
});
