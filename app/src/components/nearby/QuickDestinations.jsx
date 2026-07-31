import { colors } from '../../theme.js';

/**
 * Render direct destination shortcuts in their configured display order.
 * @param {Object} props - Shortcut configuration.
 * @param {Array<Object>} props.destinations - Structured destination objects.
 * @param {Function} props.onSelect - Called with the exact selected destination.
 * @return {JSX.Element} The destination shortcut buttons.
 */
export default function QuickDestinations({ destinations, onSelect }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {destinations.map((destination, index) => (
        <button
          key={destination.id}
          type="button"
          onClick={() => onSelect(destination)}
          style={{
            border:
              index === 0 ? 0 : `1px solid ${colors.border}`,
            borderRadius: 999,
            padding: '7px 13px',
            background: index === 0 ? colors.teal : colors.white,
            color: index === 0 ? '#F2F7F5' : colors.ink,
            cursor: 'pointer',
            font: 'inherit',
            fontSize: 12,
            fontWeight: index === 0 ? 600 : undefined,
            whiteSpace: 'nowrap',
          }}
        >
          {destination.buttonLabel}
        </button>
      ))}
    </div>
  );
}
