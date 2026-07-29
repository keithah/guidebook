import {
  providerFailureReason,
  providerHttpFailure,
  sharedProviderRequest,
} from './providerFetch.js';
import { providerResponseStore } from './responseStore.js';

const STOP_MONITORING_URL = 'https://api.511.org/transit/StopMonitoring';
const SERVICE_ALERTS_URL = 'https://api.511.org/transit/servicealerts';
const DEPARTURE_FRESH_MS = 5 * 60_000;
const DEPARTURE_STALE_MS = 30 * 60_000;
const ALERT_FRESH_MS = 10 * 60_000;
const ALERT_STALE_MS = 60 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Converts a date-like value to a numeric timestamp.
 * @param {*} value - A Date object or value coercible to a number.
 * @return {number} The corresponding timestamp or numeric value.
 */
function asTime(value) {
  if (value instanceof Date) return value.getTime();
  return Number(value);
}

/**
 * Converts a GTFS timestamp value to milliseconds since the Unix epoch.
 * @param {*} value - The timestamp value to convert.
 * @return {number|null} The timestamp in milliseconds, or `null` if the value is empty or invalid.
 */
function gtfsTime(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric < 10_000_000_000 ? numeric * 1_000 : numeric;
}

/**
 * Converts a GTFS time value to an ISO 8601 timestamp.
 * @param {*} value - The GTFS time value to convert.
 * @return {string|null} The ISO 8601 timestamp, or `null` if the value is invalid.
 */
function isoGtfsTime(value) {
  const time = gtfsTime(value);
  return time === null ? null : new Date(time).toISOString();
}

/**
 * Converts monitored stop visit arrival times into minutes from the current time.
 * @param {object} payload - The stop monitoring response payload.
 * @param {Date|number} [now=Date.now()] - The reference time for calculating arrival offsets.
 * @returns {number[]} The arrival times in minutes, with past arrivals represented as zero.
 */
export function normalizeStopDepartures(payload, now = Date.now()) {
  const currentTime = asTime(now);
  const visits =
    payload?.ServiceDelivery?.StopMonitoringDelivery?.MonitoredStopVisit;
  if (!Array.isArray(visits)) return [];

  return visits
    .map(
      (visit) =>
        visit?.MonitoredVehicleJourney?.MonitoredCall?.ExpectedArrivalTime,
    )
    .filter((arrival) => typeof arrival === 'string' && arrival)
    .map((arrival) =>
      Math.max(0, Math.round((Date.parse(arrival) - currentTime) / 60_000)),
    )
    .filter(Number.isFinite);
}

/**
 * Selects the most suitable non-empty translated text, preferring English.
 * @param {object} translated - An object containing a `Translations` collection.
 * @return {string} The trimmed English translation, the first valid translation, or an empty string.
 */
function translationText(translated) {
  const translations = translated?.Translations;
  if (!Array.isArray(translations)) return '';
  const valid = translations.filter(
    (translation) =>
      typeof translation?.Text === 'string' && translation.Text.trim(),
  );
  const english = valid.find((translation) =>
    String(translation.Language ?? '')
      .toLowerCase()
      .startsWith('en'),
  );
  return (english ?? valid[0])?.Text.trim() ?? '';
}

/**
 * Finds the period that is active at the specified time.
 * @param {Array<Object>} periods - The periods to evaluate.
 * @param {number} now - The current time in GTFS milliseconds.
 * @return {{start: string|null, end: string|null}|null} The active period with ISO timestamps, `null` if no period is active, or an object with null boundaries when no periods are provided.
 */
function currentActivePeriod(periods, now) {
  if (!Array.isArray(periods) || periods.length === 0) {
    return { start: null, end: null };
  }

  const current = periods.find((period) => {
    const start = gtfsTime(period?.Start);
    const end = gtfsTime(period?.End);
    return (start === null || start <= now) && (end === null || now < end);
  });
  if (!current) return null;
  return {
    start: isoGtfsTime(current.Start),
    end: isoGtfsTime(current.End),
  };
}

/**
 * Normalize active service alerts into a consistent alert representation.
 * @param {Object} payload - The service alerts response payload.
 * @param {Date|number} [now=Date.now()] - The reference time used to determine active periods.
 * @param {string} [agency] - Fallback agency identifier when an alert does not specify one.
 * @returns {Array<Object>} The normalized active alerts with translated text, affected routes, severity, and timing information.
 */
