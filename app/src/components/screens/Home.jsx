import { useApp } from '../../context/AppContext.jsx';
import { colors, fonts, screenPad, card, darkCard } from '../../theme.js';
import ImageSlot from '../ImageSlot.jsx';
import WeatherIcon from '../WeatherIcon.jsx';
import LineBadge from '../LineBadge.jsx';
import Checklist from '../Checklist.jsx';
import { firstMinutes } from '../../lib/transitDisplay.js';
import MuniLogo from '../MuniLogo.jsx';
import { ARRIVE_SECTIONS } from './Arrive.jsx';

function WeatherLine({ weather, fallbackTemp, fallbackShort }) {
  const tempF = weather.ok ? Math.round(weather.tempF) : fallbackTemp;
  const short = weather.ok ? weather.short : fallbackShort;
  return { tempF, short };
}

export default function Home() {
  const { isGeneric, phase } = useApp();
  if (isGeneric) return <GenericHome />;
  if (phase === 'before') return <BeforeHome />;
  if (phase === 'checkout') return <CheckoutHome />;
  return <DuringHome />;
}

function BeforeHome() {
  const { guestName, goArrive, weather, arrivalWeather, property, formatTemp, setWeatherOpen } = useApp();
  const w = WeatherLine({ weather, fallbackTemp: 57, fallbackShort: 'Fog, clearing late' });
  return (
    <div style={screenPad}>
      <div style={{ height: 190, borderRadius: 18, overflow: 'hidden' }}>
        <ImageSlot id="fog-hero" placeholder="Cottage exterior photo" />
      </div>
      <div>
        <div style={{ fontFamily: fonts.serif, fontSize: 32, lineHeight: 1.1 }}>See you soon, {guestName}.</div>
        <div style={{ fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 1.6 }}>
          Check-in is any time from {property.checkin.time}. Your access code — one code for the gate and the door — appears above on
          the morning you arrive.
        </div>
      </div>
      <div style={{ ...card, paddingTop: 6, paddingBottom: 6 }}>
        <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: colors.teal, padding: '8px 0 2px' }}>
          Getting here
        </div>
        {ARRIVE_SECTIONS.map((s) => (
          <div
            key={s.id}
            onClick={goArrive(s.id)}
            style={{ cursor: 'pointer', padding: '11px 0', borderBottom: `1px solid ${colors.borderSoft}` }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>{s.name}</span>
              <span style={{ color: colors.faint }}>→</span>
            </div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Pack layers</div>
        <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.6, marginTop: 4 }}>
          55–62° and foggy mornings this week. There's no A/C and you won't miss it.
        </div>
      </div>
      <div
        onClick={() => setWeatherOpen(true)}
        style={{
          cursor: 'pointer',
          background: 'linear-gradient(160deg,#FDF6E7,#DFE9E5)',
          borderRadius: 18,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Right now</div>
            <div style={{ fontSize: 13, color: colors.tealText, marginTop: 2 }}>{w.short}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <WeatherIcon />
            <div style={{ fontFamily: fonts.serif, fontSize: 34 }}>{formatTemp(w.tempF)}</div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid rgba(20,32,29,.1)',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Arrival day</div>
            <div style={{ fontSize: 13, color: colors.tealText, marginTop: 2 }}>
              {arrivalWeather ? arrivalWeather.short : 'Tap for the outlook'}
            </div>
          </div>
          <div style={{ fontFamily: fonts.serif, fontSize: 26 }}>{arrivalWeather ? formatTemp(arrivalWeather.tempF) : '→'}</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: colors.muted }}>
        Add this guide to your home screen — it works offline.
      </div>
    </div>
  );
}

function DuringHome() {
  const { guestName, goSub, weather, query, setQuery, results, property, formatTemp, setWeatherOpen } = useApp();
  const w = WeatherLine({ weather, fallbackTemp: 58, fallbackShort: 'Fog till noon' });
  const kOption = property.transit.options.find((o) => o.line === 'K');
  const kMin = firstMinutes(kOption?.times);
  return (
    <div style={screenPad}>
      <div style={{ fontFamily: fonts.serif, fontSize: 32, lineHeight: 1.1 }}>
        Good morning, {guestName}.
        <br />
        <span style={{ color: colors.muted }}>Here's your day in {property.address.neighborhood}.</span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div
          onClick={() => setWeatherOpen(true)}
          style={{
            cursor: 'pointer',
            flex: 1,
            background: 'linear-gradient(160deg,#FDF6E7,#EAF1EC)',
            border: '1px solid #E4DFC9',
            borderRadius: 16,
            padding: 14,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 10, right: 10 }}>
            <WeatherIcon size={46} />
          </div>
          <div style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 1 }}>{formatTemp(w.tempF)}</div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 1.4 }}>
            {w.short}
            <br />
            Take a layer
          </div>
        </div>
        <div onClick={goSub('nearby')} style={{ cursor: 'pointer', flex: 1, ...card, padding: 14, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MuniLogo />
            <span style={{ fontSize: 12, color: colors.muted }}>metro</span>
          </div>
          <div style={{ fontFamily: fonts.serif, fontSize: 29, lineHeight: 1, marginTop: 9, color: colors.teal }}>
            {kMin != null ? kMin + ' min' : '—'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', fontSize: 12, color: colors.muted, marginTop: 5, lineHeight: 1.5 }}>
            <span>until the next</span>
            <LineBadge line="K" size={18} fontSize="11px" />
            <span>· {kOption?.walkMin} min walk</span>
          </div>
        </div>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the guide — trash day, Keurig, loft…"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: colors.white,
          border: `1px solid ${colors.border}`,
          borderRadius: 999,
          padding: '11px 16px',
          fontSize: 14,
          fontFamily: fonts.sans,
          color: colors.ink,
        }}
      />
      {results.length > 0 && <SearchResults results={results} />}
      <SectionsList />
      <div style={{ fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 15, color: colors.italicText, lineHeight: 1.6 }}>
        "My favorite burger in the city is 2 minutes away — it's in Around Here."
      </div>
    </div>
  );
}

