import { useEffect, useState } from 'react';
import { fetchStopDepartures } from '../lib/transit511.js';

const REFRESH_MS = 60_000;

function formatMinutes(list) {
  if (!list || !list.length) return null;
  return list.slice(0, 2).join(', ') + '′';
}

// Live next-departure strings for stops that carry a 511 stopCode. Returns a
// map of stop index -> "4, 16′". Stops without a code (or when the API key /
// network is missing) simply never appear, so callers fall back to the
// static times baked into the property data.
export function useLiveDepartures(stops) {
  const [times, setTimes] = useState({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const entries = await Promise.all(
        stops.map(async (s, i) => {
          if (!s.stopCode) return null;
          const res = await fetchStopDepartures(s.stopCode, s.agency || 'SF');
          return res.ok && res.minutesList.length ? [i, formatMinutes(res.minutesList)] : null;
        })
      );
      if (!cancelled) setTimes(Object.fromEntries(entries.filter(Boolean)));
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(stops.map((s) => s.stopCode))]);

  return times;
}
