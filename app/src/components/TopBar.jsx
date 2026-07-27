import { useApp } from '../context/AppContext.jsx';
import { colors, fonts } from '../theme.js';
import LineBadge from './LineBadge.jsx';
import { firstMinutes } from '../lib/transitDisplay.js';

export default function TopBar() {
  const { property, isGuest, isGeneric, goTab, goSub, accessCode } = useApp();
  const kOption = property.transit.options.find((o) => o.line === 'K');
  const kMin = firstMinutes(kOption?.times);

  return (
    <div
      style={{
        padding: '12px 16px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        borderBottom: `1px solid ${colors.border}`,
        background: colors.bg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div onClick={goTab('home')} style={{ cursor: 'pointer', fontFamily: fonts.serif, fontSize: 20 }}>
          {property.name}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: colors.muted }}>EN · translate works here</div>
      </div>

      {isGuest && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 1.1fr', gap: 6 }}>
          <div
            onClick={goTab('arrive')}
            style={{ cursor: 'pointer', background: colors.ink, color: colors.bg, borderRadius: 12, padding: '8px 10px' }}
          >
            <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', opacity: 0.6 }}>Code</div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '.14em' }}>{accessCode}</div>
          </div>
          <div
            onClick={goTab('wifi')}
            style={{ cursor: 'pointer', background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '8px 10px' }}
          >
            <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: colors.muted }}>WiFi</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.ink }}>Join ›</div>
          </div>
          <div
            onClick={goSub('nearby')}
            style={{ cursor: 'pointer', background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '8px 10px' }}
          >
            <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: colors.muted }}>Next train</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <LineBadge line="K" size={16} fontSize="10px" />
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.teal }}>{kMin != null ? kMin + ' min' : '—'}</div>
            </div>
          </div>
        </div>
      )}

      {isGeneric && (
        <div
          style={{
            background: colors.white,
            border: `1px dashed ${colors.borderDashed}`,
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 12,
            color: colors.mutedText,
            lineHeight: 1.5,
          }}
        >
          WiFi and the door code unlock with your stay link once you've booked.
        </div>
      )}
    </div>
  );
}
