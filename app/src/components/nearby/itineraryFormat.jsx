// oxlint-disable-next-line react/only-export-components -- required pure formatter API
export const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) return '0 min';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0
    ? `${hours} hr`
    : `${hours} hr ${remainingMinutes} min`;
};

/**
 * Formats a valid date or time value for display.
 * @param {*} value - The date or time value to format.
 * @return {?string} The localized time string, or `null` for an absent or invalid value.
 */
// oxlint-disable-next-line react/only-export-components -- required pure formatter API
export function formatTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  }).format(new Date(value));
}

/**
 * Render a localized time value as a semantic time element.
 * @param {*} value - The date or time value to format.
 * @param {JSX.Element|null} fallback - Content rendered for an invalid or absent value.
 * @returns {JSX.Element|null} A time element for valid values, or the supplied fallback.
 */
export function RouteTime({ value, fallback = null }) {
  const text = formatTime(value);
  return text ? <time dateTime={value}>{text}</time> : fallback;
}
