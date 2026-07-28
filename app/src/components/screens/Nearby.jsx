import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { colors, fonts, screenPad, card, backLink } from '../../theme.js';
import MuniLogo from '../MuniLogo.jsx';
import LineBadge from '../LineBadge.jsx';
import NearbyMap from '../NearbyMap.jsx';
import { geocodePlace, distanceMiles, stopHeadsToward } from '../../lib/geocode.js';
import { useLiveDepartures } from '../../hooks/useLiveDepartures.js';

const BACK_HOME_ICON = {
  walk: { glyph: '○', style: { background: colors.sage, color: colors.teal } },
  ride: { glyph: '→', style: { background: colors.sage, color: colors.teal } },
};

export default function Nearby() {
  const {
    property,
    backToAround,
    goSub,
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
  } = useApp();

  const cottage = { lat: property.address.lat, lng: property.address.lng };
  const showMe = !!(coords && (coords.lat !== cottage.lat || coords.lng !== cottage.lng));
  const liveTimes = useLiveDepartures(property.transit.nearbyStops);

  // ---- In-app destination search (Photon geocoder, no key) ----------------
  const [searching, setSearching] = useState(false);
  const [destPlace, setDestPlace] = useState(null);
  const [altResults, setAltResults] = useState([]);
  const [searchError, setSearchError] = useState(null);

  const runSearch = async (q) => {
    const query = (q ?? dest).trim();
    if (!query) return;
    setSearching(true);
    setSearchError(null);
    setBackOpen(false);
    const res = await geocodePlace(query, coords || cottage);
    setSearching(false);
    if (!res.ok) {
      setSearchError('Search is unavailable right now — try again in a moment.');
      return;
    }
    if (!res.results.length) {
      setDestPlace(null);
      setAltResults([]);
      setSearchError(`No Bay Area match for “${query}” — try adding a street or neighborhood.`);
      return;
    }
    setDestPlace(res.results[0]);
    setAltResults(res.results.slice(1, 4));
  };

  const clearSearch = () => {
    setDestPlace(null);
    setAltResults([]);
    setSearchError(null);
  };

  // A guest previewing from another city (or a flaky IP-based location) makes
  // "X mi from you" nonsense — beyond ~60 mi, measure from the cottage.
  const nearBase = showMe && distanceMiles(coords, cottage) < 60 ? { point: coords, label: 'you' } : { point: cottage, label: 'the cottage' };

  // With a destination set, rank the curated stops by whether their line
  // actually heads that way, and tag/dim rows accordingly.
  const stopRows = property.transit.nearbyStops.map((s, i) => ({ s, i, toward: destPlace ? stopHeadsToward(s, destPlace) : null }));
  const orderedStops = destPlace ? [...stopRows].sort((a, b) => (b.toward ? 1 : 0) - (a.toward ? 1 : 0)) : stopRows;

  const origin = showMe ? `${coords.lat},${coords.lng}` : `${property.address.street}, ${property.address.city}`;
  const directionsUrl = (place, mode) =>
    `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(
      `${place.lat},${place.lng}`
    )}&travelmode=${mode}`;

  return (
    <div style={screenPad}>
      <div onClick={backToAround} style={backLink}>
        ← Around Here
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <MuniLogo height={17} />
        <span style={{ fontSize: 15, color: colors.muted }}>metro</span>
        <span style={{ fontSize: 13, color: colors.faint }}>· and everything else nearby</span>
      </div>
      <div style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 1.1 }}>Getting somewhere</div>

      {!located && (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12, padding: 18 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: colors.sage,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.teal,
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              ◎
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Use your location?</div>
              <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.6, marginTop: 3 }}>
                So {property.host.name} can show the stops nearest you and the way back to the cottage. Nothing leaves your
                phone.
              </div>
            </div>
          </div>
          {locateError && <div style={{ fontSize: 12, color: '#b3261e' }}>{locateError} Showing the cottage instead.</div>}
          <div
            onClick={allowLocation}
            style={{ cursor: 'pointer', background: colors.teal, color: '#F2F7F5', borderRadius: 999, padding: 13, textAlign: 'center', fontSize: 15, fontWeight: 600 }}
          >
            {locating ? 'Locating…' : 'Allow location'}
          </div>
          <div onClick={useCottageAsLocation} style={{ cursor: 'pointer', textAlign: 'center', fontSize: 13, color: colors.muted }}>
            Not now — use the cottage as my location
          </div>
        </div>
      )}

      {located && coords && (
        <>
          <div style={{ height: 220, borderRadius: 18, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
            <NearbyMap center={coords} cottage={cottage} stops={property.transit.nearbyStops} showMe={showMe} dest={destPlace} />
          </div>

          <div>
            <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: colors.muted }}>Where are you trying to go?</div>
            <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
              <input
                value={dest}
                onChange={(e) => {
                  setDest(e.target.value);
                  if (!e.target.value.trim()) clearSearch();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch();
                }}
                placeholder="Type in address or place"
                style={{ flex: 1, boxSizing: 'border-box', background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 999, padding: '11px 16px', fontSize: 14, fontFamily: fonts.sans, color: colors.ink }}
              />
              <div
                onClick={() => runSearch()}
                style={{ cursor: 'pointer', background: colors.ink, color: colors.bg, borderRadius: 999, padding: '11px 17px', fontSize: 14, fontWeight: 600, flexShrink: 0 }}
              >
                {searching ? '…' : 'Go'}
              </div>
            </div>
            {searchError && <div style={{ fontSize: 12, color: '#b3261e', marginTop: 7, lineHeight: 1.5 }}>{searchError}</div>}
            {destPlace && (
              <div style={{ background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 18, padding: 14, marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{destPlace.name}</div>
                    <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                      {destPlace.label !== destPlace.name ? destPlace.label + ' · ' : ''}
                      {distanceMiles(nearBase.point, destPlace).toFixed(1)} mi from {nearBase.label}
                    </div>
                  </div>
                  <div onClick={clearSearch} style={{ cursor: 'pointer', color: colors.faint, fontSize: 16, lineHeight: 1 }}>
                    ✕
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 7, marginTop: 11 }}>
                  <a
                    href={directionsUrl(destPlace, 'transit')}
                    target="_blank"
                    rel="noreferrer"
                    style={{ flex: 1, background: colors.teal, color: '#F2F7F5', borderRadius: 999, padding: '10px 0', textAlign: 'center', fontSize: 13, fontWeight: 600 }}
                  >
                    Transit directions
                  </a>
                  <a
                    href={directionsUrl(destPlace, 'walking')}
                    target="_blank"
                    rel="noreferrer"
                    style={{ flex: 1, background: colors.white, border: `1px solid ${colors.border}`, color: colors.ink, borderRadius: 999, padding: '10px 0', textAlign: 'center', fontSize: 13, fontWeight: 600 }}
                  >
                    Walking
                  </a>
                </div>
                {altResults.length > 0 && (
                  <div style={{ marginTop: 10, borderTop: `1px solid ${colors.borderSoft}`, paddingTop: 8 }}>
                    <div style={{ fontSize: 11, color: colors.muted }}>Not it? Also found:</div>
                    {altResults.map((r, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          setDestPlace(r);
                          setAltResults(altResults.filter((_, j) => j !== i).concat(destPlace));
                        }}
                        style={{ cursor: 'pointer', fontSize: 13, color: colors.teal, padding: '5px 0' }}
                      >
                        {r.label} →
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <div
                onClick={() => {
                  setDest(property.address.street);
                  clearSearch();
                  setBackOpen(true);
                  if (!showMe) allowLocation();
                }}
                style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 999, background: colors.teal, color: '#F2F7F5', whiteSpace: 'nowrap' }}
              >
                ⌂ Take me back to the cottage
              </div>
              {property.transit.destSuggestions.map((d) => (
                <div
                  key={d}
                  onClick={() => {
                    setDest(d);
                    runSearch(d);
                  }}
                  style={{ cursor: 'pointer', fontSize: 12, padding: '7px 13px', borderRadius: 999, background: colors.white, border: `1px solid ${colors.border}`, whiteSpace: 'nowrap' }}
                >
                  {d}
                </div>
              ))}
            </div>
            {backOpen && (
              <div style={{ background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 18, padding: '4px 16px', marginTop: 10 }}>
                <div
                  onClick={() => setBackOpen(false)}
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${colors.borderSoft}` }}
                >
                  <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: colors.teal }}>
                    Suggestions · back to {property.address.street}
                  </div>
                  <div style={{ color: colors.faint, fontSize: 13 }}>▴</div>
                </div>
                {property.transit.backHome.map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 0', borderBottom: `1px solid ${colors.borderSoft}` }}>
                    {b.line ? (
                      <LineBadge line={b.line} size={22} fontSize={b.line === 'BART' ? '9px' : '12px'} />
                    ) : (
                      <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', ...BACK_HOME_ICON[b.icon]?.style }}>
                        {BACK_HOME_ICON[b.icon]?.glyph}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{b.label}</div>
                      <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.55, marginTop: 2 }}>{b.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: colors.muted, marginBottom: 2 }}>
              {destPlace ? `Stops toward ${destPlace.name}` : 'Nearest stops right now'}
            </div>
            {orderedStops.map(({ s, i, toward }) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderBottom: `1px solid ${colors.border}`, opacity: destPlace && !toward ? 0.45 : 1 }}
              >
                <LineBadge line={s.line} size={s.line === 'BART' || s.line === 'BUS' ? 26 : 28} fontSize={s.line === 'BART' ? '10px' : s.line === 'BUS' ? '11px' : undefined} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>
                    {s.sub} · {s.walkMin} min walk
                  </div>
                  {toward && (
                    <div style={{ fontSize: 12, color: colors.teal, fontWeight: 600, marginTop: 2 }}>
                      {toward.label === 'right there' ? '→ closest stop to it' : `→ heads toward ${toward.label}`}
                    </div>
                  )}
                  {destPlace && !toward && <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>heads the other way</div>}
                </div>
                {liveTimes[i] && (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3BA55D', flexShrink: 0 }} title="Live" />
                )}
                <div style={{ fontFamily: fonts.serif, fontSize: 20, color: colors.teal, whiteSpace: 'nowrap' }}>
                  {liveTimes[i] ?? s.times}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: colors.muted, marginBottom: 7 }}>Or get a ride</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {property.transit.rides.map((r, i) => (
                <div key={i} style={{ flex: 1, background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '13px 12px' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: r.color }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: colors.muted, lineHeight: 1.4, marginTop: 3 }}>{r.note}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: colors.muted, lineHeight: 1.6, marginTop: 8 }}>
              No account yet? <a href={property.transit.rides[0].referralUrl}>Grab a sign-up link</a> — first ride is usually
              discounted.
            </div>
          </div>

          <div
            onClick={goSub('ride')}
            style={{ cursor: 'pointer', background: colors.sage, borderRadius: 16, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>First time on Muni or BART?</div>
              <div style={{ fontSize: 13, color: colors.tealText, marginTop: 2 }}>How to ride, and how to pay</div>
            </div>
            <span style={{ color: colors.teal }}>→</span>
          </div>
        </>
      )}
    </div>
  );
}
