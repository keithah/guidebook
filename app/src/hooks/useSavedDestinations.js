import { useCallback, useEffect, useRef, useState } from 'react';
import { savedStateStore } from '../lib/responseStore.js';

const STORE_KEY = 'saved-destinations';
const MAX_SAVED_DESTINATIONS = 10;

/**
 * Normalizes a saved destination candidate.
 * @param {*} candidate - The candidate to validate and normalize.
 * @return {?Object} The normalized candidate, or `null` when its ID or coordinates are invalid.
 */
function normalizeCandidate(candidate) {
  if (
    typeof candidate?.id !== 'string' ||
    !Number.isFinite(candidate?.position?.lat) ||
    !Number.isFinite(candidate?.position?.lng)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    title: typeof candidate.title === 'string' ? candidate.title : '',
    address: typeof candidate.address === 'string' ? candidate.address : '',
    position: {
      lat: candidate.position.lat,
      lng: candidate.position.lng,
    },
    resultType:
      typeof candidate.resultType === 'string' ? candidate.resultType : 'place',
    categories: Array.isArray(candidate.categories)
      ? candidate.categories.filter((category) => typeof category === 'string')
      : [],
    distanceMeters: Number.isFinite(candidate.distanceMeters)
      ? candidate.distanceMeters
      : null,
  };
}

/**
 * Normalize, deduplicate, and limit a collection of saved destinations.
 * @param {*} value - The value containing candidate destinations.
 * @return {Array<Object>} The normalized collection, capped at the maximum number of saved destinations.
 */
function normalizeCollection(value) {
  const seen = new Set();
  const normalized = [];
  for (const candidate of Array.isArray(value) ? value : []) {
    const place = normalizeCandidate(candidate);
    if (!place || seen.has(place.id)) continue;
    seen.add(place.id);
    normalized.push(place);
    if (normalized.length === MAX_SAVED_DESTINATIONS) break;
  }
  return normalized;
}

/**
 * Toggles a destination in a saved collection.
 * @param {Array<Object>} collection - The current saved destinations.
 * @param {Object} candidate - The destination to add or remove.
 * @return {Array<Object>} The updated collection, capped at the maximum number of saved destinations.
 */
function toggleCandidate(collection, candidate) {
  return collection.some((place) => place.id === candidate.id)
    ? collection.filter((place) => place.id !== candidate.id)
    : [
        candidate,
        ...collection.filter((place) => place.id !== candidate.id),
      ].slice(0, MAX_SAVED_DESTINATIONS);
}

/**
 * Manage a user's saved destinations with persistent storage.
 * @returns {{
 *   savedDestinations: Array,
 *   loading: boolean,
 *   isSaved: Function,
 *   toggleSaved: Function
 * }} The saved destinations, loading state, membership check, and toggle action.
 */
export function useSavedDestinations() {
  const [savedDestinations, setSavedDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const savedRef = useRef([]);
  const hydratedRef = useRef(false);
  const pendingMutationsRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const stored = await savedStateStore.get(STORE_KEY);
        if (cancelled) return;
        const normalizedStored = normalizeCollection(stored);
        const pendingMutations = pendingMutationsRef.current;
        const hydrated = pendingMutations.reduce(
          toggleCandidate,
          normalizedStored,
        );
        pendingMutationsRef.current = [];
        hydratedRef.current = true;
        savedRef.current = hydrated;
        setSavedDestinations(hydrated);
        if (
          pendingMutations.length > 0 ||
          JSON.stringify(hydrated) !== JSON.stringify(stored ?? [])
        ) {
          await savedStateStore.put(STORE_KEY, hydrated);
        }
      } catch {
        // Saved destinations are an enhancement; the planner stays usable.
        hydratedRef.current = true;
        pendingMutationsRef.current = [];
        try {
          await savedStateStore.put(STORE_KEY, savedRef.current);
        } catch {
          // Keep the in-memory collection usable if persistence is unavailable.
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isSaved = useCallback(
    (candidateOrId) => {
      const id =
        typeof candidateOrId === 'string' ? candidateOrId : candidateOrId?.id;
      return savedDestinations.some((candidate) => candidate.id === id);
    },
    [savedDestinations],
  );

  const toggleSaved = useCallback(async (candidate) => {
    const normalized = normalizeCandidate(candidate);
    if (!normalized) return;

    if (!hydratedRef.current) {
      pendingMutationsRef.current.push(normalized);
    }
    const next = toggleCandidate(savedRef.current, normalized);
    savedRef.current = next;
    setSavedDestinations(next);
    if (!hydratedRef.current) return;
    try {
      await savedStateStore.put(STORE_KEY, next);
    } catch {
      // Keep the in-memory collection usable if persistence is unavailable.
    }
  }, []);

  return { savedDestinations, loading, isSaved, toggleSaved };
}