function CheckoutHome() {
  const { guestName, property } = useApp();
  return (
    <div style={screenPad}>
      <div style={{ fontFamily: fonts.serif, fontSize: 32, lineHeight: 1.12 }}>
        Out by {property.checkout.time}.
        <br />
        <span style={{ color: colors.muted }}>Thanks for staying, {guestName}.</span>
      </div>
      <div style={{ background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 18, padding: '4px 16px' }}>
        <Checklist />
      </div>
      <div style={darkCard}>
        <div style={{ fontFamily: fonts.serif, fontSize: 22 }}>Next time, book direct.</div>
        <div style={{ fontSize: 13, opacity: 0.72, marginTop: 6, lineHeight: 1.55 }}>{property.bookDirect.pitchDuring}</div>
        <div style={{ marginTop: 12, background: colors.teal, borderRadius: 999, padding: 11, textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {property.bookDirect.cta}
        </div>
      </div>
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>One question before you go</div>
        <div style={{ fontSize: 13, color: colors.mutedText, marginTop: 3 }}>
          {property.checkout.feedbackPrompt} <a href="#">Tell {property.host.name} →</a>
        </div>
      </div>
      <div style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>{property.checkout.reviewNudge} ✳</div>
    </div>
  );
}

function GenericHome() {
  const { property, weather, formatTemp, setWeatherOpen } = useApp();
  const w = WeatherLine({ weather, fallbackTemp: 57, fallbackShort: 'Fog, clearing late' });
  return (
    <div style={screenPad}>
      <div style={{ height: 190, borderRadius: 18, overflow: 'hidden' }}>
        <ImageSlot id="fog-hero-gen" placeholder="Cottage exterior photo" />
      </div>
      <div>
        <div style={{ fontFamily: fonts.serif, fontSize: 34, lineHeight: 1.1 }}>{property.name}</div>
        <div style={{ fontSize: 14, color: colors.mutedText, marginTop: 6, lineHeight: 1.65 }}>
          A quiet 2-bedroom cottage in {property.address.neighborhood}, two minutes from the K line. This is the same guide my
          guests use — minus the codes.
        </div>
      </div>
      <div
        onClick={() => setWeatherOpen(true)}
        style={{
          cursor: 'pointer',
          background: 'linear-gradient(160deg,#FDF6E7,#DFE9E5)',
          borderRadius: 18,
          padding: '13px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Today in {property.address.neighborhood}</div>
          <div style={{ fontSize: 13, color: colors.tealText, marginTop: 2 }}>{w.short}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <WeatherIcon size={32} />
          <div style={{ fontFamily: fonts.serif, fontSize: 30 }}>{formatTemp(w.tempF)}</div>
        </div>
      </div>
      <SectionsList />
      <div style={darkCard}>
        <div style={{ fontFamily: fonts.serif, fontSize: 22 }}>Book direct, skip the fees.</div>
        <div style={{ fontSize: 13, opacity: 0.72, marginTop: 6, lineHeight: 1.55 }}>{property.bookDirect.pitchGeneric}</div>
        <div style={{ marginTop: 12, background: colors.teal, borderRadius: 999, padding: 11, textAlign: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {property.bookDirect.cta}
        </div>
      </div>
    </div>
  );
}

function SectionsList() {
  const { property, goTab } = useApp();
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {property.sections.map((s) => (
        <div key={s.tab} onClick={goTab(s.tab)} style={{ cursor: 'pointer', padding: '13px 0', borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 16, fontWeight: 500 }}>{s.name}</span>
            <span style={{ color: colors.faint }}>→</span>
          </div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

function SearchResults({ results }) {
  const { goTab } = useApp();
  return (
    <div style={{ background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '4px 16px' }}>
      {results.map((r, i) => (
        <div
          key={i}
          onClick={goTab(r.tab)}
          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${colors.borderSoft}` }}
        >
          <span style={{ fontSize: 14 }}>{r.label}</span>
          <span style={{ fontSize: 12, color: colors.muted }}>{r.where} →</span>
        </div>
      ))}
    </div>
  );
}
