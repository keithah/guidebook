import { cacheUntilFromHeaders } from './cachePolicy.js';
import { dedupeRequest } from './requestCoordinator.js';
import { providerResponseStore } from './responseStore.js';

const HERE_DISCOVER_URL = 'https://discover.search.hereapi.com/v1/discover';
const SEARCH_RADIUS_METERS = 80_000;
const CANDIDATE_LIMIT = 5;

export function buildHereSearchUrl(query, center, apiKey) {
  const url = new URL(HERE_DISCOVER_URL);
  url.searchParams.set('q', query.trim());
  url.searchParams.set(
    'in',
    `circle:${center.lat},${center.lng};r=${SEARCH_RADIUS_METERS}`,
  );
  url.searchParams.set('limit', String(CANDIDATE_LIMIT));
  url.searchParams.set('lang', 'en-US');
  url.searchParams.set('apiKey', apiKey);
  return url;
}

export function normalizeHereCandidates(payload) {
  if (!Array.isArray(payload?.items)) return [];

  return payload.items
    .filter(
      (item) =>
        Number.isFinite(item?.position?.lat) &&
        Number.isFinite(item?.position?.lng),
    )
    .map((item) => ({
      id: item.id,
      title: item.title,
      address: item.address?.label ?? '',
      position: {
        lat: item.position.lat,
        lng: item.position.lng,
      },
      resultType: item.resultType,
      categories: Array.isArray(item.categories)
        ? item.categories
            .map((category) => category?.name)
            .filter((name) => typeof name === 'string')
        : [],
      distanceMeters: Number.isFinite(item.distance) ? item.distance : null,
    }));
}

function cacheKey(query, center) {
  const roundCoordinate = (value) => {
    const rounded =
      Math.sign(value) *
      (Math.round((Math.abs(value) + Number.EPSILON) * 1_000) / 1_000);
    return rounded.toFixed(3);
  };

  return `here-discover:${encodeURIComponent(query.toLowerCase())}:${roundCoordinate(center.lat)},${roundCoordinate(center.lng)}`;
}

function failureReason(error) {
  return error?.name === 'AbortError' ? 'aborted' : 'network';
}

async function fetchHereDestinations({
  query,
  center,
  apiKey,
  signal,
  fetchImpl,
  now,
  key,
}) {
  let response;
  try {
    response = await fetchImpl(buildHereSearchUrl(query, center, apiKey), {
      signal,
    });
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'unauthorized' };
  }
  if (response.status === 429) {
    return { ok: false, reason: 'rate-limited' };
  }
  if (!response.ok) return { ok: false, reason: 'network' };

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === 'AbortError' ? 'aborted' : 'invalid-response',
    };
  }

  const fetchedAt = now();
  const candidates = normalizeHereCandidates(payload).slice(0, CANDIDATE_LIMIT);
  const expiresAt = cacheUntilFromHeaders(response.headers, fetchedAt);

  if (expiresAt !== null && expiresAt > fetchedAt) {
    await providerResponseStore.put({
      key,
      data: { candidates },
      fetchedAt,
      expiresAt,
      staleUntil: expiresAt,
    });
  }

  return {
    ok: true,
    candidates,
    source: 'network',
    fetchedAt,
    expiresAt,
  };
}

export async function searchHereDestinations(
  query,
  center,
  {
    signal,
    fetchImpl = fetch,
    apiKey = import.meta.env.VITE_HERE_API_KEY,
    now = Date.now,
  } = {},
) {
  const normalizedQuery = String(query ?? '').trim();
  if (!normalizedQuery) return { ok: false, reason: 'empty-query' };
  if (!apiKey?.trim()) return { ok: false, reason: 'missing-api-key' };

  let key;
  try {
    key = cacheKey(normalizedQuery, center);
    const currentTime = now();
    const cached = await providerResponseStore.get(key);

    if (
      cached?.expiresAt > currentTime &&
      Array.isArray(cached.data?.candidates)
    ) {
      return {
        ok: true,
        candidates: cached.data.candidates,
        source: 'cache',
        fetchedAt: cached.fetchedAt,
        expiresAt: cached.expiresAt,
      };
    }

    if (cached) await providerResponseStore.delete(key);
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  }

  return dedupeRequest(key, () =>
    fetchHereDestinations({
      query: normalizedQuery,
      center,
      apiKey,
      signal,
      fetchImpl,
      now,
      key,
    }),
  ).catch((error) => ({ ok: false, reason: failureReason(error) }));
}
