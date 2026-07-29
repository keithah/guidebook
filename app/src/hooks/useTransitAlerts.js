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
  const [state, setState] = useState({
    alerts: [],
    status: 'loading',
    updatedAt: null,
    error: null,
  });
  const mountedRef = useRef(false);
  const timerRef = useRef();
  const controllerRef = useRef();
  const requestVersionRef = useRef(0);
  const refreshRef = useRef();

  const refresh = useCallback(async () => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    clearTimeout(timerRef.current);
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const result = await fetchServiceAlerts(agency, {
      signal: controller.signal,
    });
    if (
      !mountedRef.current ||
      requestVersion !== requestVersionRef.current ||
      result.reason === 'aborted'
    ) {
      return result;
    }
    setState(stateForResult(result));
    const delay =
      result.ok &&
      result.source !== 'stale' &&
      Number.isFinite(result.expiresAt)
        ? Math.max(0, result.expiresAt - Date.now())
        : REFRESH_MS;
    timerRef.current = setTimeout(() => {
      void refreshRef.current?.();
    }, delay);
    return result;
  }, [agency]);
  refreshRef.current = refresh;

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
      requestVersionRef.current += 1;
      controllerRef.current?.abort();
      clearTimeout(timerRef.current);
    };
  }, [refresh]);

  return { ...state, refresh };
}
