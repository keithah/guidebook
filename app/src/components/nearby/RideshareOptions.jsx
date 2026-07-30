import { normalizeRideshareOptions } from '../../lib/rideshareOptions.js';
import { colors } from '../../theme.js';

/**
 * Render property-configured approximate rideshare estimates.
 * @param {Object} props - Component properties.
 * @param {Array<Object>} [props.rides=[]] - Property rideshare estimates.
 * @returns {JSX.Element|null} Approximate provider cards or null.
 */
export default function RideshareOptions({ rides = [] }) {
  const options = normalizeRideshareOptions(rides);
  if (options.length === 0) return null;

  return (
    <section aria-label="Rideshare options">
      <div
        style={{
          color: colors.muted,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
        }}
      >
        Approximate pickup waits
      </div>
      <div
        style={{
          marginTop: 4,
          color: colors.mutedText,
          fontSize: 12,
        }}
      >
        Approximate—not live
      </div>
      <div
        style={{
          marginTop: 3,
          color: colors.mutedText,
          fontSize: 11,
          lineHeight: 1.4,
        }}
      >
        Opening a provider may require a connection and its app or website.
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 8,
          marginTop: 9,
        }}
      >
        {options.map((option) => (
          <article
            key={option.providerId}
            aria-label={`${option.name} rideshare estimate`}
            style={{
              minWidth: 0,
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              padding: '13px 12px',
              background: colors.white,
            }}
          >
            <div
              style={{
                color: option.color,
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {option.name}
            </div>
            <div
              style={{
                minHeight: 34,
                marginTop: 4,
                color: colors.ink,
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              {option.pickupWaitLabel}
            </div>
            <div
              style={{
                marginTop: 4,
                color: colors.muted,
                fontSize: 10,
                lineHeight: 1.35,
              }}
            >
              {option.note}
            </div>
            <div style={{ marginTop: 9, fontSize: 12 }}>
              {option.launchUrl ? (
                <a
                  href={option.launchUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${option.name}`}
                >
                  Open {option.name} ↗
                </a>
              ) : (
                <span style={{ color: colors.muted }}>Launch unavailable</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
