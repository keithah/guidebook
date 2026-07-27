// Live weather via the National Weather Service API (api.weather.gov) — no
// API key required, unlike 511.org or a commercial weather provider. Spec
// calls for "Weather: NWS API — home screen + stay window" with graceful
// degradation, so every caller gets a settled { ok, ...} shape instead of a
// throw.

const UA = 'sfcottage-guidebook (keith@kodi.tv)';

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/geo+json', 'User-Agent': UA } });
  if (!res.ok) throw new Error('NWS ' + res.status);
  return res.json();
}

let cachedPointForecastUrl = null;

async function fetchPeriods(lat, lng) {
  if (!cachedPointForecastUrl) {
    const point = await getJson(`https://api.weather.gov/points/${lat},${lng}`);
    cachedPointForecastUrl = point?.properties?.forecast;
  }
  if (!cachedPointForecastUrl) throw new Error('no forecast url');
  const forecast = await getJson(cachedPointForecastUrl);
  const periods = forecast?.properties?.periods;
  if (!periods || !periods.length) throw new Error('no forecast periods');
  return periods;
}

export async function fetchCurrentWeather(lat, lng) {
  try {
    const period = (await fetchPeriods(lat, lng))[0];
    return {
      ok: true,
      tempF: period.temperature,
      short: period.shortForecast,
      isDaytime: period.isDaytime,
      windSpeed: period.windSpeed,
    };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

// Best-effort forecast for a specific future date (e.g. arrival day) — picks
// the daytime period whose NWS startTime falls on that calendar date, or
// falls back to the nearest period if the date is out of the 7-day window.
export async function fetchWeatherForDate(lat, lng, isoDate) {
  try {
    const periods = await fetchPeriods(lat, lng);
    const match =
      periods.find((p) => p.isDaytime && p.startTime.slice(0, 10) === isoDate) ||
      periods.find((p) => p.startTime.slice(0, 10) === isoDate) ||
      periods[0];
    return {
      ok: true,
      tempF: match.temperature,
      short: match.shortForecast,
      isDaytime: match.isDaytime,
      windSpeed: match.windSpeed,
    };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}
