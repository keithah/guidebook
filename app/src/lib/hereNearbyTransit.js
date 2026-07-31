import { cacheUntilFromHeaders } from './cachePolicy.js';
import {
  isFinitePosition,
  providerFailureReason,
  providerHttpFailure,
  sharedProviderRequest,
} from './providerFetch.js';
import { providerResponseStore } from './responseStore.js';

const HERE_STATIONS_URL = 'https://transit.hereapi.com/v8/stations';
const HERE_DEPARTURES_URL = 'https://transit.hereapi.com/v8/departures';
const SEARCH_RADIUS_METERS = 1_200;
const MAX_PLACES = 10;
const MAX_STATIONS = 5;
const REQUEST_TIMEOUT_MS = 10_000;
const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Normalize a provider value into non-empty trimmed text.
 * @param {*} value - Provider value.
 * @returns {string} Trimmed text, or an empty string.
 */
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Build a credential-free coordinate-bucket cache key.
 * @param {{lat: number, lng: number}} origin - Search origin.
 * @returns {string} Persistent-cache and request-coordination key.
 */
function cacheKey(origin) {
  return `here-nearby:${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}`;
}

/**
 * Build a HERE nearby-stations request.
 * @param {{lat: number, lng: number}} origin - Search origin.
 * @param {string} apiKey - HERE API key.
 * @returns {URL} Configured station request URL.
 */
export function buildHereStationsUrl(origin, apiKey) {
  const url = new URL(HERE_STATIONS_URL);
  url.searchParams.set(
    'in',
    `${origin.lat},${origin.lng};r=${SEARCH_RADIUS_METERS}`,
  );
  url.searchParams.set('maxPlaces', String(MAX_PLACES));
  url.searchParams.set('return', 'transport');
  url.searchParams.set('apiKey', apiKey);
  return url;
}

/**
 * Build a HERE departure-board request for physical station member IDs.
 * @param {string[]} ids - Exact station member IDs.
 * @param {string} apiKey - HERE API key.
 * @returns {URL} Configured departure request URL.
 */
export function buildHereDeparturesUrl(ids, apiKey) {
  const url = new URL(HERE_DEPARTURES_URL);
  url.searchParams.set('ids', ids.join(','));
  url.searchParams.set('timespan', '60');
  url.searchParams.set('maxPerTransport', '2');
  url.searchParams.set('sort', 'transport');
  url.searchParams.set('apiKey', apiKey);
  return url;
}

/**
 * Retain supported string transport metadata.
 * @param {*} transport - Provider transport record.
 * @returns {object|null} Normalized useful transport, or null.
 */
function normalizeTransport(transport) {
  if (!transport || typeof transport !== 'object') return null;
  if (
    !text(transport.mode) &&
    !text(transport.shortName) &&
    !text(transport.name)
  ) {
    return null;
  }
  return { ...transport };
}

/**
 * Normalize agency identity used by shared transit presentation.
 * @param {*} agency - Provider agency record.
 * @returns {object|null} Normalized agency or null.
 */
function normalizeAgency(agency) {
  if (!agency || typeof agency !== 'object') return null;
  const id = text(agency.id);
  const name = text(agency.name);
  const website = text(agency.website);
  if (!id && !name) return null;
  return {
    ...(id ? { id } : {}),
    ...(name ? { name } : {}),
    ...(website ? { website } : {}),
  };
}

/**
 * Calculate geodesic distance between coordinates with the Haversine formula.
 * @param {{lat: number, lng: number}} first - First position.
 * @param {{lat: number, lng: number}} second - Second position.
 * @returns {number} Distance in meters.
 */
function haversineMeters(first, second) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.lat - first.lat);
  const longitudeDelta = radians(second.lng - first.lng);
  const firstLatitude = radians(first.lat);
  const secondLatitude = radians(second.lat);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Return station transports from HERE's plural or defensive singular shape.
 * @param {*} station - Provider station record.
 * @returns {object[]} Normalized transport records.
 */
function stationTransports(station) {
  const candidates = Array.isArray(station?.transports)
    ? station.transports
    : Array.isArray(station?.transport)
      ? station.transport
      : station?.transport
        ? [station.transport]
        : [];
  return candidates.map(normalizeTransport).filter(Boolean);
}

/**
 * Normalize and physically group HERE stations around an origin.
 * @param {*} payload - HERE stations payload.
 * @param {{lat: number, lng: number}} origin - Distance origin.
 * @returns {object[]} Distance-ordered physical station records.
 */
