import { useEffect, useState } from 'react';
import { fetchStopDepartures } from '../lib/transit511.js';

// 511 keys default to 60 requests/hour. Shared five-minute caching keeps
// duplicate consumers from independently spending that request budget.
const REFRESH_MS = 5 * 60_000;

function formatMinutes(list) {
  if (!list?.length) return null;
  return `${list.slice(0, 2).join(', ')}′`;
}

function resultMeta(result) {
  if (!result.ok) {
    return {
      status: 'unavailable',
      updatedAt: null,
      error: result.reason,
    };
  }
  return {
    status:
      result.source === 'network'
        ? 'live'
        : result.source === 'cache'
          ? 'cached'
          : result.source,
    updatedAt: result.fetchedAt,
    expiresAt: result.expiresAt,
    error: result.source === 'stale' ? result.reason : null,
  };
}

export function useLiveDepartures(stops) {
  const [state, setState] = useState({ times: {}, meta: {} });

  useEffect(() => {
    let cancelled = false;
    let timer;
    const load = async () => {
      const entries = await Promise.all(
        stops.map(async (stop, index) => {
          if (!stop.stopCode) return null;
          const result = await fetchStopDepartures(
            stop.stopCode,
            stop.agency || 'SF',
          );
          return { index, result };
        }),
      );
      if (cancelled) return;

      const times = {};
      const meta = {};
      for (const entry of entries.filter(Boolean)) {
        const { index, result } = entry;
        const formatted = result.ok
          ? formatMinutes(result.minutesList)
          : null;
        if (formatted) times[index] = formatted;
        meta[index] = resultMeta(result);
      }
      setState({ times, meta });
      const freshExpirations = entries
        .filter(
          (entry) =>
            entry?.result.ok &&
            entry.result.source !== 'stale' &&
            Number.isFinite(entry.result.expiresAt),
        )
        .map((entry) => entry.result.expiresAt);
      const delay = freshExpirations.length
        ? Math.max(0, Math.min(...freshExpirations) - Date.now())
        : REFRESH_MS;
      timer = setTimeout(load, delay);
    };

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [stops]);

  return state;
}
