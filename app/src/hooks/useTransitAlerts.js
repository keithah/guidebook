import { useCallback, useEffect, useRef, useState } from 'react';
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
  const mounted = useRef(false);
  const [state, setState] = useState({
    alerts: [],
    status: 'loading',
    updatedAt: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    const result = await fetchServiceAlerts(agency);
    if (mounted.current) setState(stateForResult(result));
    return result;
  }, [agency]);

  useEffect(() => {
    mounted.current = true;
    let timer;
    const load = async () => {
      const result = await refresh();
      if (!mounted.current) return;
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
      mounted.current = false;
      clearTimeout(timer);
    };
  }, [refresh]);

  return { ...state, refresh };
}
