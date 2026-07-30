import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchHereWalkingRoute } from '../lib/hereWalking.js';

/**
 * Build a stable key for one walking journey.
 * @param {Object} origin - Walking origin.
 * @param {Object} destination - Walking destination.
 * @returns {string} Coordinate key, or an empty string without a destination.
 */
function keyForJourney(origin, destination) {
  if (!destination) return '';
  return `${origin?.lat ?? ''},${origin?.lng ?? ''}:${destination?.lat ?? ''},${destination?.lng ?? ''}`;
}

/**
 * Lazily load and retain HERE walking directions for the active journey.
 * @param {Object} options - Hook options.
 * @param {Object} options.origin - Walking origin.
 * @param {Object|null} options.destination - Walking destination.
 * @param {boolean} options.enabled - Whether walking mode is active.
 * @returns {{routeResult:Object|null,retryWalking:Function}} Walking route state and retry action.
 */
export function useWalkingRoute({ origin, destination, enabled }) {
  const [routeResult, setRouteResult] = useState(null);
  const controllerRef = useRef(null);
  const successfulJourneyKeyRef = useRef('');
  const journeyKey = keyForJourney(origin, destination);
  const previousJourneyKeyRef = useRef(journeyKey);
  const originLat = origin?.lat;
  const originLng = origin?.lng;
  const destinationLat = destination?.lat;
  const destinationLng = destination?.lng;

  const requestWalking = useCallback(async () => {
    if (!journeyKey) return null;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const result = await fetchHereWalkingRoute(
      { lat: originLat, lng: originLng },
      { lat: destinationLat, lng: destinationLng },
      { signal: controller.signal },
    );

    if (
      controller.signal.aborted ||
      controllerRef.current !== controller ||
      result.reason === 'aborted'
    ) {
      return result;
    }

    successfulJourneyKeyRef.current = result.ok ? journeyKey : '';
    setRouteResult(result);
    return result;
  }, [
    destinationLat,
    destinationLng,
    journeyKey,
    originLat,
    originLng,
  ]);

  useEffect(() => {
    if (previousJourneyKeyRef.current === journeyKey) return;
    previousJourneyKeyRef.current = journeyKey;
    controllerRef.current?.abort();
    successfulJourneyKeyRef.current = '';
    setRouteResult(null);
  }, [journeyKey]);

  useEffect(() => {
    if (!enabled || !journeyKey) {
      controllerRef.current?.abort();
      return;
    }
    if (successfulJourneyKeyRef.current === journeyKey) return;
    void requestWalking();
  }, [enabled, journeyKey, requestWalking]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const retryWalking = useCallback(() => {
    if (!journeyKey) return Promise.resolve(null);
    return requestWalking();
  }, [journeyKey, requestWalking]);

  return { routeResult, retryWalking };
}
