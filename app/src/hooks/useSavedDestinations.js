import { useCallback, useEffect, useRef, useState } from 'react';
import { savedStateStore } from '../lib/responseStore.js';

const STORE_KEY = 'saved-destinations';
const MAX_SAVED_DESTINATIONS = 10;

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
      typeof candidate.resultType === 'string'
        ? candidate.resultType
        : 'place',
    categories: Array.isArray(candidate.categories)
      ? candidate.categories.filter((category) => typeof category === 'string')
      : [],
    distanceMeters: Number.isFinite(candidate.distanceMeters)
      ? candidate.distanceMeters
      : null,
  };
}

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

export function useSavedDestinations() {
  const [savedDestinations, setSavedDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const savedRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const stored = await savedStateStore.get(STORE_KEY);
        if (cancelled) return;
        const normalized = normalizeCollection(stored);
        savedRef.current = normalized;
        setSavedDestinations(normalized);
        if (JSON.stringify(normalized) !== JSON.stringify(stored ?? [])) {
          await savedStateStore.put(STORE_KEY, normalized);
        }
      } catch {
        // Saved destinations are an enhancement; the planner stays usable.
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
        typeof candidateOrId === 'string'
          ? candidateOrId
          : candidateOrId?.id;
      return savedDestinations.some((candidate) => candidate.id === id);
    },
    [savedDestinations],
  );

  const toggleSaved = useCallback(async (candidate) => {
    const normalized = normalizeCandidate(candidate);
    if (!normalized) return;

    const current = savedRef.current;
    const next = current.some((place) => place.id === normalized.id)
      ? current.filter((place) => place.id !== normalized.id)
      : [normalized, ...current.filter((place) => place.id !== normalized.id)].slice(
          0,
          MAX_SAVED_DESTINATIONS,
        );
    savedRef.current = next;
    setSavedDestinations(next);
    try {
      await savedStateStore.put(STORE_KEY, next);
    } catch {
      // Keep the in-memory collection usable if persistence is unavailable.
    }
  }, []);

  return { savedDestinations, loading, isSaved, toggleSaved };
}
