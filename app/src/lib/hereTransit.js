import { cacheUntilFromHeaders } from './cachePolicy.js';
import {
  isFinitePosition,
  providerFailureReason,
  providerHttpFailure,
  sharedProviderRequest,
} from './providerFetch.js';
import { providerResponseStore } from './responseStore.js';

const HERE_TRANSIT_URL = 'https://transit.router.hereapi.com/v8/routes';
const RETURN_ATTRIBUTES =
  'intermediate,actions,travelSummary,incidents,sourceFeedMapping';
const REQUEST_TIMEOUT_MS = 10_000;
const ROUTE_KEY_BUCKET_MS = 60_000;
const KNOWN_SECTION_TYPES = new Set(['pedestrian', 'transit']);
const KNOWN_ACTION_TYPES = new Set([
  'arrive',
  'board',
  'continue',
  'deboard',
  'depart',
  'exit',
  'keep',
  'roundaboutExit',
  'turn',
  'wait',
]);

/**
 * Formats a route position as a trimmed string or latitude-longitude pair.
 * @param {string|Object} position - A position string or an object with finite `lat` and `lng` values.
 * @returns {string} The trimmed position string or formatted coordinate pair.
 * @throws {TypeError} If the position object does not contain finite coordinates.
 */
function formatPosition(position) {
  if (typeof position === 'string') return position.trim();
  if (!isFinitePosition(position)) {
    throw new TypeError('Route coordinates must be finite');
  }
  return `${position.lat},${position.lng}`;
}

/**
 * Converts a date value to an ISO 8601 timestamp.
 * @param {Date|string|number} value - The date value to convert.
 * @return {string} The ISO 8601 timestamp.
 */
function isoTime(value) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

/**
 * Build a HERE Transit routing request URL.
 * @param {string|Object} origin - The route origin.
 * @param {string|Object} destination - The route destination.
 * @param {Date|string|number} departureTime - The planned departure time.
 * @param {string} apiKey - The HERE API key.
 * @return {URL} The configured HERE Transit request URL.
 */
export function buildHereTransitUrl(
  origin,
  destination,
  departureTime,
  apiKey,
) {
  const url = new URL(HERE_TRANSIT_URL);
  url.searchParams.set('origin', formatPosition(origin));
  url.searchParams.set('destination', formatPosition(destination));
  url.searchParams.set('departureTime', isoTime(departureTime));
  url.searchParams.set('alternatives', '2');
  url.searchParams.set('units', 'imperial');
  url.searchParams.set('lang', 'en-US');
  url.searchParams.set('return', RETURN_ATTRIBUTES);
  url.searchParams.set('apiKey', apiKey);
  return url;
}

/**
 * Converts a value into a human-readable, capitalized label.
 * @param {*} value - The value to format as a label.
 * @return {string} The formatted label, or `"Unknown"` when the value is null, undefined, or empty.
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
 * Normalize a place into the route data format.
 * @param {object} place - The place data to normalize.
 * @return {object|null} The normalized place, or `null` when the input is invalid.
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
    ...(typeof place.platform === 'string' ? { platform: place.platform } : {}),
    ...(typeof place.code === 'string' ? { stopCode: place.code } : {}),
  };
}

/**
 * Normalize a route notice into a consistent representation.
 * @param {Object} notice - The notice data to normalize.
 * @returns {Object} An object containing the notice code, title, and optional severity.
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
 * Normalize an incident into a consistent route incident object.
 * @param {Object} incident - The incident data to normalize.
 * @returns {Object} The normalized incident with type and effect values, plus any valid optional details.
 */
function normalizeIncident(incident) {
  return {
    type: typeof incident?.type === 'string' ? incident.type : 'unknown',
    effect: typeof incident?.effect === 'string' ? incident.effect : 'unknown',
    ...(typeof incident?.summary === 'string'
      ? { summary: incident.summary }
      : {}),
    ...(typeof incident?.description === 'string'
      ? { description: incident.description }
      : {}),
    ...(typeof incident?.validFrom === 'string'
      ? { validFrom: incident.validFrom }
      : {}),
    ...(typeof incident?.validUntil === 'string'
      ? { validUntil: incident.validUntil }
      : {}),
    ...(typeof incident?.url === 'string' ? { url: incident.url } : {}),
  };
}

