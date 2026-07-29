import { dedupeRequest } from './requestCoordinator.js';
import { providerResponseStore } from './responseStore.js';

const STOP_MONITORING_URL =
  'https://api.511.org/transit/StopMonitoring';
const SERVICE_ALERTS_URL = 'https://api.511.org/transit/servicealerts';
const DEPARTURE_FRESH_MS = 5 * 60_000;
const DEPARTURE_STALE_MS = 30 * 60_000;
const ALERT_FRESH_MS = 10 * 60_000;
const ALERT_STALE_MS = 60 * 60_000;

function asTime(value) {
  if (value instanceof Date) return value.getTime();
  return Number(value);
}

function gtfsTime(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric < 10_000_000_000 ? numeric * 1_000 : numeric;
}

function isoGtfsTime(value) {
  const time = gtfsTime(value);
  return time === null ? null : new Date(time).toISOString();
}

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
      )?.AgencyId ?? agency ?? '';

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

function failureReason(error) {
  return error?.name === 'AbortError' ? 'timeout' : 'network';
}

function responseFailure(response) {
  if (response.status === 401 || response.status === 403) {
    return 'unauthorized';
  }
  if (response.status === 429) return 'rate-limited';
  return response.ok ? null : 'network';
}

async function readJson(response) {
  const text = (await response.text()).replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

function buildUrl(base, apiKey, parameters) {
  const url = new URL(base);
  url.searchParams.set('api_key', apiKey);
  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, value);
  }
  url.searchParams.set('format', 'json');
  return url;
}

async function request511({
  url,
  fetchImpl,
  signal,
  normalize,
  dataField,
  key,
  freshMs,
  staleMs,
  now,
}) {
  let response;
  try {
    response = await fetchImpl(url, { signal });
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  }

  const httpFailure = responseFailure(response);
  if (httpFailure) return { ok: false, reason: httpFailure };

  let payload;
  try {
    payload = await readJson(response);
  } catch (error) {
    return {
      ok: false,
      reason:
        error?.name === 'AbortError' ? 'timeout' : 'invalid-response',
    };
  }

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

async function cached511Request({
  key,
  dataField,
  url,
  fetchImpl,
  signal,
  normalize,
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

  const result = await dedupeRequest(key, () =>
    request511({
      url,
      fetchImpl,
      signal,
      normalize,
      dataField,
      key,
      freshMs,
      staleMs,
      now,
    }),
  ).catch((error) => ({ ok: false, reason: failureReason(error) }));

  if (
    !result.ok &&
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
  if (signal?.aborted) return { ok: false, reason: 'timeout' };

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
    freshMs: DEPARTURE_FRESH_MS,
    staleMs: DEPARTURE_STALE_MS,
    now,
  });
}

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
  if (signal?.aborted) return { ok: false, reason: 'timeout' };

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
    freshMs: ALERT_FRESH_MS,
    staleMs: ALERT_STALE_MS,
    now,
  });
}
