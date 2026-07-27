import { useApp } from '../../context/AppContext.jsx';
import { colors, fonts, screenPad, card, tip } from '../../theme.js';
import ImageSlot from '../ImageSlot.jsx';

export default function Arrive() {
  const { property } = useApp();
  const { steps, earlyArrival } = property.checkin;
  const { sfoDirections, oakDirections, drivingDirections } = property.transit;

  return (
    <div style={screenPad}>
      <div style={{ fontFamily: fonts.serif, fontSize: 32 }}>Arrive</div>

      <div style={card}>
        <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: colors.teal, marginBottom: 4 }}>Getting in</div>
        {steps.map((text, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: `1px solid ${colors.borderSoft}` }}>
            <div style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.teal, minWidth: 14 }}>{i + 1}</div>
            <div style={{ fontSize: 13, color: '#3B4E49', lineHeight: 1.55 }}>{text}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <div style={{ flex: 1, height: 92, borderRadius: 12, overflow: 'hidden' }}>
            <ImageSlot id="fog-gate" placeholder="Gate keypad" radius={12} />
          </div>
          <div style={{ flex: 1, height: 92, borderRadius: 12, overflow: 'hidden' }}>
            <ImageSlot id="fog-door" placeholder="Door keypad" radius={12} />
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>From SFO</div>
        <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.65, marginTop: 4 }}>{sfoDirections}</div>
      </div>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>From OAK</div>
        <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.65, marginTop: 4 }}>{oakDirections}</div>
      </div>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Driving &amp; parking</div>
        <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.65, marginTop: 4 }}>{drivingDirections}</div>
      </div>

      <div style={tip}>
        The cottage is down a narrow alley — take big suitcases slowly. {earlyArrival}
      </div>
    </div>
  );
}
