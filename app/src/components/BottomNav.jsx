import { useApp } from '../context/AppContext.jsx';
import { colors } from '../theme.js';

const ITEMS = [
  { tab: 'home', glyph: '⌂', label: 'Home' },
  { tab: 'arrive', glyph: '⌖', label: 'Arrive' },
  { tab: 'cottage', glyph: '▤', label: 'Cottage' },
  { tab: 'around', glyph: '◍', label: 'Around' },
  { tab: 'explore', glyph: '↗', label: 'Explore' },
  { tab: 'help', glyph: '✚', label: 'Help' },
];

export default function BottomNav() {
  const { tab, goTab } = useApp();
  return (
    <div style={{ display: 'flex', borderTop: `1px solid ${colors.border}`, background: colors.navBg, padding: '6px 4px 18px' }}>
      {ITEMS.map((item) => {
        const on = tab === item.tab;
        return (
          <div
            key={item.tab}
            onClick={goTab(item.tab)}
            style={{
              flex: 1,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 0',
              fontSize: 10,
              fontWeight: on ? 700 : 500,
              color: on ? colors.teal : colors.muted,
            }}
          >
            {item.glyph}
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
