import { useApp } from '../context/AppContext.jsx';
import { colors, fonts } from '../theme.js';
import WeatherIcon from './WeatherIcon.jsx';

function localISODate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function Row({ label, short, temp, strong }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '11px 0', borderBottom: `1px solid ${colors.borderSoft}` }}>
      <div style={{ fontSize: 14, fontWeight: strong ? 600 : 500, width: 96, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 13, color: colors.mutedText, flex: 1, lineHeight: 1.4 }}>{short}</div>
      <div style={{ fontFamily: fonts.serif, fontSize: 22 }}>{temp}</div>
    </div>
  );
}

// Bottom-sheet forecast: today, then either the guest's stay window (before
// check-in) or the next 5 days (during a stay / no stay).
export default function WeatherPanel() {
  const { weatherOpen, setWeatherOpen, weather, forecastDays, phase, stay, unit, toggleUnit, formatTemp } = useApp();
  if (!weatherOpen) return null;

  const todayISO = localISODate();
  const future = (forecastDays || []).filter((d) => d.date > todayISO);
  const isBefore = phase === 'before' && stay;
  const list = isBefore ? future.filter((d) => d.date >= stay.checkin && d.date <= stay.checkout) : future.slice(0, 5);
  const beyondForecast = isBefore && (!list.length || stay.checkout > list[list.length - 1].date);

  return (
    <div
      onClick={() => setWeatherOpen(false)}
      style={{ position: 'absolute', inset: 0, background: 'rgba(20,32,29,.42)', display: 'flex', alignItems: 'flex-end', zIndex: 40 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', background: colors.bg, borderRadius: '22px 22px 0 0', padding: '16px 18px 26px', maxHeight: '72%', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <WeatherIcon size={30} />
          <div style={{ fontFamily: fonts.serif, fontSize: 22 }}>{isBefore ? 'Weather for your stay' : 'Weather'}</div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              onClick={toggleUnit}
              style={{ cursor: 'pointer', display: 'flex', border: `1px solid ${colors.border}`, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: 600 }}
            >
              {['F', 'C'].map((u) => (
                <div
                  key={u}
                  style={{ padding: '4px 10px', background: unit === u ? colors.ink : colors.white, color: unit === u ? colors.bg : colors.muted }}
                >
                  °{u}
                </div>
              ))}
            </div>
            <div onClick={() => setWeatherOpen(false)} style={{ cursor: 'pointer', fontSize: 20, color: colors.muted, lineHeight: 1 }}>
              ✕
            </div>
          </div>
        </div>

        <Row label="Today" short={weather.ok ? weather.short : 'Forecast unavailable'} temp={weather.ok ? formatTemp(weather.tempF) : '—'} strong />
        {forecastDays == null && <div style={{ fontSize: 13, color: colors.muted, padding: '12px 0' }}>Loading forecast…</div>}
        {list.map((d) => (
          <Row
            key={d.date}
            label={isBefore && d.date === stay.checkin ? 'Arrival · ' + dayLabel(d.date).split(',')[0] : dayLabel(d.date)}
            short={d.short}
            temp={formatTemp(d.tempF)}
          />
        ))}
        {beyondForecast && (
          <div style={{ fontSize: 12, color: colors.muted, paddingTop: 12, lineHeight: 1.5 }}>
            {list.length ? 'The rest of your stay is' : 'Your stay is'} beyond the 7-day forecast — check back closer to the date.
          </div>
        )}
      </div>
    </div>
  );
}
