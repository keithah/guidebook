import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchHereNearbyTransit } from '../lib/hereNearbyTransit.js';
import { isFinitePosition } from '../lib/providerFetch.js';

const MINIMUM_REFRESH_MS = 300_000;
const MAXIMUM_TIMEOUT_MS = 2_147_483_647;

/**
 * Load a departure board for the active location and refresh it after expiry.
 * @param {object} options - Hook options.
 * @param {{lat:number,lng:number}|null} options.origin - Active search origin.
 * @param {boolean} options.enabled - Whether nearby transit is active.
 * @returns {{result:object|null,refresh:Function}} Current-origin result and retry action.
 */
export function useNearbyTransit({ origin, enabled }) {
  const originKey = isFinitePosition(origin)
    ? `${origin.lat},${origin.lng}`
    : '';
  const [published, setPublished] = useState({ originKey: '', result: null });
  const controllerRef = useRef(null);
  const timerRef = useRef(null);
  const requestRef = useRef(null);
  const originKeyRef = useRef(originKey);
  const originRef = useRef(null);
  const enabledRef = useRef(enabled);

  originKeyRef.current = originKey;
  originRef.current = originKey ? { lat: origin.lat, lng: origin.lng } : null;
  enabledRef.current = enabled;

  const clearRefreshTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleRefresh = useCallback((refreshAt) => {
    const scheduleNext = () => {
      if (!enabledRef.current || !originKeyRef.current) return;
      const remaining = Math.max(0, refreshAt - Date.now());
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!enabledRef.current || !originKeyRef.current) return;
        if (Date.now() < refreshAt) {
          scheduleNext();
          return;
        }
        void requestRef.current?.();
      }, Math.min(MAXIMUM_TIMEOUT_MS, remaining));
    };

    scheduleNext();
  }, []);

  const requestNearby = useCallback(async () => {
    const requestKey = originKeyRef.current;
    const requestOrigin = originRef.current;
    if (!enabledRef.current || !requestKey || !requestOrigin) return null;

    clearRefreshTimer();
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPublished({ originKey: requestKey, result: null });

    let nextResult;
    try {
      nextResult = await fetchHereNearbyTransit(requestOrigin, {
        signal: controller.signal,
      });
    } catch (error) {
      nextResult = {
        ok: false,
        reason:
          controller.signal.aborted || error?.name === 'AbortError'
            ? 'aborted'
            : 'network',
      };
    }

    if (
      controller.signal.aborted ||
      controllerRef.current !== controller ||
      originKeyRef.current !== requestKey ||
      !enabledRef.current ||
      nextResult?.reason === 'aborted'
    ) {
      return nextResult;
    }

    setPublished({ originKey: requestKey, result: nextResult });
    const expiresAt = Number(nextResult?.expiresAt ?? 0);
    const refreshAt = Math.max(
      Date.now() + MINIMUM_REFRESH_MS,
      Number.isFinite(expiresAt) ? expiresAt : 0,
    );
    scheduleRefresh(refreshAt);
    return nextResult;
  }, [clearRefreshTimer, scheduleRefresh]);

  requestRef.current = requestNearby;

  useEffect(() => {
    controllerRef.current?.abort();
    clearRefreshTimer();
    setPublished({ originKey: '', result: null });

    if (enabled && originKey) void requestRef.current();

    return () => {
      controllerRef.current?.abort();
      clearRefreshTimer();
    };
  }, [clearRefreshTimer, enabled, originKey]);

  const refresh = useCallback(() => {
    if (!enabledRef.current || !originKeyRef.current) {
      return Promise.resolve(null);
    }
    return requestRef.current();
  }, []);

  const result = published.originKey === originKey ? published.result : null;
  return { result, refresh };
}
