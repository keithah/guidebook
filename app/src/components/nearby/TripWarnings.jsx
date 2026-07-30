import { colors } from '../../theme.js';

/**
 * Displays warnings already matched to one trip.
 * @param {Object} props - Component properties.
 * @param {Array<Object>} [props.warnings=[]] - Relevant normalized warnings.
 * @param {boolean} [props.compact=false] - Whether to show card-summary content only.
 * @returns {JSX.Element|null} The warning block, or null when no warnings exist.
 */
export default function TripWarnings({ warnings = [], compact = false }) {
  if (!Array.isArray(warnings) || warnings.length === 0) return null;

  return (
    <section
      aria-label="Warnings for this trip"
      style={{
        marginTop: 12,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: compact ? '9px 11px' : '3px 12px',
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
      <ul style={{ margin: compact ? '5px 0 0' : 0, padding: 0, listStyle: 'none' }}>
        {warnings.map((warning) => (
          <li
            key={warning.id || `${warning.header}:${warning.description}`}
            style={{
              padding: compact ? '3px 0' : '9px 0',
              borderBottom: compact ? 0 : `1px solid ${colors.borderSoft}`,
            }}
          >
            <div style={{ color: colors.ink, fontSize: 13, fontWeight: 700 }}>
              <span aria-hidden="true">⚠ </span>
              {warning.header}
            </div>
            {!compact && (
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
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
