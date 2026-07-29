import { useId, useState } from 'react';
import { colors } from '../../theme.js';
import LiveStatus from './LiveStatus.jsx';

/**
 * Normalizes a transit line identifier for consistent comparison.
 * @param {*} value - The value to convert into a line identifier.
 * @return {string} The trimmed, uppercase line identifier.
 */
function normalizeLineId(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

/**
 * Determines whether an alert affects any requested transit line.
 * @param {Object} alert - The alert to inspect.
 * @param {Array<*>} lineIds - The transit line identifiers to match.
 * @return {boolean} `true` if the alert affects a requested line, `false` otherwise.
 */
function affectsLine(alert, lineIds) {
  const affectedLines = Array.isArray(alert?.affectedLines)
    ? alert.affectedLines
    : [];
  if (!Array.isArray(lineIds) || lineIds.length === 0) return false;

  const requested = new Set(lineIds.map(normalizeLineId));
  return affectedLines.some((line) => requested.has(normalizeLineId(line)));
}

/**
 * Creates a user-facing message for a live alert service status.
 * @param {string} status - The current alert service status.
 * @param {string} error - The specific error condition, when applicable.
 * @return {string|null} The corresponding status message, or `null` when no message is needed.
 */
function alertErrorMessage(status, error) {
  if (status === 'stale') {
    return 'Live alert update is unavailable. Showing last known alerts.';
  }
  if (status !== 'unavailable') return null;
  if (error === 'missing-api-key')
    return 'Live service alerts are not configured.';
  return 'Live service alerts are unavailable right now.';
}

/**
 * Renders a transit alert with optionally expandable details.
 * @param {{ alert: Object }} props - The component props containing the alert to display.
 */
function AlertRow({ alert }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const hasDetails = Boolean(
    alert.description ||
    alert.activePeriod?.start ||
    alert.activePeriod?.end ||
    alert.url ||
    alert.updatedAt,
  );

  return (
    <li
      style={{
        padding: '10px 0',
        borderBottom: `1px solid ${colors.borderSoft}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ color: colors.ink, fontSize: 13, fontWeight: 600 }}>
          {alert.header}
        </div>
        {hasDetails && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={`${expanded ? 'Hide' : 'Show'} details for ${alert.header}`}
            onClick={() => setExpanded((value) => !value)}
            style={{
              border: 0,
              padding: 0,
              background: 'transparent',
              color: colors.teal,
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {expanded ? 'Hide' : 'Details'}
          </button>
        )}
      </div>
      {hasDetails && (
        <div
          id={detailsId}
          hidden={!expanded}
          style={{
            marginTop: 6,
            color: colors.mutedText,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {expanded && (
            <>
              {alert.description && <div>{alert.description}</div>}
              {(alert.activePeriod?.start || alert.activePeriod?.end) && (
                <div style={{ marginTop: 4 }}>
                  {alert.activePeriod.start && (
                    <>
                      From{' '}
                      <time dateTime={alert.activePeriod.start}>
                        {new Date(alert.activePeriod.start).toLocaleString()}
                      </time>
                    </>
                  )}
                  {alert.activePeriod.start && alert.activePeriod.end && ' · '}
                  {alert.activePeriod.end && (
                    <>
                      Until{' '}
                      <time dateTime={alert.activePeriod.end}>
                        {new Date(alert.activePeriod.end).toLocaleString()}
                      </time>
                    </>
                  )}
                </div>
              )}
              {alert.updatedAt && (
                <div style={{ marginTop: 4 }}>
                  Updated{' '}
                  <time dateTime={alert.updatedAt}>
                    {new Date(alert.updatedAt).toLocaleString()}
                  </time>
                </div>
              )}
              {alert.url && (
                <a
                  href={alert.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-block', marginTop: 5 }}
                >
                  Read alert ↗
                </a>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Displays relevant transit service alerts and live update status.
 * @param {Object} props - Component properties.
 * @param {Array} [props.alerts=[]] - Transit alerts to filter and display.
 * @param {Array} [props.lineIds] - Line identifiers used to select alerts for a trip.
 * @param {string} [props.status] - Live alert update status.
 * @param {string|Date} [props.updatedAt] - Time of the latest alert update.
 * @param {string} [props.error] - Error identifier associated with the alert update.
 * @param {Array} [props.excludeLineIds=[]] - Line identifiers whose alerts are excluded in standalone mode.
 * @returns {JSX.Element|null} The alerts section, or `null` when there is no relevant content.
 */
export default function TransitAlerts({
  alerts = [],
  lineIds,
  status,
  updatedAt,
  error,
  excludeLineIds = [],
}) {
  const standalone = lineIds === undefined;
  const relevantAlerts = alerts.filter((alert) =>
    standalone
      ? !affectsLine(alert, excludeLineIds)
      : affectsLine(alert, lineIds),
  );
  const showStatus = standalone && Boolean(status);
  const statusMessage = alertErrorMessage(status, error);
  if (relevantAlerts.length === 0 && !showStatus) return null;

  return (
    <section
      aria-label={standalone ? 'Transit alerts' : 'Alerts for this trip'}
      style={{
        marginTop: 12,
        borderRadius: 12,
        background: colors.cream,
        padding: '3px 12px',
      }}
    >
      <div
        style={{
          paddingTop: 9,
          color: colors.muted,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
        }}
      >
        {standalone ? 'Current SF service alerts' : 'Service alert'}
      </div>
      {showStatus && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '8px 0 5px',
          }}
        >
          {status === 'loading' ? (
            <span style={{ color: colors.mutedText, fontSize: 12 }}>
              Checking current service alerts…
            </span>
          ) : (
            <LiveStatus source={status} timestamp={updatedAt} />
          )}
        </div>
      )}
      {statusMessage && (
        <div
          style={{ color: colors.mutedText, fontSize: 12, lineHeight: 1.45 }}
        >
          {statusMessage}
        </div>
      )}
      {relevantAlerts.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {relevantAlerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </ul>
      )}
    </section>
  );
}
