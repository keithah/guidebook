import { useApp } from '../context/AppContext.jsx';
import { colors } from '../theme.js';

export default function Checklist({ dense = false }) {
  const { property, done, toggleChecklistItem } = useApp();
  return (
    <>
      {property.checkout.checklist.map((text, i) => {
        const isDone = !!done[i];
        return (
          <div
            key={i}
            onClick={() => toggleChecklistItem(i)}
            style={{
              cursor: 'pointer',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              padding: dense ? '10px 0' : '13px 0',
              borderBottom: `1px solid ${colors.borderSoft}`,
            }}
          >
            <div
              style={{
                width: 19,
                height: 19,
                borderRadius: '50%',
                flexShrink: 0,
                background: isDone ? colors.teal : 'transparent',
                border: isDone ? `1.5px solid ${colors.teal}` : `1.5px solid ${colors.borderDashed}`,
              }}
            />
            <div style={{ fontSize: 14, color: isDone ? colors.faint : colors.ink, textDecoration: isDone ? 'line-through' : 'none' }}>
              {text}
            </div>
          </div>
        );
      })}
    </>
  );
}
