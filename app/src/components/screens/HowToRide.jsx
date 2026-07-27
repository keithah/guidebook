import { useApp } from '../../context/AppContext.jsx';
import { colors, fonts, screenPad, card, tip, backLink, lineBadgeStyle } from '../../theme.js';
import MuniLogo from '../MuniLogo.jsx';

export default function HowToRide() {
  const { property, backToAround } = useApp();
  const { howToRide } = property;

  return (
    <div style={screenPad}>
      <div onClick={backToAround} style={backLink}>
        ← Around Here
      </div>
      <div style={{ fontFamily: fonts.serif, fontSize: 32, lineHeight: 1.1 }}>How to ride</div>
      <div style={{ fontSize: 14, color: colors.mutedText, lineHeight: 1.65 }}>{howToRide.intro}</div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Paying — pick one and forget it</div>
        {howToRide.payment.map((p, i) => (
          <div key={i} style={{ padding: '10px 0', borderTop: `1px solid ${colors.borderSoft}` }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
            <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.55, marginTop: 2 }}>{p.detail}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <MuniLogo height={16} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Muni — the city itself</div>
        </div>
        <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.6 }}>{howToRide.muni.detail}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {howToRide.muni.lines.map((line) => (
            <div key={line} style={lineBadgeStyle(line, { size: 26, fontSize: '13px' })}>
              {line}
            </div>
          ))}
          <div style={{ fontSize: 12, color: colors.muted, marginLeft: 4 }}>{howToRide.muni.note}</div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <div style={lineBadgeStyle('BART', { size: 26 })}>ba</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>BART — the region</div>
        </div>
        <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.6 }}>{howToRide.bart.detail}</div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <div style={lineBadgeStyle('CT', { size: 26, fontSize: '11px' })}>CT</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Caltrain — down the Peninsula</div>
        </div>
        <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.6 }}>{howToRide.caltrain.detail}</div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Leaving the city by bus</div>
        <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.9, whiteSpace: 'pre-line' }}>{howToRide.regionalBus.detail}</div>
      </div>

      <div style={tip}>{howToRide.tip}</div>
    </div>
  );
}
