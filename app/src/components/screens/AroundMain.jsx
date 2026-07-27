import { useApp } from '../../context/AppContext.jsx';
import { colors, fonts, screenPad, card, tip, sectionLabel } from '../../theme.js';
import MuniLogo from '../MuniLogo.jsx';
import LineBadge from '../LineBadge.jsx';

export default function AroundMain() {
  const { property, goSub } = useApp();
  return (
    <div style={screenPad}>
      <div style={{ fontFamily: fonts.serif, fontSize: 32 }}>Around Here</div>

      <div
        onClick={goSub('nearby')}
        style={{
          cursor: 'pointer',
          height: 170,
          borderRadius: 18,
          border: `1px solid ${colors.border}`,
          background: 'linear-gradient(#E3EBE8,#D7E3DF)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: colors.muted,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
        }}
      >
        Map · pins &amp; walk times · offline
      </div>

      <div onClick={goSub('ride')} style={{ cursor: 'pointer', ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 11 }}>
        <MuniLogo height={15} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>How to ride</div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>Muni, BART, Caltrain, regional buses — and how to pay</div>
        </div>
        <span style={{ color: colors.faint }}>→</span>
      </div>

      <div>
        <div style={sectionLabel}>Transit</div>
        {property.transit.options.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderBottom: `1px solid ${colors.border}` }}>
            <LineBadge line={t.line} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>{t.sub}</div>
            </div>
            <div style={{ fontFamily: fonts.serif, fontSize: 20, color: colors.teal, whiteSpace: 'nowrap' }}>{t.times}</div>
          </div>
        ))}
      </div>

      <div style={tip}>{property.transit.intro}</div>

      <div>
        <div style={sectionLabel}>Eat &amp; drink — all walkable</div>
        {property.food.map((f, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{f.name}</span>
              <span style={{ fontSize: 12, color: colors.muted, whiteSpace: 'nowrap' }}>
                {f.walkMin} min{f.hours ? ` · ${f.hours}` : ''}
              </span>
            </div>
            <div style={{ fontSize: 13, color: colors.italicText, marginTop: 3, lineHeight: 1.5 }}>{f.take}</div>
          </div>
        ))}
      </div>

      <div>
        <div style={sectionLabel}>Groceries &amp; essentials</div>
        {property.groceries.map((g, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${colors.border}` }}>
            <span style={{ fontSize: 14 }}>{g.name}</span>
            <span style={{ fontSize: 12, color: colors.muted, textAlign: 'right' }}>{g.meta}</span>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Delivery</div>
        <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.65, marginTop: 4 }}>{property.delivery.note}</div>
      </div>
    </div>
  );
}
