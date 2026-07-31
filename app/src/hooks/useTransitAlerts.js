import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchServiceAlerts } from '../lib/transit511.js';

const REFRESH_MS = 10 * 60_000;
const IDLE_STATE = {
  alerts: [],
  status: 'idle',
  updatedAt: null,
  error: null,
};

/**
 * Converts a service-alert fetch result into UI state.
 * @param {Object} result - The fetch result to convert.
 * @returns {Object} The corresponding alerts, status, timestamp, and error state.
 */
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

/**
 * Fetches and periodically refreshes transit service alerts for an agency.
 * @param {string} [agency='SF'] - The transit agency whose alerts are fetched.
 * @param {Object} [options] - Alert fetching options.
 * @param {boolean} [options.enabled=true] - Whether alert fetching and polling are active.
 * @returns {{alerts: Array, status: string, updatedAt: (number|null), error: (string|null), refresh: Function}} The current alert state and a function for manually refreshing it.
 */
export function useTransitAlerts(agency = 'SF', { enabled = true } = {}) {
  const [state, setState] = useState(() =>
    enabled ? { ...IDLE_STATE, status: 'loading' } : IDLE_STATE,
  );
  const mountedRef = useRef(false);
  const timerRef = useRef();
  const controllerRef = useRef();
  const requestVersionRef = useRef(0);
  const refreshRef = useRef();

  const refresh = useCallback(async () => {
    if (!enabled) return { ok: false, reason: 'disabled' };
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
  }, [agency, enabled]);
  refreshRef.current = refresh;

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      requestVersionRef.current += 1;
      controllerRef.current?.abort();
      clearTimeout(timerRef.current);
      setState(IDLE_STATE);
      return () => {
        mountedRef.current = false;
      };
    }
    void refresh();
    return () => {
      mountedRef.current = false;
      requestVersionRef.current += 1;
      controllerRef.current?.abort();
      clearTimeout(timerRef.current);
    };
  }, [enabled, refresh]);

  return { ...(enabled ? state : IDLE_STATE), refresh };
}
