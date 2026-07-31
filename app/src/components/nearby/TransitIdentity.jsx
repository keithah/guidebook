import BartLogo from '../BartLogo.jsx';
import MuniLogo from '../MuniLogo.jsx';
import { classifyTransitLeg } from '../../lib/transitIdentity.js';
import JourneyIcon from './JourneyIcon.jsx';

/**
 * Render an operator-aware transit line mark with one accessible label.
 * @param {Object} props - Component props.
 * @param {Object} props.section - Transit section to classify.
 * @param {boolean} [props.compact=false] - Whether to use the smaller operator mark.
 * @returns {JSX.Element} The shared transit identity.
 */
export default function TransitIdentity({ section, compact = false }) {
  const identity = classifyTransitLeg(section);

  return (
    <span
      role="img"
      aria-label={identity.accessibleLabel}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
    >
      {identity.operator === 'muni' ? (
        <MuniLogo height={compact ? 10 : 12} decorative />
      ) : null}
      {identity.operator === 'bart' ? (
        <BartLogo height={compact ? 10 : 12} decorative />
      ) : null}
      {identity.operator === 'other' ? (
        <span aria-hidden="true">{identity.operatorLabel}</span>
      ) : null}
      <JourneyIcon type={identity.vehicle} />
      <span
        aria-hidden="true"
        style={{
          background: identity.color,
          color: identity.foreground,
          borderRadius: 999,
          padding: '2px 6px',
          fontWeight: 700,
        }}
      >
        {identity.lineLabel}
      </span>
    </span>
  );
}
