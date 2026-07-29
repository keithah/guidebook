import { cacheUntilFromHeaders } from './cachePolicy.js';
import { dedupeRequest } from './requestCoordinator.js';
import { providerResponseStore } from './responseStore.js';

const HERE_TRANSIT_URL = 'https://transit.router.hereapi.com/v8/routes';
const RETURN_ATTRIBUTES =
  'intermediate,actions,travelSummary,incidents,sourceFeedMapping';
const REQUEST_TIMEOUT_MS = 10_000;
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

function formatPosition(position) {
  if (typeof position === 'string') return position.trim();
  return `${position.lat},${position.lng}`;
}

function isoTime(value) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

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

function labelFor(value) {
  const words = String(value ?? 'unknown')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase();
  return words ? `${words[0].toUpperCase()}${words.slice(1)}` : 'Unknown';
}

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
    ...(typeof place.platform === 'string'
      ? { platform: place.platform }
      : {}),
    ...(typeof place.code === 'string' ? { stopCode: place.code } : {}),
  };
}

function normalizeNotice(notice) {
  return {
    code: typeof notice?.code === 'string' ? notice.code : 'unknown',
    title:
      typeof notice?.title === 'string'
        ? notice.title
        : labelFor(notice?.code),
    ...(typeof notice?.severity === 'string'
      ? { severity: notice.severity }
      : {}),
  };
}

function normalizeIncident(incident) {
  return {
    type: typeof incident?.type === 'string' ? incident.type : 'unknown',
    effect:
      typeof incident?.effect === 'string' ? incident.effect : 'unknown',
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
    ...(Number.isFinite(action.length)
      ? { lengthMeters: action.length }
      : {}),
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

function allSectionActions(section) {
  return [section?.preActions, section?.actions, section?.postActions]
    .filter(Array.isArray)
    .flat();
}

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
    ...(typeof transport.color === 'string'
      ? { color: transport.color }
      : {}),
    ...(typeof transport.textColor === 'string'
      ? { textColor: transport.textColor }
      : {}),
    ...(typeof transport.wheelchairAccessible === 'string'
      ? { wheelchairAccessible: transport.wheelchairAccessible }
      : {}),
  };
}

function normalizeAgency(agency) {
  if (!agency || typeof agency !== 'object') return null;
  return {
    ...(typeof agency.id === 'string' ? { id: agency.id } : {}),
    ...(typeof agency.name === 'string' ? { name: agency.name } : {}),
    ...(typeof agency.website === 'string' ? { website: agency.website } : {}),
  };
}

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

function routeCacheKey(origin, destination, plannedAt) {
  return `here-transit:${formatPosition(origin)}:${formatPosition(destination)}:${encodeURIComponent(plannedAt)}`;
}

function failureReason(error) {
  return error?.name === 'AbortError' ? 'aborted' : 'network';
}

async function fetchRoutes({
  origin,
  destination,
  plannedAt,
  apiKey,
  fetchImpl,
  now,
  key,
  timeoutMs,
}) {
  const controller = new AbortController();
  let timedOut = false;
  let timeout;
  const timeoutResult = new Promise((resolve) => {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      resolve({ ok: false, reason: 'timeout' });
    }, timeoutMs);
  });
  const operation = (async () => {
    let response;
    try {
      response = await fetchImpl(
        buildHereTransitUrl(origin, destination, plannedAt, apiKey),
        { signal: controller.signal },
      );
    } catch (error) {
      return {
        ok: false,
        reason: timedOut ? 'timeout' : failureReason(error),
      };
    }

    if (timedOut) return { ok: false, reason: 'timeout' };
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
        reason: timedOut
          ? 'timeout'
          : error?.name === 'AbortError'
            ? 'aborted'
            : 'invalid-response',
      };
    }
    if (timedOut) return { ok: false, reason: 'timeout' };

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
  })();

  return Promise.race([operation, timeoutResult]).finally(() => {
    clearTimeout(timeout);
  });
}

function settleForCaller(request, signal) {
  if (!signal) return request;
  if (signal.aborted) {
    return Promise.resolve({ ok: false, reason: 'aborted' });
  }

  let onAbort;
  const aborted = new Promise((resolve) => {
    onAbort = () => resolve({ ok: false, reason: 'aborted' });
    signal.addEventListener('abort', onAbort, { once: true });
  });

  return Promise.race([request, aborted]).finally(() => {
    signal.removeEventListener('abort', onAbort);
  });
}

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

  let plannedAt;
  let key;
  try {
    plannedAt = isoTime(departureTime);
    key = routeCacheKey(origin, destination, plannedAt);
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
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

  const request = dedupeRequest(key, () =>
    fetchRoutes({
      origin,
      destination,
      plannedAt,
      apiKey,
      fetchImpl,
      now,
      key,
      timeoutMs,
    }),
  ).catch((error) => ({ ok: false, reason: failureReason(error) }));

  return settleForCaller(request, signal);
}
