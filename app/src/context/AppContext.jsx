import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import property from '../data/properties/sfcottage.json';
import {
  readStayFromLocation,
  computeStayPhase,
  encodeStay,
  normalizeStayLocationOverride,
} from '../lib/stayHash.js';
import { fetchCurrentWeather, fetchWeatherForDate, fetchForecastDays } from '../lib/weather.js';
import { getCurrentPosition } from '../lib/geo.js';
import { useLocalStorageState } from '../hooks/useLocalStorageState.js';
import { useLiveDepartures } from '../hooks/useLiveDepartures.js';

const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

const TABS = ['home', 'arrive', 'cottage', 'around', 'explore', 'help'];

/**
 * Provide application-wide state and actions through `AppContext`.
 * @returns {JSX.Element} The context provider containing the application children.
 */
export function AppProvider({ children }) {
  const scrollRef = useRef(null);

  // ---- Guest identity: /sfcottage#<hash> ----------------------------------
  const [stay, setStay] = useState(() => readStayFromLocation());
  useEffect(() => {
    const onHashChange = () => setStay(readStayFromLocation());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const stayLocationOverride = useMemo(
    () => normalizeStayLocationOverride(stay),
    [stay],
  );
  const stayHash = window.location.hash;
  const activeStayLocationHashRef = useRef(null);

  const isGuest = !!stay;
  const isGeneric = !stay;
  const guestName = stay?.guestName || '';
  const accessCode = (isGuest && stay.code) || property.checkin.code;

  const demoPhaseOverride = new URLSearchParams(window.location.search).get('phase');
  const phase = isGuest
    ? demoPhaseOverride && ['before', 'during', 'checkout'].includes(demoPhaseOverride)
      ? demoPhaseOverride
      : computeStayPhase(stay.checkin, stay.checkout)
    : null;

  function previewAsGuest({ guestName, checkin, checkout, code }) {
    window.location.hash = encodeStay({ guestName, checkin, checkout, code });
  }
  function exitGuestPreview() {
    window.location.hash = '';
  }

  // ---- Tab / sub-screen navigation ----------------------------------------
  const [tab, setTab] = useState('home');
  const [sub, setSub] = useState(null); // 'nearby' | 'ride' | null (within 'around')
  const [query, setQuery] = useState('');

  const resetScroll = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  const goTab = useCallback(
    (t) => () => {
      setTab(t);
      setSub(null);
      setQuery('');
      resetScroll();
    },
    [resetScroll]
  );
  const goSub = useCallback(
    (s) => () => {
      setTab('around');
      setSub(s);
      resetScroll();
    },
    [resetScroll]
  );
  const backToAround = useCallback(() => {
    setSub(null);
    resetScroll();
  }, [resetScroll]);

  // Deep link into a section of the Arrive page (home-screen quick links).
  const [arriveTarget, setArriveTarget] = useState(null);
  const goArrive = useCallback(
    (section) => () => {
      setTab('arrive');
      setSub(null);
      setQuery('');
      setArriveTarget(section);
      resetScroll();
    },
    [resetScroll]
  );
  const clearArriveTarget = useCallback(() => setArriveTarget(null), []);

  // ---- Search ---------------------------------------------------------------
  const q = query.trim().toLowerCase();
  const results =
    q.length >= 2
      ? property.searchIndex
          .filter((e) => (e.label + ' ' + e.where).toLowerCase().includes(q))
          .slice(0, 5)
      : [];

  // ---- WiFi -------------------------------------------------------------
  const [wifiCopied, setWifiCopied] = useState(false);
  const [wifiJoining, setWifiJoining] = useState(false);
  const copyTimer = useRef(null);
  const joinTimer = useRef(null);
  const copyWifiPassword = useCallback(() => {
    try {
      navigator.clipboard.writeText(property.wifi.password);
    } catch {
      /* clipboard may be unavailable (non-https, permissions) — button still gives visual feedback */
    }
    setWifiCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setWifiCopied(false), 1800);
  }, []);
  const joinWifi = useCallback(() => {
    setWifiJoining(true);
    clearTimeout(joinTimer.current);
    joinTimer.current = setTimeout(() => setWifiJoining(false), 2200);
  }, []);

  // ---- Checkout checklist (shared between Home/checkout and Help) --------
  // Persisted so a guest who closes the app mid-checkout doesn't lose their progress.
  const [done, setDone] = useLocalStorageState('sfcottage:checklist-done', {});
  const toggleChecklistItem = useCallback(
    (i) => {
      setDone((d) => ({ ...d, [i]: !d[i] }));
    },
    [setDone]
  );

  // ---- Explore filters ----------------------------------------------------
  const [filter, setFilter] = useState('all');

  // ---- Around Here / Nearby -------------------------------------------------
  const [located, setLocated] = useState(false);
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);
  const [backOpen, setBackOpen] = useState(false);

  useEffect(() => {
    if (
      coords?.source === 'stay-override' &&
      activeStayLocationHashRef.current !== stayHash
    ) {
      activeStayLocationHashRef.current = null;
      setCoords(null);
      setLocated(false);
    }
  }, [coords, stayHash]);

  const allowLocation = useCallback(async () => {
    setLocating(true);
    setLocateError(null);
    try {
      const pos = stayLocationOverride ?? (await getCurrentPosition());
      activeStayLocationHashRef.current =
        pos.source === 'stay-override' ? stayHash : null;
      setCoords(pos);
      setLocated(true);
    } catch (err) {
      activeStayLocationHashRef.current = null;
      setLocateError(err.message || 'Could not get your location.');
      setCoords({ lat: property.address.lat, lng: property.address.lng });
      setLocated(true);
    } finally {
      setLocating(false);
    }
  }, [stayHash, stayLocationOverride]);
  const useCottageAsLocation = useCallback(() => {
    activeStayLocationHashRef.current = null;
    setCoords({ lat: property.address.lat, lng: property.address.lng });
    setLocated(true);
  }, []);

  // ---- Weather (NWS, no API key) -------------------------------------------
  // `weather` is always today's conditions; before a stay starts we also fetch
  // the arrival-day outlook so the home card can show both. All three requests
  // share one cached NWS periods fetch (see weather.js).
  const [weather, setWeather] = useState({ ok: false, loading: true });
  const [arrivalWeather, setArrivalWeather] = useState(null);
  const [forecastDays, setForecastDays] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const { lat, lng } = property.address;
    fetchCurrentWeather(lat, lng).then((res) => {
      if (!cancelled) setWeather({ ...res, loading: false });
    });
    fetchForecastDays(lat, lng).then((res) => {
      if (!cancelled) setForecastDays(res.ok ? res.days : []);
    });
    if (phase === 'before' && stay?.checkin) {
      fetchWeatherForDate(lat, lng, stay.checkin).then((res) => {
        if (!cancelled) setArrivalWeather(res.ok ? res : null);
      });
    } else {
      setArrivalWeather(null);
    }
    return () => {
      cancelled = true;
    };
    // Re-fetch only when the phase we need weather framed for changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'before', stay?.checkin]);

  // ---- Live K departures (511) for Home / TopBar ---------------------------
  const { times: optionTimes } = useLiveDepartures(property.transit.options);
  const kIndex = property.transit.options.findIndex((o) => o.line === 'K');
  const kTimes = optionTimes[kIndex] ?? property.transit.options[kIndex]?.times;

  // ---- Temperature unit + forecast panel -----------------------------------
  const [unit, setUnit] = useLocalStorageState('sfcottage:temp-unit', 'F');
  const toggleUnit = useCallback(() => setUnit((u) => (u === 'F' ? 'C' : 'F')), [setUnit]);
  const formatTemp = useCallback(
    (tempF) => (tempF == null ? '—' : Math.round(unit === 'C' ? ((tempF - 32) * 5) / 9 : tempF) + '°'),
    [unit]
  );
  const [weatherOpen, setWeatherOpen] = useState(false);

  const value = useMemo(
    () => ({
      property,
      scrollRef,
      isGuest,
      isGeneric,
      guestName,
      accessCode,
      phase,
      previewAsGuest,
      exitGuestPreview,
      tabs: TABS,
      tab,
      sub,
      goTab,
      goSub,
      backToAround,
      arriveTarget,
      goArrive,
      clearArriveTarget,
      query,
      setQuery,
      results,
      wifiCopied,
      wifiJoining,
      copyWifiPassword,
      joinWifi,
      done,
      toggleChecklistItem,
      filter,
      setFilter,
      located,
      coords,
      locating,
      locateError,
      allowLocation,
      useCottageAsLocation,
      backOpen,
      setBackOpen,
      weather,
      arrivalWeather,
      forecastDays,
      stay,
      unit,
      toggleUnit,
      formatTemp,
      weatherOpen,
      setWeatherOpen,
      kTimes,
    }),
    [
      isGuest,
      isGeneric,
      guestName,
      accessCode,
      phase,
      tab,
      sub,
      goTab,
      goSub,
      backToAround,
      arriveTarget,
      goArrive,
      clearArriveTarget,
      query,
      results,
      wifiCopied,
      wifiJoining,
      copyWifiPassword,
      joinWifi,
      done,
      toggleChecklistItem,
      filter,
      located,
      coords,
      locating,
      locateError,
      allowLocation,
      useCottageAsLocation,
      backOpen,
      weather,
      arrivalWeather,
      forecastDays,
      stay,
      unit,
      toggleUnit,
      formatTemp,
      weatherOpen,
      kTimes,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