export function normalizeServiceAlerts(payload, now = Date.now(), agency) {
  const currentTime = asTime(now);
  const entities = payload?.Entities;
  if (!Array.isArray(entities)) return [];
  const updatedAt = isoGtfsTime(payload?.Header?.Timestamp);

  return entities.flatMap((entity) => {
    const alert = entity?.Alert;
    const header = translationText(alert?.HeaderText);
    if (!alert || typeof entity?.Id !== 'string' || !header) return [];

    const activePeriod = currentActivePeriod(alert.ActivePeriods, currentTime);
    if (!activePeriod) return [];

    const informedEntities = Array.isArray(alert.InformedEntities)
      ? alert.InformedEntities
      : [];
    const affectedLines = [
      ...new Set(
        informedEntities
          .map((informed) => informed?.RouteId)
          .filter((routeId) => typeof routeId === 'string' && routeId),
      ),
    ];
    const alertAgency =
      informedEntities.find(
        (informed) =>
          typeof informed?.AgencyId === 'string' && informed.AgencyId,
      )?.AgencyId ??
      agency ??
      '';

    return [
      {
        id: entity.Id,
        agency: alertAgency,
        affectedLines,
        severity:
          typeof alert.Effect === 'string' ? alert.Effect : 'UNKNOWN_EFFECT',
        header,
        description: translationText(alert.DescriptionText),
        activePeriod,
        url: translationText(alert.Url),
        updatedAt,
      },
    ];
  });
}

/**
 * Parses a response body as JSON after removing a leading UTF-8 byte-order mark.
 * @param {Response} response - The response whose body should be parsed.
 * @return {any} The parsed JSON value.
 */
async function readJson(response) {
  const text = (await response.text()).replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

/**
 * Builds an endpoint URL with API credentials and query parameters.
 * @param {string} base - The base endpoint URL.
 * @param {string} apiKey - The API key to include in the query.
 * @param {Object} parameters - Additional query parameter values.
 * @returns {URL} The configured endpoint URL.
 */
function buildUrl(base, apiKey, parameters) {
  const url = new URL(base);
  url.searchParams.set('api_key', apiKey);
  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, value);
  }
  url.searchParams.set('format', 'json');
  return url;
}

/**
 * Fetch, validate, normalize, and cache a 511.org response.
 * @param {Object} options - Request and caching configuration.
 * @param {URL|string} options.url - Endpoint URL.
 * @param {Function} options.fetchImpl - Fetch implementation.
 * @param {Function} options.normalize - Converts the validated payload into cached data.
 * @param {Function} options.validate - Determines whether the response payload is valid.
 * @param {string} options.dataField - Property name for the normalized data.
 * @param {string} options.key - Cache key.
 * @param {number} options.freshMs - Fresh-cache duration in milliseconds.
 * @param {number} options.staleMs - Stale-cache duration in milliseconds.
 * @param {Function} options.now - Function that returns the current time in milliseconds.
 * @param {AbortSignal} options.signal - Signal used to cancel the provider request.
 * @param {Function} options.didTimeout - Indicates whether the request timeout has elapsed.
 * @returns {Promise<Object>} A successful network result containing normalized data and cache timestamps, or a failure result with a reason.
 */
