import { colors } from '../../theme.js';

const HIGH_IMPACT = /(SIGNIFICANT|SEVERE|NO[_\s-]?SERVICE|STOPPED)/i;
const SERVICE_CHANGE = /(MODIFIED|DETOUR|REDUCED|ADDITIONAL|CHANGE)/i;

/**
 * Select visual warning treatment for a provider severity value.
 * @param {string} severity - Provider warning severity.
 * @returns {Object} Warning presentation.
 */
function presentationFor(severity) {
  const value = String(severity ?? '').trim();
  if (HIGH_IMPACT.test(value)) {
    return {
      label: 'High impact',
      background: '#FCE8E6',
      border: '#B3261E',
      color: '#8C1D18',
      icon: '!',
    };
  }
  if (SERVICE_CHANGE.test(value)) {
    return {
      label: 'Service change',
      background: colors.cream,
      border: colors.sun,
      color: '#7A4B08',
      icon: '↪',
    };
  }
  return {
    label: 'Advisory',
    background: colors.sageDeep,
    border: colors.teal,
    color: colors.tealText,
    icon: 'i',
  };
}

/**
 * Displays warnings already matched to one trip.
 * @param {Object} props - Component properties.
 * @param {Array<Object>} [props.warnings=[]] - Relevant normalized warnings.
 * @returns {JSX.Element|null} The warning block, or null when no warnings exist.
 */
export default function TripWarnings({ warnings = [] }) {
  if (!Array.isArray(warnings) || warnings.length === 0) return null;

  return (
    <section
      aria-label="Warnings for this trip"
      style={{
        marginTop: 12,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: '3px 12px',
        background: colors.cream,
      }}
    >
      <div
        style={{
          color: colors.muted,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
        }}
      >
        {warnings.length === 1 ? 'Service warning' : 'Service warnings'}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {warnings.map((warning, index) => {
          const presentation = presentationFor(warning.severity);
          return (
            <li
              key={warning.id || `${warning.header}:${warning.description}`}
              aria-label={`${presentation.label}: ${warning.header}`}
              style={{
                marginTop: index === 0 ? 0 : 5,
                borderLeft: `4px solid ${presentation.border}`,
                borderRadius: 8,
                padding: '9px 10px',
                background: presentation.background,
              }}
            >
              <div
                style={{
                  color: presentation.color,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                }}
              >
                {presentation.label}
              </div>
              <div
                style={{
                  marginTop: 2,
                  color: colors.ink,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                <span aria-hidden="true">{presentation.icon} </span>
                {warning.header}
              </div>
              <div
                style={{
                  marginTop: 4,
                  color: colors.mutedText,
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {warning.description && <div>{warning.description}</div>}
                <div style={{ marginTop: warning.description ? 3 : 0 }}>
                  <span>{warning.source}</span>
                  {warning.url && (
                    <>
                      {' · '}
                      <a
                        href={warning.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Read ${warning.header} warning`}
                      >
                        Read warning ↗
                      </a>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
