import { cacheUntilFromHeaders } from './cachePolicy.js';
import {
  isFinitePosition,
  providerFailureReason,
  providerHttpFailure,
  sharedProviderRequest,
} from './providerFetch.js';
import { providerResponseStore } from './responseStore.js';

const HERE_WALKING_URL = 'https://router.hereapi.com/v8/routes';
const RETURN_ATTRIBUTES = 'polyline,summary,actions,instructions';
const REQUEST_TIMEOUT_MS = 10_000;
const KNOWN_ACTION_TYPES = new Set([
  'arrive',
  'continue',
  'depart',
  'exit',
  'keep',
  'roundaboutExit',
  'turn',
]);

/**
 * Format a finite position for a HERE Routing request.
 * @param {Object} position - Position containing latitude and longitude.
 * @returns {string} A comma-separated latitude and longitude pair.
 */
function formatPosition(position) {
  if (!isFinitePosition(position)) {
    throw new TypeError('Route coordinates must be finite');
  }
  return `${position.lat},${position.lng}`;
}

/**
 * Build a HERE Routing v8 pedestrian request URL.
 * @param {Object} origin - Walking route origin.
 * @param {Object} destination - Walking route destination.
 * @param {string} apiKey - HERE API key.
 * @returns {URL} The configured HERE Routing request URL.
 */
export function buildHereWalkingUrl(origin, destination, apiKey) {
  const url = new URL(HERE_WALKING_URL);
  url.searchParams.set('origin', formatPosition(origin));
  url.searchParams.set('destination', formatPosition(destination));
  url.searchParams.set('routingMode', 'fast');
  url.searchParams.set('transportMode', 'pedestrian');
  url.searchParams.set('return', RETURN_ATTRIBUTES);
  url.searchParams.set('units', 'imperial');
  url.searchParams.set('lang', 'en-US');
  url.searchParams.set('apiKey', apiKey);
  return url;
}

/**
 * Convert an identifier into a readable label.
 * @param {*} value - Identifier to label.
 * @returns {string} A sentence-cased label.
 */
function labelFor(value) {
  const words = String(value ?? 'unknown')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase();
  return words ? `${words[0].toUpperCase()}${words.slice(1)}` : 'Unknown';
}

/**
 * Normalize a walking route place.
 * @param {Object} place - HERE place payload.
 * @returns {Object|null} Normalized place or null.
 */
function normalizePlace(place) {
  if (!place || typeof place !== 'object') return null;
  return {
    ...(typeof place.id === 'string' ? { id: place.id } : {}),
    name: typeof place.name === 'string' ? place.name : '',
    type: typeof place.type === 'string' ? place.type : 'unknown',
    ...(Number.isFinite(place.location?.lat) &&
    Number.isFinite(place.location?.lng)
      ? {
          location: {
            lat: place.location.lat,
            lng: place.location.lng,
          },
        }
      : {}),
  };
}

/**
 * Normalize a HERE routing notice.
 * @param {Object} notice - HERE notice payload.
 * @returns {Object} Normalized notice.
 */
function normalizeNotice(notice) {
  return {
    code: typeof notice?.code === 'string' ? notice.code : 'unknown',
    title:
      typeof notice?.title === 'string' ? notice.title : labelFor(notice?.code),
    ...(typeof notice?.severity === 'string'
      ? { severity: notice.severity }
      : {}),
  };
}

/**
 * Normalize one HERE maneuver action.
 * @param {Object} action - HERE action payload.
 * @returns {Object} Normalized known action or readable unknown fallback.
 */
function normalizeAction(action) {
  const actionType = action?.action;
  const label = labelFor(actionType);
  const instruction =
    typeof action?.instruction === 'string' && action.instruction.trim()
      ? action.instruction
      : label;

  if (!KNOWN_ACTION_TYPES.has(actionType)) {
    return { type: 'unknown', label, instruction };
  }

  return {
    type: actionType,
    instruction,
    ...(Number.isFinite(action.duration)
      ? { durationSeconds: action.duration }
      : {}),
    ...(Number.isFinite(action.length) ? { lengthMeters: action.length } : {}),
    ...(Number.isFinite(action.offset) ? { offset: action.offset } : {}),
    ...(typeof action.direction === 'string'
      ? { direction: action.direction }
      : {}),
  };
}

/**
 * Normalize one pedestrian route section.
 * @param {Object} section - HERE section payload.
 * @returns {Object} Normalized walking section.
 */
function normalizeSection(section) {
  const actions = Array.isArray(section.actions)
    ? section.actions.map(normalizeAction)
    : [];
  const notices = Array.isArray(section.notices)
    ? section.notices.map(normalizeNotice)
    : [];

  return {
    id: typeof section.id === 'string' ? section.id : '',
    type: typeof section.type === 'string' ? section.type : 'unknown',
    departureTime: section.departure?.time ?? null,
    arrivalTime: section.arrival?.time ?? null,
    durationSeconds: Number.isFinite(section.travelSummary?.duration)
      ? section.travelSummary.duration
      : 0,
    lengthMeters: Number.isFinite(section.travelSummary?.length)
      ? section.travelSummary.length
      : 0,
    departure: normalizePlace(section.departure?.place),
    arrival: normalizePlace(section.arrival?.place),
    ...(typeof section.polyline === 'string'
      ? { polyline: section.polyline }
      : {}),
    actions,
    notices,
  };
}

