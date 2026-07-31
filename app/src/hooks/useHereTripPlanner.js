import { useCallback, useEffect, useRef, useState } from 'react';
import { searchHereDestinations } from '../lib/hereSearch.js';
import { fetchHereTransitRoutes } from '../lib/hereTransit.js';

/**
 * Creates a stable string key for an origin.
 * @param {string|Object} origin - The origin value or an object containing latitude and longitude.
 * @return {string} The origin string or a comma-separated latitude and longitude key.
 */
function keyForOrigin(origin) {
  if (typeof origin === 'string') return origin;
  return `${origin?.lat ?? ''},${origin?.lng ?? ''}`;
}

/**
 * Manage destination search and transit route retrieval for an origin.
 * @param {{origin: object|string}} options - The origin used for destination searches and route requests.
 * @returns {object} The planner state and actions for searching, selecting, clearing, and retrying destinations and routes.
 */
export function useHereTripPlanner({ origin }) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [searchStatus, setSearchStatus] = useState({ status: 'idle' });
  const [routeResult, setRouteResult] = useState(null);
  const searchAbortRef = useRef(null);
  const routeAbortRef = useRef(null);
  const originKey = keyForOrigin(origin);
  const previousOriginKey = useRef(originKey);

  const requestRoutes = useCallback(
    async (destination) => {
      routeAbortRef.current?.abort();
      const controller = new AbortController();
      routeAbortRef.current = controller;
      setRouteResult(null);

      const result = await fetchHereTransitRoutes(
        origin,
        destination.position,
        { signal: controller.signal },
      );
      if (
        controller.signal.aborted ||
        routeAbortRef.current !== controller ||
        result.reason === 'aborted'
      ) {
        return result;
      }
      setRouteResult(result);
      return result;
    },
    [origin],
  );

  const search = useCallback(
    async (requestedQuery = query) => {
      const nextQuery = String(requestedQuery ?? '').trim();
      setQuery(String(requestedQuery ?? ''));
      if (!nextQuery) {
        searchAbortRef.current?.abort();
        setCandidates([]);
        setSearchStatus({ status: 'idle' });
        return { ok: false, reason: 'empty-query' };
      }

      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setSearchStatus({ status: 'loading' });

      const result = await searchHereDestinations(nextQuery, origin, {
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        searchAbortRef.current !== controller ||
        result.reason === 'aborted'
      ) {
        return result;
      }

      if (!result.ok) {
        setCandidates([]);
        setSearchStatus({ status: 'error', reason: result.reason });
        return result;
      }

      setCandidates(result.candidates);
      setSearchStatus({
        status: result.candidates.length > 0 ? 'success' : 'empty',
      });
      return result;
    },
    [origin, query],
  );

  const selectDestination = useCallback(
    async (destination) => {
      searchAbortRef.current?.abort();
      setSearchStatus({ status: candidates.length > 0 ? 'success' : 'idle' });
      setSelectedDestination(destination);
      return requestRoutes(destination);
    },
    [candidates.length, requestRoutes],
  );

  const selectDirectDestination = useCallback(
    async (destination) => {
      searchAbortRef.current?.abort();
      setQuery(destination.title);
      setCandidates([]);
      setSearchStatus({ status: 'idle' });
      setSelectedDestination(destination);
      return requestRoutes(destination);
    },
    [requestRoutes],
  );

  const clearDestination = useCallback(() => {
    searchAbortRef.current?.abort();
    routeAbortRef.current?.abort();
    setQuery('');
    setCandidates([]);
    setSelectedDestination(null);
    setSearchStatus({ status: 'idle' });
    setRouteResult(null);
  }, []);

  const retryRoutes = useCallback(() => {
    if (!selectedDestination) return Promise.resolve(null);
    return requestRoutes(selectedDestination);
  }, [requestRoutes, selectedDestination]);

  useEffect(() => {
    if (previousOriginKey.current === originKey) return;
    previousOriginKey.current = originKey;
    if (selectedDestination) void requestRoutes(selectedDestination);
  }, [originKey, requestRoutes, selectedDestination]);

  useEffect(
    () => () => {
      searchAbortRef.current?.abort();
      routeAbortRef.current?.abort();
    },
    [],
  );

  return {
    query,
    setQuery,
    candidates,
    selectedDestination,
    searchStatus,
    routeResult,
    search,
    selectDestination,
    selectDirectDestination,
    clearDestination,
    retryRoutes,
  };
}
