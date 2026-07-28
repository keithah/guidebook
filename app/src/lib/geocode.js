// Free, key-less geocoding via Photon (photon.komoot.io) — CORS-friendly and
// fine for guest-scale traffic. Results are biased toward the cottage so
// "golden gate park" beats identically-named places elsewhere, then filtered
// to the Bay Area so a typo can't teleport the map to another state.
const PHOTON = 'https://photon.komoot.io/api/';

const BAY = { latMin: 37.2, latMax: 38.35, lngMin: -123.1, lngMax: -121.6 };

export async function geocodePlace(query, bias) {
  try {
    const params = new URLSearchParams({ q: query, limit: '5', lang: 'en' });
    if (bias) {
      params.set('lat', String(bias.lat));
      params.set('lon', String(bias.lng));
    }
    const res = await fetch(`${PHOTON}?${params}`);
    if (!res.ok) throw new Error('geocoder ' + res.status);
    const data = await res.json();
    const results = (data?.features || [])
      .map((f) => {
        const [lng, lat] = f.geometry?.coordinates || [];
        const p = f.properties || {};
        const label = [p.name, p.street && p.name !== p.street ? p.street : null, p.city || p.county]
          .filter(Boolean)
          .join(', ');
        return { name: p.name || label, label, lat, lng, kind: p.osm_value };
      })
      .filter(
        (r) =>
          r.lat != null &&
          r.lat >= BAY.latMin &&
          r.lat <= BAY.latMax &&
          r.lng >= BAY.lngMin &&
          r.lng <= BAY.lngMax
      );
    return { ok: true, results };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

export function bearingDeg(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Does riding from `stop` toward one of its line's `headsTo` targets move you
// toward `dest`? True when the destination sits within ±65° of a direction
// the line actually travels (or is basically at the stop already).
export function stopHeadsToward(stop, dest) {
  if (!stop.headsTo || !dest) return null;
  if (distanceMiles(stop, dest) < 0.4) return { label: 'right there' };
  const destBearing = bearingDeg(stop, dest);
  for (const t of stop.headsTo) {
    let diff = Math.abs(bearingDeg(stop, t) - destBearing);
    if (diff > 180) diff = 360 - diff;
    if (diff <= 65) return t;
  }
  return false;
}

export function distanceMiles(a, b) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
