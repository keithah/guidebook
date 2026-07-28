import { useState } from 'react';
import { colors } from '../theme.js';

// Tap-to-expand row. The body always renders (hidden via .drill-body CSS) so
// the print stylesheet can force every section open.
export default function Drill({ title, sub, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: `1px solid ${colors.borderSoft}` }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0' }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
          {sub && <div style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>{sub}</div>}
        </div>
        <div className="drill-chevron" style={{ color: colors.faint, fontSize: 13 }}>
          {open ? '▴' : '▾'}
        </div>
      </div>
      <div className={open ? 'drill-body open' : 'drill-body'} style={{ paddingBottom: 12 }}>
        {children}
      </div>
    </div>
  );
}
