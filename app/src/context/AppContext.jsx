import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import property from '../data/properties/sfcottage.json';
import { readStayFromLocation, computeStayPhase, encodeStay } from '../lib/stayHash.js';
import { fetchCurrentWeather, fetchWeatherForDate } from '../lib/weather.js';
import { getCurrentPosition } from '../lib/geo.js';
import { useLocalStorageState } from '../hooks/useLocalStorageState.js';

const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

const TABS = ['home', 'arrive', 'cottage', 'around', 'explore', 'help'];

export function AppProvider({ children }) {
  const scrollRef = useRef(null);

  // ---- Guest identity: /sfcottage#<hash> ----------------------------------
  const [stay, setStay] = useState(() => readStayFromLocation());
  useEffect(() => {
    const onHashChange = () => setStay(readStayFromLocation());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

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
  const [dest, setDest] = useState('');

  const allowLocation = useCallback(async () => {
    setLocating(true);
    setLocateError(null);
    try {
      const pos = await getCurrentPosition();
      setCoords(pos);
      setLocated(true);
    } catch (err) {
      setLocateError(err.message || 'Could not get your location.');
      setCoords({ lat: property.address.lat, lng: property.address.lng });
      setLocated(true);
    } finally {
      setLocating(false);
    }
  }, []);
  const useCottageAsLocation = useCallback(() => {
    setCoords({ lat: property.address.lat, lng: property.address.lng });
    setLocated(true);
  }, []);

  // ---- Weather (NWS, no API key) -------------------------------------------
  const [weather, setWeather] = useState({ ok: false, loading: true });
  useEffect(() => {
    let cancelled = false;
    const request =
      phase === 'before' && stay?.checkin
        ? fetchWeatherForDate(property.address.lat, property.address.lng, stay.checkin)
        : fetchCurrentWeather(property.address.lat, property.address.lng);
    request.then((res) => {
      if (!cancelled) setWeather({ ...res, loading: false });
    });
    return () => {
      cancelled = true;
    };
    // Re-fetch only when the phase we need weather framed for changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'before']);

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
      dest,
      setDest,
      weather,
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
      dest,
      weather,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