/**
 * Normalize a route action into a recognized or unknown action representation.
 * @param {object} action - The source action data.
 * @returns {object} The normalized action with its type, instruction, and available metadata.
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
    ...(typeof action.severity === 'string'
      ? { severity: action.severity }
      : {}),
    ...(Number.isFinite(action.exit) ? { exit: action.exit } : {}),
  };
}

/**
 * Collects all actions associated with a route section.
 * @param {Object} section - The route section whose pre-actions, actions, and post-actions are collected.
 * @returns {Array} The section's actions in execution order.
 */
function allSectionActions(section) {
  return [section?.preActions, section?.actions, section?.postActions]
    .filter(Array.isArray)
    .flat();
}

/**
 * Normalize public transport details into a consistent object.
 * @param {object} transport - The transport details to normalize.
 * @return {object|null} The normalized transport details, or `null` when the input is missing or invalid.
 */
function normalizeTransport(transport) {
  if (!transport || typeof transport !== 'object') return null;
  return {
    ...(typeof transport.mode === 'string' ? { mode: transport.mode } : {}),
    ...(typeof transport.name === 'string' ? { name: transport.name } : {}),
    ...(typeof transport.shortName === 'string'
      ? { shortName: transport.shortName }
      : {}),
    ...(typeof transport.longName === 'string'
      ? { longName: transport.longName }
      : {}),
    ...(typeof transport.headsign === 'string'
      ? { headsign: transport.headsign }
      : {}),
    ...(typeof transport.category === 'string'
      ? { category: transport.category }
      : {}),
    ...(typeof transport.color === 'string' ? { color: transport.color } : {}),
    ...(typeof transport.textColor === 'string'
      ? { textColor: transport.textColor }
      : {}),
    ...(typeof transport.wheelchairAccessible === 'string'
      ? { wheelchairAccessible: transport.wheelchairAccessible }
      : {}),
  };
}

/**
 * Normalize a transit agency into its supported fields.
 * @param {object} agency - The agency data to normalize.
 * @return {object|null} The normalized agency, or `null` when the input is not an object.
 */
function normalizeAgency(agency) {
  if (!agency || typeof agency !== 'object') return null;
  return {
    ...(typeof agency.id === 'string' ? { id: agency.id } : {}),
    ...(typeof agency.name === 'string' ? { name: agency.name } : {}),
    ...(typeof agency.website === 'string' ? { website: agency.website } : {}),
  };
}

/**
 * Normalize an intermediate transit stop and its departure details.
 * @param {Object} stop - The transit stop data to normalize.
 * @return {Object} The normalized stop, including optional departure time, delay, status, and stop duration.
 */
function normalizeIntermediateStop(stop) {
  const place = normalizePlace(stop?.departure?.place) ?? {};
  return {
    ...place,
    ...(typeof stop?.departure?.time === 'string'
      ? { departureTime: stop.departure.time }
      : {}),
    ...(Number.isFinite(stop?.departure?.delay)
      ? { delaySeconds: stop.departure.delay }
      : {}),
    ...(typeof stop?.departure?.status === 'string'
      ? { status: stop.departure.status }
      : {}),
    ...(Number.isFinite(stop?.duration)
      ? { stopDurationSeconds: stop.duration }
      : {}),
  };
}

/**
 * Normalize a recognized route section into the application's section format.
 * @param {Object} section - The route section to normalize.
 * @returns {Object} The normalized section with timing, location, transport, stop, notice, incident, and action details.
 */
