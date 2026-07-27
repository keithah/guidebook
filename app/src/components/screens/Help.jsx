import { useApp } from '../../context/AppContext.jsx';
import { colors, fonts, screenPad, card, cardTight, darkCard } from '../../theme.js';
import Checklist from '../Checklist.jsx';

export default function Help() {
  const { property } = useApp();
  const { host, emergency, checkout, bookDirect } = property;

  return (
    <div style={screenPad}>
      <div style={{ fontFamily: fonts.serif, fontSize: 32 }}>Help</div>

      <div style={{ ...card, display: 'flex', gap: 14, alignItems: 'center' }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            flexShrink: 0,
            background: colors.sage,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: fonts.serif,
            fontSize: 22,
            color: colors.teal,
          }}
        >
          {host.name[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Message {host.name}</div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{host.responseTime} · Airbnb or SMS</div>
        </div>
        <a href={host.smsHref} style={{ background: colors.teal, color: '#F2F7F5', borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600 }}>
          Text
        </a>
      </div>

      <div style={cardTight}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${colors.borderSoft}` }}>
          <span style={{ fontSize: 14 }}>Emergency</span>
          <a href={`tel:${emergency.numbers.emergency}`} style={{ fontSize: 14, fontWeight: 600 }}>
            {emergency.numbers.emergency}
          </a>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${colors.borderSoft}` }}>
          <span style={{ fontSize: 14 }}>SF non-emergency</span>
          <a href={`tel:${emergency.numbers.nonEmergency.replace(/-/g, '')}`} style={{ fontSize: 14, fontWeight: 600 }}>
            {emergency.numbers.nonEmergency}
          </a>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
          <span style={{ fontSize: 14 }}>City services</span>
          <a href={`tel:${emergency.numbers.cityServices}`} style={{ fontSize: 14, fontWeight: 600 }}>
            {emergency.numbers.cityServices}
          </a>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>In the cottage</div>
        <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.8, marginTop: 4 }}>
          Fire extinguisher — {emergency.fireExtinguisher}
          <br />
          First-aid kit — {emergency.firstAidKit}
          <br />
          Breaker panel &amp; water shutoff — see Troubleshooting in The Cottage
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Nearest urgent care &amp; ER</div>
        <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.65, marginTop: 4 }}>{emergency.hospital}</div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Checkout · {checkout.time}</div>
        <Checklist dense />
      </div>

      <div style={darkCard}>
        <div style={{ fontFamily: fonts.serif, fontSize: 20 }}>Next time, book direct.</div>
        <div style={{ fontSize: 13, opacity: 0.72, marginTop: 5 }}>{bookDirect.pitchDuring}</div>
      </div>

      <div style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>
        {checkout.feedbackPrompt} <a href="#">Tell {host.name} →</a>
      </div>
    </div>
  );
}