async function request511({
  url,
  fetchImpl,
  normalize,
  validate,
  dataField,
  key,
  freshMs,
  staleMs,
  now,
  signal,
  didTimeout,
}) {
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

  let payload;
  try {
    payload = await readJson(response);
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
  if (!validate(payload)) return { ok: false, reason: 'invalid-response' };

  const fetchedAt = now();
  const data = normalize(payload, fetchedAt);
  const expiresAt = fetchedAt + freshMs;
  try {
    await providerResponseStore.put({
      key,
      data: { [dataField]: data },
      fetchedAt,
      expiresAt,
      staleUntil: fetchedAt + staleMs,
    });
  } catch {
    // Persistent caching is best-effort; the network result remains usable.
  }

  return {
    ok: true,
    [dataField]: data,
    source: 'network',
    fetchedAt,
    expiresAt,
  };
}

/**
 * Retrieves and caches normalized transit data, using stale cached data when an unavailable network response permits it.
 * @param {Object} options - Request and caching configuration.
 * @param {string} options.key - Cache key for the request.
 * @param {string} options.dataField - Property containing the normalized data.
 * @param {AbortSignal} [options.signal] - Signal used to cancel the caller's request.
 * @returns {Promise<Object>} A result containing normalized data and its source, or a failure reason.
 */
async function cached511Request({
  key,
  dataField,
  url,
  fetchImpl,
  signal,
  normalize,
  validate,
  freshMs,
  staleMs,
  now,
}) {
  const currentTime = now();
  let cached;
  try {
    cached = await providerResponseStore.get(key);
  } catch {
    // Persistent caching is best-effort; continue with the network.
  }

  const cachedData = cached?.data?.[dataField];
  const validCache = Array.isArray(cachedData);
  if (validCache && cached.expiresAt > currentTime) {
    return {
      ok: true,
      [dataField]: cachedData,
      source: 'cache',
      fetchedAt: cached.fetchedAt,
      expiresAt: cached.expiresAt,
    };
  }

  if (cached && (!validCache || cached.staleUntil <= currentTime)) {
    try {
      await providerResponseStore.delete(key);
    } catch {
      // Persistent caching is best-effort; continue with the network.
    }
  }

  const result = await sharedProviderRequest({
    key,
    signal,
    timeoutMs: REQUEST_TIMEOUT_MS,
    loader: ({ signal: providerSignal, didTimeout }) =>
      request511({
        url,
        fetchImpl,
        normalize,
        validate,
        dataField,
        key,
        freshMs,
        staleMs,
        now,
        signal: providerSignal,
        didTimeout,
      }),
  });

  if (
    !result.ok &&
    result.reason !== 'aborted' &&
    validCache &&
    cached.expiresAt <= currentTime &&
    cached.staleUntil > currentTime
  ) {
    return {
      ok: true,
      [dataField]: cachedData,
      source: 'stale',
      fetchedAt: cached.fetchedAt,
      expiresAt: cached.expiresAt,
      reason: result.reason,
    };
  }

  return result;
}

/**
 * Fetch departure times for a transit stop.
 * @param {string} stopCode - The stop identifier.
 * @param {string} [agency='SF'] - The transit agency identifier.
 * @param {Object} [options] - Request configuration.
 * @param {AbortSignal} [options.signal] - Signal used to cancel the request.
 * @param {string} [options.apiKey] - 511 API key.
 * @returns {Promise<Object>} A result containing departure minutes or a failure reason.
 */
export async function fetchStopDepartures(
  stopCode,
  agency = 'SF',
  {
    signal,
    fetchImpl = fetch,
    apiKey = import.meta.env.VITE_API_511_KEY,
    now = Date.now,
  } = {},
) {
  if (!apiKey?.trim()) return { ok: false, reason: 'missing-api-key' };
  if (!String(stopCode ?? '').trim()) {
    return { ok: false, reason: 'missing-stop-code' };
  }
  if (signal?.aborted) return { ok: false, reason: 'aborted' };

  const normalizedAgency = String(agency || 'SF').trim();
  const normalizedStopCode = String(stopCode).trim();
  const key = `511:departures:${normalizedAgency}:${normalizedStopCode}`;
  return cached511Request({
    key,
    dataField: 'minutesList',
    url: buildUrl(STOP_MONITORING_URL, apiKey, {
      agency: normalizedAgency,
      stopcode: normalizedStopCode,
    }),
    fetchImpl,
    signal,
    normalize: normalizeStopDepartures,
    validate: (payload) =>
      payload?.ServiceDelivery?.StopMonitoringDelivery !== null &&
      typeof payload?.ServiceDelivery?.StopMonitoringDelivery === 'object' &&
      Array.isArray(
        payload.ServiceDelivery.StopMonitoringDelivery.MonitoredStopVisit,
      ),
    freshMs: DEPARTURE_FRESH_MS,
    staleMs: DEPARTURE_STALE_MS,
    now,
  });
}

/**
 * Fetches and normalizes active service alerts for an agency.
 * @param {string} [agency='SF'] - The agency identifier used to request alerts.
 * @param {Object} [options] - Request configuration.
 * @param {AbortSignal} [options.signal] - Signal used to cancel the request.
 * @param {Function} [options.fetchImpl=fetch] - Fetch implementation.
 * @param {string} [options.apiKey] - API key for the 511 service.
 * @param {Function} [options.now=Date.now] - Function used to obtain the current time.
 * @returns {Promise<Object>} The request result containing normalized alerts or a failure reason.
 */
export async function fetchServiceAlerts(
  agency = 'SF',
  {
    signal,
    fetchImpl = fetch,
    apiKey = import.meta.env.VITE_API_511_KEY,
    now = Date.now,
  } = {},
) {
  if (!apiKey?.trim()) return { ok: false, reason: 'missing-api-key' };
  if (signal?.aborted) return { ok: false, reason: 'aborted' };

  const normalizedAgency = String(agency || 'SF').trim();
  const key = `511:alerts:${normalizedAgency}`;
  return cached511Request({
    key,
    dataField: 'alerts',
    url: buildUrl(SERVICE_ALERTS_URL, apiKey, {
      agency: normalizedAgency,
    }),
    fetchImpl,
    signal,
    normalize: (payload, currentTime) =>
      normalizeServiceAlerts(payload, currentTime, normalizedAgency),
    validate: (payload) =>
      payload?.Header !== null &&
      typeof payload?.Header === 'object' &&
      Array.isArray(payload?.Entities),
    freshMs: ALERT_FRESH_MS,
    staleMs: ALERT_STALE_MS,
    now,
  });
}