function normalizeKnownSection(section) {
  const durationSeconds = Number.isFinite(section.travelSummary?.duration)
    ? section.travelSummary.duration
    : 0;

  return {
    id: section.id,
    type: section.type,
    departureTime: section.departure?.time ?? null,
    arrivalTime: section.arrival?.time ?? null,
    durationSeconds,
    ...(Number.isFinite(section.travelSummary?.length)
      ? { lengthMeters: section.travelSummary.length }
      : {}),
    departure: normalizePlace(section.departure?.place),
    arrival: normalizePlace(section.arrival?.place),
    ...(Number.isFinite(section.departure?.delay)
      ? { departureDelaySeconds: section.departure.delay }
      : {}),
    ...(typeof section.departure?.status === 'string'
      ? { departureStatus: section.departure.status }
      : {}),
    ...(Number.isFinite(section.arrival?.delay)
      ? { arrivalDelaySeconds: section.arrival.delay }
      : {}),
    ...(typeof section.arrival?.status === 'string'
      ? { arrivalStatus: section.arrival.status }
      : {}),
    transport: normalizeTransport(section.transport),
    agency: normalizeAgency(section.agency),
    intermediateStops: Array.isArray(section.intermediateStops)
      ? section.intermediateStops.map(normalizeIntermediateStop)
      : [],
    notices: Array.isArray(section.notices)
      ? section.notices.map(normalizeNotice)
      : [],
    incidents: Array.isArray(section.incidents)
      ? section.incidents.map(normalizeIncident)
      : [],
    actions: allSectionActions(section).map(normalizeAction),
  };
}

/**
 * Normalizes a route section into a supported or unknown section representation.
 * @param {Object} section - The route section to normalize.
 * @returns {Object} The normalized section, including its known section data or a descriptive label and instruction.
 */
function normalizeSection(section) {
  if (KNOWN_SECTION_TYPES.has(section?.type)) {
    return normalizeKnownSection(section);
  }

  const label = labelFor(section?.type);
  const instruction = allSectionActions(section).find(
    (action) => typeof action?.instruction === 'string',
  )?.instruction;
  return {
    type: 'unknown',
    label,
    instruction: instruction ?? label,
  };
}

/**
 * Calculates the total route duration in seconds.
 * @param {Array<Object>} sections - The route sections used to determine the duration.
 * @returns {number} The duration in seconds.
 */
function routeDurationSeconds(sections) {
  const departure = Date.parse(sections[0]?.departure?.time ?? '');
  const arrival = Date.parse(sections.at(-1)?.arrival?.time ?? '');
  if (Number.isFinite(departure) && Number.isFinite(arrival)) {
    return Math.max(0, Math.round((arrival - departure) / 1_000));
  }
  return sections.reduce(
    (total, section) => total + (section.travelSummary?.duration ?? 0),
    0,
  );
}

/**
 * Normalize a route into the application's transit route format.
 * @param {Object} route - The provider route containing sections and notices.
 * @param {string} plannedAt - The planned departure time associated with the route.
 * @returns {Object} The normalized route with timing, walking, transfer, line, section, and notice data.
 */
function normalizeRoute(route, plannedAt) {
  const rawSections = route.sections;
  const transitSections = rawSections.filter(
    (section) => section?.type === 'transit',
  );
  const pedestrianSections = rawSections.filter(
    (section) => section?.type === 'pedestrian',
  );

  return {
    id: route.id,
    departureTime: rawSections[0]?.departure?.time ?? null,
    arrivalTime: rawSections.at(-1)?.arrival?.time ?? null,
    durationSeconds: routeDurationSeconds(rawSections),
    transferCount: Math.max(0, transitSections.length - 1),
    walkingDurationSeconds: pedestrianSections.reduce(
      (total, section) => total + (section.travelSummary?.duration ?? 0),
      0,
    ),
    lines: transitSections.map((section) => ({
      name:
        section.transport?.name ??
        section.transport?.shortName ??
        labelFor(section.transport?.mode),
      headsign: section.transport?.headsign ?? '',
    })),
    sections: rawSections.map(normalizeSection),
    notices: [
      ...(Array.isArray(route.notices) ? route.notices : []),
      ...rawSections.flatMap((section) =>
        Array.isArray(section?.notices) ? section.notices : [],
      ),
    ].map(normalizeNotice),
    plannedAt,
  };
}

