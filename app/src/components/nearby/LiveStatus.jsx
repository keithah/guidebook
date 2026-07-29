import { colors } from '../../theme.js';

const SOURCE_LABELS = {
  network: 'Live',
  live: 'Live',
  cache: 'Cached',
  cached: 'Cached',
  stale: 'Last known',
  unavailable: 'Unavailable',
};

/**
 * Converts a timestamp value to milliseconds since the Unix epoch.
 * @param {*} timestamp - A date, date string, or number-like timestamp.
 * @return {number} The timestamp in milliseconds, or `NaN` when the value cannot be converted.
 */
function timestampValue(timestamp) {
  if (timestamp == null || timestamp === '') return Number.NaN;
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp === 'string') return Date.parse(timestamp);
  return Number(timestamp);
}

/**
 * Formats a timestamp as a relative age.
 * @param {Date|string|number} timestamp - The timestamp to format.
 * @param {number} [now=Date.now()] - The reference time in milliseconds.
 * @return {string} A relative age such as “just now”, “5 min ago”, or “2 days ago”.
 */
function relativeAge(timestamp, now = Date.now()) {
  const elapsedSeconds = Math.max(
    0,
    Math.round((now - timestampValue(timestamp)) / 1_000),
  );
  if (elapsedSeconds < 60) return 'just now';
  const minutes = Math.round(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Render a compact status label with optional live indicator and relative update time.
 * @param {Object} props - Component properties.
 * @param {string} props.source - Status source used to select the default label and live indicator.
 * @param {Date|string|number} [props.timestamp] - Timestamp used to display the relative update age.
 * @param {string} [props.label] - Custom status label that overrides the source label.
 * @returns {JSX.Element} The rendered status indicator.
 */
export default function LiveStatus({ source, timestamp, label }) {
  const statusLabel = label ?? SOURCE_LABELS[source] ?? 'Updated';
  const value = timestampValue(timestamp);
  const hasTimestamp = Number.isFinite(value);
  const age = hasTimestamp ? relativeAge(value) : null;
  const accessibleLabel = age
    ? `${statusLabel} · updated ${age}`
    : statusLabel;

  return (
    <span
      role="status"
      aria-label={accessibleLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        color: colors.mutedText,
        fontSize: 11,
        whiteSpace: 'nowrap',
      }}
    >
      {(source === 'network' || source === 'live') && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#3A8F62',
          }}
        />
      )}
      <span>{statusLabel}</span>
      {hasTimestamp && (
        <>
          <span aria-hidden="true">·</span>
          <time dateTime={new Date(value).toISOString()}>
            updated {age}
          </time>
        </>
      )}
    </span>
  );
}
