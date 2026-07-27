import { useApp } from '../../context/AppContext.jsx';
import { colors, fonts, screenPad, card, tip, sectionLabel } from '../../theme.js';

export default function Cottage() {
  const { property } = useApp();
  return (
    <div style={screenPad}>
      <div style={{ fontFamily: fonts.serif, fontSize: 32 }}>The Cottage</div>
      <div style={{ fontSize: 14, color: colors.mutedText, lineHeight: 1.65 }}>
        {property.capacity.sqft} square feet behind the main house, in {property.address.neighborhood} near City College.{' '}
        {property.host.coHost} and {property.host.name} have hosted here for 15 years — here's how everything works.
      </div>

      <div>
        <div style={sectionLabel}>Room by room</div>
        {property.spaces.map((r, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</div>
            <div style={{ fontSize: 13, color: colors.mutedText, marginTop: 3, lineHeight: 1.55 }}>{r.details}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>WiFi &amp; appliances</div>
        <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.9 }}>{property.applianceNote}</div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>House rules</div>
        <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.9 }}>{property.houseRulesNote}</div>
      </div>

      <div style={tip}>
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.ink }}>Trash goes out {property.trash.day}</div>
        <div style={{ fontSize: 13, color: colors.tealText, lineHeight: 1.6, marginTop: 3 }}>{property.trash.note}</div>
      </div>

      <div>
        <div style={sectionLabel}>Troubleshooting</div>
        {property.faqs.map((q, i) => (
          <div key={i} style={{ padding: '12px 0', borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{q.q}</div>
            <div style={{ fontSize: 13, color: colors.mutedText, marginTop: 3, lineHeight: 1.55 }}>{q.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