/**
 * Normalize HERE route data into up to three eligible internal route objects.
 * @param {object} payload - HERE API response containing route data.
 * @param {string} plannedAt - Planned departure time associated with the routes.
 * @return {Array<object>} Normalized routes with at least one section, excluding pedestrian-only routes when transit routes are available.
 */
export function normalizeHereRoutes(payload, plannedAt) {
  if (!Array.isArray(payload?.routes)) return [];

  const routes = payload.routes.filter(
    (route) => Array.isArray(route?.sections) && route.sections.length > 0,
  );
  const hasTransitRoute = routes.some((route) =>
    route.sections.some((section) => section?.type === 'transit'),
  );
  const eligibleRoutes = hasTransitRoute
    ? routes.filter(
        (route) =>
          !route.sections.every((section) => section?.type === 'pedestrian'),
      )
    : routes;

  return eligibleRoutes
    .slice(0, 3)
    .map((route) => normalizeRoute(route, plannedAt));
}

/**
 * Creates a cache key for a route query.
 * @param {string|Object} origin - The route origin position.
 * @param {string|Object} destination - The route destination position.
 * @param {string} plannedAt - The planned departure time in ISO format.
 * @returns {string} A cache key containing the origin, destination, and time bucket.
 */
function routeCacheKey(origin, destination, plannedAt) {
  const bucket = Math.floor(Date.parse(plannedAt) / ROUTE_KEY_BUCKET_MS);
  return `here-transit:${formatPosition(origin)}:${formatPosition(destination)}:${bucket}`;
}

/**
 * Fetches and normalizes transit routes for a planned journey.
 * @returns {Promise<object>} A success result containing normalized trips and cache metadata, or a failure result with a reason.
 */
async function fetchRoutes({
  origin,
  destination,
  plannedAt,
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
      buildHereTransitUrl(origin, destination, plannedAt, apiKey),
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

  const trips = normalizeHereRoutes(payload, plannedAt);
  if (trips.length === 0) return { ok: false, reason: 'no-route' };

  const responseTime = now();
  const expiresAt = cacheUntilFromHeaders(response.headers, responseTime);
  if (expiresAt !== null && expiresAt > responseTime) {
    try {
      await providerResponseStore.put({
        key,
        data: { trips },
        fetchedAt: responseTime,
        expiresAt,
        staleUntil: expiresAt,
      });
    } catch {
      // Persistent caching is best-effort; the network result remains usable.
    }
  }

  return {
    ok: true,
    trips,
    source: 'network',
    fetchedAt: responseTime,
    expiresAt,
  };
}

/**
 * Fetch transit routes between two locations for a planned departure time.
 * @param {Object|string} origin - The starting position.
 * @param {Object|string} destination - The ending position.
 * @param {Object} [options] - Request and transport options.
 * @param {Date|string|number} [options.departureTime] - The planned departure time.
 * @param {AbortSignal} [options.signal] - Signal used to cancel the request.
 * @param {string} [options.apiKey] - HERE API key.
 * @param {number} [options.timeoutMs] - Network request timeout in milliseconds.
 * @return {Promise<Object>} A result containing normalized trips on success, or a reason such as `missing-api-key`, `aborted`, `invalid-request`, or a provider failure on error.
 */
export async function fetchHereTransitRoutes(
  origin,
  destination,
  {
    departureTime = new Date(),
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

  let plannedAt;
  let key;
  try {
    plannedAt = isoTime(departureTime);
    key = routeCacheKey(origin, destination, plannedAt);
  } catch {
    return { ok: false, reason: 'invalid-request' };
  }

  const currentTime = now();
  let cached;
  try {
    cached = await providerResponseStore.get(key);
  } catch {
    // Persistent caching is best-effort; continue with the network.
  }

  if (cached?.expiresAt > currentTime && Array.isArray(cached.data?.trips)) {
    return {
      ok: true,
      trips: cached.data.trips,
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
      fetchRoutes({
        origin,
        destination,
        plannedAt,
        apiKey,
        fetchImpl,
        now,
        key,
        signal: providerSignal,
        didTimeout,
      }),
  });
}
