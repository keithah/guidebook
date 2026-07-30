import { card, colors, fonts } from '../../theme.js';
import JourneyIcon from './JourneyIcon.jsx';
import LiveStatus from './LiveStatus.jsx';
import { formatDuration } from './itineraryFormat.jsx';

const METERS_PER_MILE = 1_609.344;
const FAILURE_MESSAGES = {
  'missing-api-key': 'Walking directions are not configured yet.',
  unauthorized: 'Walking directions are unavailable right now.',
  'rate-limited': 'Walking directions are busy. Try again in a moment.',
  'no-route': 'No walking route was found for this destination.',
  'invalid-request': 'Walking directions are unavailable for this trip.',
};

/**
 * Format a route length for an imperial walking summary.
 * @param {number} lengthMeters - Route length in meters.
 * @returns {string} Miles rounded to one decimal place.
 */
function formatMiles(lengthMeters) {
  const miles = Number.isFinite(lengthMeters)
    ? Math.max(0, lengthMeters) / METERS_PER_MILE
    : 0;
  return `${miles.toFixed(1)} mi`;
}

/**
 * Render the Google Maps walking fallback when coordinates are valid.
 * @param {string|undefined} externalUrl - Walking directions URL.
 * @returns {JSX.Element|null} External link or null.
 */
function ExternalDirections({ externalUrl }) {
  if (!externalUrl) return null;
  return (
    <a
      href={externalUrl}
      target="_blank"
      rel="noreferrer"
      className="journey-external-link"
      style={{
        display: 'block',
        minHeight: 44,
        boxSizing: 'border-box',
        marginTop: 13,
        border: `1px solid ${colors.border}`,
        borderRadius: 999,
        padding: '11px 13px',
        color: colors.ink,
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      Open walking directions in Google Maps ↗
    </a>
  );
}

/**
 * Render complete HERE walking directions and a Google Maps fallback.
 * @param {Object} props - Walking panel properties.
 * @param {Object|null} props.result - Provider result, or null while loading.
 * @param {Function} [props.onRetry] - Retries a failed provider request.
 * @param {string} [props.externalUrl] - Google Maps walking URL.
 * @returns {JSX.Element} Walking directions panel.
 */
export default function WalkingJourney({ result, onRetry, externalUrl }) {
  const route = result?.ok ? result.route : null;
  const actions = Array.isArray(route?.actions) ? route.actions : [];
  const notices = Array.isArray(route?.notices) ? route.notices : [];

  return (
    <section aria-label="Walking directions" style={{ ...card, padding: 15 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: colors.teal,
          }}
        >
          <JourneyIcon type="walk" />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>
            Walking directions
          </span>
        </div>
        {result?.ok && (
          <LiveStatus source={result.source} timestamp={result.fetchedAt} />
        )}
      </div>

      {result === null && (
        <div
          role="status"
          style={{ marginTop: 12, color: colors.mutedText, fontSize: 13 }}
        >
          Loading walking directions…
        </div>
      )}

      {result && !result.ok && (
        <div style={{ marginTop: 12 }}>
          <div role="status" style={{ color: colors.mutedText, fontSize: 13 }}>
            {FAILURE_MESSAGES[result.reason] ||
              'Walking directions need a connection.'}
          </div>
          {onRetry && (
            <button
              type="button"
              className="journey-text-button"
              onClick={() => onRetry()}
              style={{
                minHeight: 44,
                marginTop: 2,
                border: 0,
                padding: '8px 0',
                background: 'transparent',
                color: colors.teal,
                cursor: 'pointer',
                font: 'inherit',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Retry walking directions
            </button>
          )}
        </div>
      )}

      {route && (
        <>
          <div
            style={{
              marginTop: 13,
              color: colors.ink,
              fontFamily: fonts.serif,
              fontSize: 24,
              lineHeight: 1.1,
            }}
          >
            Walk {formatMiles(route.lengthMeters)} ·{' '}
            {formatDuration(route.durationSeconds)}
          </div>

          {actions.length > 0 ? (
            <ol
              aria-label="Turn-by-turn walking directions"
              style={{
                margin: '15px 0 0',
                padding: 0,
                listStyle: 'none',
              }}
            >
              {actions.map((action, index) => (
                <li
                  key={`${action.type ?? 'step'}-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '30px minmax(0, 1fr)',
                    gap: 10,
                    borderTop:
                      index === 0 ? 0 : `1px solid ${colors.borderSoft}`,
                    padding: '11px 0',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: colors.sage,
                      color: colors.teal,
                    }}
                  >
                    <JourneyIcon type="walk" />
                  </span>
                  <span
                    style={{
                      alignSelf: 'center',
                      color: colors.tealText,
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    {action.instruction || action.label || 'Continue walking.'}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div
              style={{ marginTop: 13, color: colors.mutedText, fontSize: 13 }}
            >
              Turn-by-turn steps are unavailable.
            </div>
          )}

          {notices.length > 0 && (
            <div
              aria-label="Walking route notices"
              style={{
                marginTop: 11,
                borderRadius: 12,
                padding: '9px 11px',
                background: colors.cream,
                color: colors.tealText,
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {notices.map((notice, index) => (
                <div key={`${notice.code ?? 'notice'}-${index}`}>
                  {notice.title || 'Walking route notice'}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <ExternalDirections externalUrl={externalUrl} />
    </section>
  );
}
