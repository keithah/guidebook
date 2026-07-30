import { colors } from '../../theme.js';
import JourneyIcon from './JourneyIcon.jsx';

const MODES = [
  { value: 'transit', label: 'Transit', icon: 'bus' },
  { value: 'walk', label: 'Walk', icon: 'walk' },
  { value: 'rideshare', label: 'Rideshare', icon: 'car' },
];

/**
 * Choose which journey provider panel is visible.
 * @param {Object} props - Selector properties.
 * @param {'transit'|'walk'|'rideshare'} props.value - Active mode.
 * @param {Function} props.onChange - Called with the selected mode.
 * @returns {JSX.Element} Three accessible mode buttons.
 */
export default function TripModeSelector({ value, onChange }) {
  const selectedValue = MODES.some((mode) => mode.value === value)
    ? value
    : 'transit';

  return (
    <div
      role="group"
      aria-label="Travel mode"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 6,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: 4,
        background: colors.white,
      }}
    >
      {MODES.map((mode) => {
        const selected = selectedValue === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            className="trip-mode-button"
            aria-pressed={selected}
            onClick={() => onChange(mode.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              minWidth: 0,
              minHeight: 44,
              border: 0,
              borderRadius: 12,
              padding: '8px 6px',
              background: selected ? colors.sageDeep : 'transparent',
              color: selected ? colors.teal : colors.mutedText,
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 12,
              fontWeight: selected ? 700 : 600,
            }}
          >
            <JourneyIcon type={mode.icon} />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