export function normalizeHereStations(payload, origin) {
  if (!Array.isArray(payload?.stations) || !isFinitePosition(origin)) return [];

  const grouped = new Map();
  for (const station of payload.stations) {
    const place = station?.place;
    const memberId = text(place?.id);
    const name = text(place?.name);
    const position = place?.location;
    const transports = stationTransports(station);
    if (
      !memberId ||
      !name ||
      !isFinitePosition(position) ||
      transports.length === 0
    ) {
      continue;
    }

    const parentId = text(
      typeof place.parent === 'string'
        ? place.parent
        : place.parent?.id || place.parentId,
    );
    const id = parentId || memberId;
    const distanceMeters = haversineMeters(origin, position);
    const existing = grouped.get(id);
    if (!existing) {
      grouped.set(id, {
        id,
        memberIds: [memberId],
        name,
        position: { lat: position.lat, lng: position.lng },
        distanceMeters,
        transports,
      });
      continue;
    }

    if (!existing.memberIds.includes(memberId)) {
      existing.memberIds.push(memberId);
    }
    const transportKeys = new Set(
      existing.transports.map((transport) => JSON.stringify(transport)),
    );
    for (const transport of transports) {
      const key = JSON.stringify(transport);
      if (!transportKeys.has(key)) {
        existing.transports.push(transport);
        transportKeys.add(key);
      }
    }
    if (distanceMeters < existing.distanceMeters) {
      existing.name = name;
      existing.position = { lat: position.lat, lng: position.lng };
      existing.distanceMeters = distanceMeters;
    }
  }

  return [...grouped.values()].sort(
    (first, second) => first.distanceMeters - second.distanceMeters,
  );
}

/**
 * Produce a collision-safe service grouping key.
 * @param {object|null} agency - Normalized agency.
 * @param {object} transport - Normalized transport.
 * @param {string} headsign - Normalized headsign.
 * @returns {string} Service key.
 */
function serviceKey(agency, transport, headsign) {
  return JSON.stringify([
    text(agency?.id) || text(agency?.name),
    text(transport.mode),
    text(transport.shortName) || text(transport.name),
    headsign,
  ]);
}

/**
 * Normalize HERE departure boards by member station ID.
 * @param {*} payload - HERE departures payload.
 * @returns {Map<string, object[]>} Board entries keyed by member station ID.
 */
export function normalizeHereDepartureBoards(payload) {
  const boards = new Map();
  if (!Array.isArray(payload?.boards)) return boards;

  for (const board of payload.boards) {
    const memberId = text(board?.place?.id || board?.id);
    if (!memberId) continue;
    const entries = [];
    for (const candidate of Array.isArray(board?.departures)
      ? board.departures
      : []) {
      const scheduledTime = text(candidate?.time);
      const transport = normalizeTransport(candidate?.transport);
      if (!Number.isFinite(Date.parse(scheduledTime)) || !transport) continue;
      const isRealtime = Number.isFinite(candidate.delay);
      entries.push({
        agency: normalizeAgency(candidate.agency),
        transport,
        headsign: text(candidate.headsign || transport.headsign),
        scheduledTime,
        delaySeconds: isRealtime ? candidate.delay : null,
        isRealtime,
      });
    }
    boards.set(memberId, entries);
  }

  return boards;
}

/**
 * Compare the line identity available on station and departure transports.
 * @param {object} first - First transport.
 * @param {object} second - Second transport.
 * @param {string} secondHeadsign - Separate second headsign.
 * @returns {boolean} Whether the station transport is represented.
 */
function sameStationTransport(first, second, secondHeadsign) {
  const firstHeadsign = text(first.headsign);
  return (
    text(first.mode) === text(second.mode) &&
    (text(first.shortName) || text(first.name)) ===
      (text(second.shortName) || text(second.name)) &&
    (!firstHeadsign || firstHeadsign === secondHeadsign)
  );
}

/**
 * Join physical stations to member boards and group departures by service.
 * @param {object[]} stations - Normalized physical stations.
 * @param {Map<string, object[]>} boards - Normalized member boards.
 * @returns {object[]} At most five nearest joined stations.
 */
export function joinNearbyStations(stations, boards) {
  if (!Array.isArray(stations) || !(boards instanceof Map)) return [];

  return stations.slice(0, MAX_STATIONS).map((station) => {
    const services = new Map();
    for (const memberId of station.memberIds) {
      for (const entry of boards.get(memberId) ?? []) {
        const key = serviceKey(entry.agency, entry.transport, entry.headsign);
        const existing = services.get(key);
        if (existing) {
          existing.departures.push({
            scheduledTime: entry.scheduledTime,
            delaySeconds: entry.delaySeconds,
            isRealtime: entry.isRealtime,
          });
        } else {
          services.set(key, {
            key,
            agency: entry.agency,
            transport: entry.transport,
            headsign: entry.headsign,
            departures: [
              {
                scheduledTime: entry.scheduledTime,
                delaySeconds: entry.delaySeconds,
                isRealtime: entry.isRealtime,
              },
            ],
          });
        }
      }
    }

    for (const transport of station.transports) {
      const represented = [...services.values()].some((service) =>
        sameStationTransport(transport, service.transport, service.headsign),
      );
      if (!represented) {
        const headsign = text(transport.headsign);
        const key = serviceKey(null, transport, headsign);
        services.set(key, {
          key,
          agency: null,
          transport,
          headsign,
          departures: [],
        });
      }
    }

    for (const service of services.values()) {
      service.departures.sort((first, second) => {
        const firstTime =
          Date.parse(first.scheduledTime) +
          (first.delaySeconds ?? 0) * 1_000;
        const secondTime =
          Date.parse(second.scheduledTime) +
          (second.delaySeconds ?? 0) * 1_000;
        return firstTime - secondTime;
      });
      service.departures = service.departures.slice(0, 2);
    }

    return {
      id: station.id,
      memberIds: station.memberIds,
      name: station.name,
      position: station.position,
      distanceMeters: station.distanceMeters,
      services: [...services.values()],
    };
  });
}

