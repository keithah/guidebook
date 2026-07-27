import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { colors } from '../theme.js';

// There's no real per-stay scraping/injection pipeline yet (spec: "defined
// later") — this panel is the stand-in so /sfcottage#<hash> guest links are
// actually testable end-to-end. It's deliberately styled as dev chrome, not
// part of the Fog design itself, and sits below the real screen content.
export default function GuestPreviewBar() {
  const { isGuest, isGeneric, exitGuestPreview, previewAsGuest, property } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Sarah');
  const [checkin, setCheckin] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkout, setCheckout] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });

  if (isGuest) {
    return (
      <div style={{ padding: '10px 16px 24px', textAlign: 'center' }}>
        <button
          type="button"
          onClick={exitGuestPreview}
          style={{
            border: `1px dashed ${colors.borderDashed}`,
            background: 'transparent',
            color: colors.muted,
            fontSize: 11,
            borderRadius: 999,
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          Dev: exit guest-link preview (back to generic)
        </button>
      </div>
    );
  }

  if (!isGeneric) return null;

  return (
    <div style={{ padding: '10px 16px 24px' }}>
      {!open ? (
        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              border: `1px dashed ${colors.borderDashed}`,
              background: 'transparent',
              color: colors.muted,
              fontSize: 11,
              borderRadius: 999,
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            Dev: preview a guest stay link
          </button>
        </div>
      ) : (
        <div
          style={{
            border: `1px dashed ${colors.borderDashed}`,
            borderRadius: 14,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 12,
            color: colors.mutedText,
          }}
        >
          <div style={{ fontWeight: 600, color: colors.ink }}>
            Build a /sfcottage#&lt;hash&gt; guest link (stands in for the real per-stay injection pipeline)
          </div>
          <label>
            Guest name
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </label>
          <label>
            Check-in
            <input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} style={inputStyle} />
          </label>
          <label>
            Check-out
            <input type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} style={inputStyle} />
          </label>
          <button
            type="button"
            onClick={() => previewAsGuest({ guestName: name, checkin, checkout, code: property.checkin.code })}
            style={{
              marginTop: 4,
              background: colors.teal,
              color: '#F2F7F5',
              border: 0,
              borderRadius: 999,
              padding: '10px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go
          </button>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 3,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: '7px 9px',
  fontSize: 13,
  fontFamily: 'inherit',
};
