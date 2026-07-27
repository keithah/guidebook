// Live departures via the 511.org Transit API (StopMonitoring). Requires a
// free API key (511.org/open-data/token) passed as VITE_API_511_KEY — and a
// real 511 stop code per stop, which sfcottage.json doesn't have yet (see the
// `_todo` on each transit option). Per spec ("Live data degrades gracefully")
// every call resolves to a settled result; callers fall back to the static
// `times` string already in the property data when `ok` is false.

const API_KEY = import.meta.env.VITE_API_511_KEY;
const BASE = 'https://api.511.org/transit/StopMonitoring';

export async function fetchStopDepartures(stopCode, agency = 'SF') {
  if (!API_KEY || !stopCode) {
    return { ok: false, reason: !API_KEY ? 'missing-api-key' : 'missing-stop-code' };
  }
  try {
    const url = `${BASE}?api_key=${encodeURIComponent(API_KEY)}&agency=${encodeURIComponent(agency)}&stopcode=${encodeURIComponent(stopCode)}&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('511 ' + res.status);
    // 511 responses are UTF-16 with a BOM; text() + manual parse avoids
    // fetch's json() choking on the BOM.
    const text = (await res.text()).replace(/^﻿/, '');
    const data = JSON.parse(text);
    const visits =
      data?.ServiceDelivery?.StopMonitoringDelivery?.MonitoredStopVisit || [];
    const minutesList = visits
      .map((v) => v?.MonitoredVehicleJourney?.MonitoredCall?.ExpectedArrivalTime)
      .filter(Boolean)
      .map((iso) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000)));
    return { ok: true, minutesList };
  } catch (err) {
    return { ok: false, reason: String(err && err.message ? err.message : err) };
  }
}