/**
 * Fetch and parse one HERE response with standardized failure reasons.
 * @returns {Promise<object>} Parsed response or normalized failure.
 */
async function fetchJson({ url, fetchImpl, signal, didTimeout }) {
  let response;
  try {
    response = await fetchImpl(url, { signal });
  } catch (error) {
    return {
      ok: false,
      reason: didTimeout() ? 'timeout' : providerFailureReason(error),
    };
  }

  if (didTimeout()) return { ok: false, reason: 'timeout' };
  const httpFailure = providerHttpFailure(response);
  if (httpFailure) return { ok: false, reason: httpFailure };

  try {
    const payload = await response.json();
    if (didTimeout()) return { ok: false, reason: 'timeout' };
    return { ok: true, response, payload };
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
}

/**
 * Persist normalized nearby results when every contributing response permits it.
 */
async function persistNearby({ key, stations, fetchedAt, expiresAt }) {
  if (expiresAt === null || expiresAt <= fetchedAt) return;
  try {
    await providerResponseStore.put({
      key,
      data: { stations },
      fetchedAt,
      expiresAt,
      staleUntil: expiresAt,
    });
  } catch {
    // Persistent caching is best-effort; the network result remains usable.
  }
}

/**
 * Run the coordinated two-request HERE nearby loader.
 * @returns {Promise<object>} Normalized network result or provider failure.
 */
async function fetchNearby({
  origin,
  apiKey,
  fetchImpl,
  now,
  key,
  signal,
  didTimeout,
}) {
  const stationResult = await fetchJson({
    url: buildHereStationsUrl(origin, apiKey),
    fetchImpl,
    signal,
    didTimeout,
  });
  if (!stationResult.ok) return stationResult;
  if (!Array.isArray(stationResult.payload?.stations)) {
    return { ok: false, reason: 'invalid-response' };
  }

  const normalizedStations = normalizeHereStations(
    stationResult.payload,
    origin,
  );
  if (normalizedStations.length === 0) {
    const fetchedAt = now();
    const expiresAt = cacheUntilFromHeaders(
      stationResult.response.headers,
      fetchedAt,
    );
    await persistNearby({ key, stations: [], fetchedAt, expiresAt });
    return {
      ok: true,
      stations: [],
      source: 'network',
      fetchedAt,
      expiresAt,
    };
  }

  const nearbyStations = normalizedStations.slice(0, MAX_STATIONS);
  const ids = nearbyStations.flatMap((station) => station.memberIds);
  const departureResult = await fetchJson({
    url: buildHereDeparturesUrl(ids, apiKey),
    fetchImpl,
    signal,
    didTimeout,
  });
  if (!departureResult.ok) return departureResult;
  if (!Array.isArray(departureResult.payload?.boards)) {
    return { ok: false, reason: 'invalid-response' };
  }

  const stations = joinNearbyStations(
    nearbyStations,
    normalizeHereDepartureBoards(departureResult.payload),
  );
  const fetchedAt = now();
  const stationsExpiry = cacheUntilFromHeaders(
    stationResult.response.headers,
    fetchedAt,
  );
  const departuresExpiry = cacheUntilFromHeaders(
    departureResult.response.headers,
    fetchedAt,
  );
  const expiresAt =
    stationsExpiry > fetchedAt && departuresExpiry > fetchedAt
      ? Math.min(stationsExpiry, departuresExpiry)
      : null;
  await persistNearby({ key, stations, fetchedAt, expiresAt });

  return {
    ok: true,
    stations,
    source: 'network',
    fetchedAt,
    expiresAt,
  };
}

/**
 * Fetch normalized nearby HERE stations and their next departures.
 * @param {{lat: number, lng: number}} origin - Active location origin.
 * @param {object} [options] - Provider, cancellation, clock, and deadline options.
 * @returns {Promise<object>} Nearby result or standardized failure reason.
 */
export async function fetchHereNearbyTransit(
  origin,
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
  if (!isFinitePosition(origin)) return { ok: false, reason: 'invalid-request' };

  let key;
  try {
    key = cacheKey(origin);
  } catch {
    return { ok: false, reason: 'invalid-request' };
  }

  let cached;
  try {
    cached = await providerResponseStore.get(key);
  } catch {
    // Persistent caching is best-effort; continue with the network.
  }

  if (signal?.aborted) return { ok: false, reason: 'aborted' };
  const currentTime = now();
  if (cached?.expiresAt > currentTime && Array.isArray(cached.data?.stations)) {
    return {
      ok: true,
      stations: cached.data.stations,
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
      fetchNearby({
        origin,
        apiKey,
        fetchImpl,
        now,
        key,
        signal: providerSignal,
        didTimeout,
      }),
  });
}
