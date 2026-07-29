import { useCallback, useEffect, useState } from 'react';
import { fetchServiceAlerts } from '../lib/transit511.js';

const REFRESH_MS = 10 * 60_000;

function stateForResult(result) {
  if (!result.ok) {
    return {
      alerts: [],
      status: 'unavailable',
      updatedAt: null,
      error: result.reason,
    };
  }
  return {
    alerts: result.alerts,
    status:
      result.source === 'network'
        ? 'live'
        : result.source === 'cache'
          ? 'cached'
          : result.source,
    updatedAt: result.fetchedAt,
    error: result.source === 'stale' ? result.reason : null,
  };
}

export function useTransitAlerts(agency = 'SF') {
  const [state, setState] = useState({
    alerts: [],
    status: 'loading',
    updatedAt: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    const result = await fetchServiceAlerts(agency);
    setState(stateForResult(result));
    return result;
  }, [agency]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const load = async () => {
      const result = await fetchServiceAlerts(agency);
      if (cancelled) return;
      setState(stateForResult(result));
      const delay =
        result.ok &&
        result.source !== 'stale' &&
        Number.isFinite(result.expiresAt)
          ? Math.max(0, result.expiresAt - Date.now())
          : REFRESH_MS;
      timer = setTimeout(load, delay);
    };
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [agency]);

  return { ...state, refresh };
}