/**
 * Normalize the first valid HERE pedestrian route.
 * @param {Object} payload - HERE Routing v8 response payload.
 * @returns {{id:string,durationSeconds:number,lengthMeters:number,sections:Array,actions:Array,notices:Array}|null} Normalized route or null.
 */
export function normalizeHereWalking(payload) {
  if (!Array.isArray(payload?.routes)) return null;
  const sourceRoute = payload.routes.find(
    (route) =>
      typeof route?.id === 'string' &&
      route.id.length > 0 &&
      Array.isArray(route.sections) &&
      route.sections.length > 0,
  );
  if (!sourceRoute) return null;

  const sections = sourceRoute.sections.map(normalizeSection);
  return {
    id: sourceRoute.id,
    durationSeconds: sections.reduce(
      (total, section) => total + section.durationSeconds,
      0,
    ),
    lengthMeters: sections.reduce(
      (total, section) => total + section.lengthMeters,
      0,
    ),
    sections,
    actions: sections.flatMap((section) => section.actions),
    notices: sections.flatMap((section) => section.notices),
  };
}

/**
 * Build the credential-free persistent cache key for a walking journey.
 * @param {Object} origin - Walking route origin.
 * @param {Object} destination - Walking route destination.
 * @returns {string} Cache key.
 */
function walkingCacheKey(origin, destination) {
  return `here-walking:${formatPosition(origin)}:${formatPosition(destination)}:fast:imperial:en-US`;
}

/**
 * Load and normalize a HERE walking route from the network.
 * @param {Object} request - Provider request options.
 * @returns {Promise<Object>} Normalized success or standardized failure.
 */
async function fetchWalkingRoute({
  origin,
  destination,
  apiKey,
  fetchImpl,
  now,
  key,
  signal,
  didTimeout,
}) {
  let response;
  try {
    response = await fetchImpl(
      buildHereWalkingUrl(origin, destination, apiKey),
      { signal },
    );
  } catch (error) {
    return {
      ok: false,
      reason: didTimeout() ? 'timeout' : providerFailureReason(error),
    };
  }

  if (didTimeout()) return { ok: false, reason: 'timeout' };
  const httpFailure = providerHttpFailure(response);
  if (httpFailure) return { ok: false, reason: httpFailure };

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    return {
      ok: false,
      reason: didTimeout()
        ? 'timeout'
        : error?.name === 'AbortError'
          ? 'aborted'
          : 'invalid-response',
    };
  }
  if (didTimeout()) return { ok: false, reason: 'timeout' };

  const route = normalizeHereWalking(payload);
  if (!route) return { ok: false, reason: 'no-route' };

  const fetchedAt = now();
  const expiresAt = cacheUntilFromHeaders(response.headers, fetchedAt);
  if (expiresAt !== null && expiresAt > fetchedAt) {
    try {
      await providerResponseStore.put({
        key,
        data: { route },
        fetchedAt,
        expiresAt,
        staleUntil: expiresAt,
      });
    } catch {
      // Persistent caching is best-effort; the network route remains usable.
    }
  }

  return {
    ok: true,
    route,
    source: 'network',
    fetchedAt,
    expiresAt,
  };
}

/**
 * Fetch one pedestrian route between two positions.
 * @param {Object} origin - Walking route origin.
 * @param {Object} destination - Walking route destination.
 * @param {Object} [options] - Request, timing, and provider overrides.
 * @returns {Promise<Object>} Route result or standardized provider failure.
 */
export async function fetchHereWalkingRoute(
  origin,
  destination,
  {
    signal,
    fetchImpl = fetch,
    apiKey = import.meta.env.VITE_HERE_API_KEY,
    now = Date.now,
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = {},
) {
  if (!apiKey?.trim()) return { ok: false, reason: 'missing-api-key' };
  if (signal?.aborted) return { ok: false, reason: 'aborted' };
  if (!isFinitePosition(origin) || !isFinitePosition(destination)) {
    return { ok: false, reason: 'invalid-request' };
  }

  const key = walkingCacheKey(origin, destination);
  const currentTime = now();
  let cached;
  try {
    cached = await providerResponseStore.get(key);
  } catch {
    // Persistent caching is best-effort; continue with the network.
  }

  if (
    cached?.expiresAt > currentTime &&
    cached.data?.route &&
    typeof cached.data.route === 'object'
  ) {
    return {
      ok: true,
      route: cached.data.route,
      source: 'cache',
      fetchedAt: cached.fetchedAt,
      expiresAt: cached.expiresAt,
    };
  }

  if (cached) {
    try {
      await providerResponseStore.delete(key);
    } catch {
      // Persistent caching is best-effort; continue with the network.
    }
  }

  return sharedProviderRequest({
    key,
    signal,
    timeoutMs,
    loader: ({ signal: providerSignal, didTimeout }) =>
      fetchWalkingRoute({
        origin,
        destination,
        apiKey,
        fetchImpl,
        now,
        key,
        signal: providerSignal,
        didTimeout,
      }),
  });
}
