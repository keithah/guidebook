import { useApp } from '../../context/AppContext.jsx';
import { colors, fonts, screenPad, card, backLink } from '../../theme.js';
import MuniLogo from '../MuniLogo.jsx';
import LineBadge from '../LineBadge.jsx';
import NearbyMap from '../NearbyMap.jsx';

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
            <NearbyMap center={coords} cottage={cottage} stops={property.transit.nearbyStops} showMe={showMe} />
          </div>

          <div
            onClick={() => setBackOpen((b) => !b)}
            style={{ cursor: 'pointer', background: colors.ink, color: colors.bg, borderRadius: 18, padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: colors.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
              ⌂
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Take me back to the cottage</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{property.address.street} · every way to get there</div>
            </div>
            <div style={{ opacity: 0.6 }}>{backOpen ? '▴' : '▾'}</div>
          </div>
          {backOpen && (
            <div style={{ background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 18, padding: '4px 16px', marginTop: -8 }}>
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

          <div>
            <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: colors.muted }}>Where are you trying to go?</div>
            <input
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              placeholder="Type a place — or pick one below"
              style={{ width: '100%', boxSizing: 'border-box', background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 999, padding: '11px 16px', fontSize: 14, fontFamily: fonts.sans, color: colors.ink, marginTop: 7 }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {property.transit.destSuggestions.map((d) => (
                <div
                  key={d}
                  onClick={() => setDest(d)}
                  style={{ cursor: 'pointer', fontSize: 12, padding: '7px 13px', borderRadius: 999, background: colors.white, border: `1px solid ${colors.border}`, whiteSpace: 'nowrap' }}
                >
                  {d}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: colors.muted, marginBottom: 2 }}>Nearest stops right now</div>
            {property.transit.nearbyStops.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderBottom: `1px solid ${colors.border}` }}>
                <LineBadge line={s.line} size={s.line === 'BART' || s.line === 'BUS' ? 26 : 28} fontSize={s.line === 'BART' ? '10px' : s.line === 'BUS' ? '11px' : undefined} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>
                    {s.sub} · {s.walkMin} min walk
                  </div>
                </div>
                <div style={{ fontFamily: fonts.serif, fontSize: 20, color: colors.teal, whiteSpace: 'nowrap' }}>{s.times}</div>
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
