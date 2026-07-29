import { useId } from 'react';
import LineBadge from '../LineBadge.jsx';
import { card, colors, fonts } from '../../theme.js';
import ItinerarySteps, { formatDuration } from './ItinerarySteps.jsx';
import TransitAlerts from './TransitAlerts.jsx';

/**
 * Formats a date value as an hour-and-minute time string.
 * @param {*} value - The date value to parse.
 * @return {?string} The formatted time, or `null` when the value cannot be parsed.
 */
function formatTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

/**
 * Render a formatted time or a pending-time placeholder.
 * @param {*} value - The date value used to generate the displayed time.
 * @return {JSX.Element} A time element when the value is valid; otherwise, a pending-time placeholder.
 */
function RouteTime({ value }) {
  const text = formatTime(value);
  return text ? (
    <time dateTime={value}>{text}</time>
  ) : (
    <span>Time pending</span>
  );
}

/**
 * Extracts unique identifiers for the transit lines in a trip.
 * @param {Object} trip - The trip whose transit sections provide the line identifiers.
 * @return {string[]} The unique truthy short names or first name tokens for transit lines.
 */
function lineIdsFor(trip) {
  const sectionIds = (trip.sections ?? [])
    .filter((section) => section.type === 'transit')
    .map(
      (section) =>
        section.transport?.shortName ??
        section.transport?.name?.split(/\s+/)[0],
    );
  return [...new Set(sectionIds.filter(Boolean))];
}

/**
 * Builds a human-readable label for a transit option.
 * @param {Object} trip - The trip containing line names and route sections.
 * @return {string} The joined line names, an unknown-section label, or `transit option`.
 */
function optionLabel(trip) {
  const lines = (trip.lines ?? []).map((line) => line.name).filter(Boolean);
  return (
    lines.join(' and ') ||
    trip.sections?.find((section) => section.type === 'unknown')?.label ||
    'transit option'
  );
}

/**
 * Displays the transit lines and destinations for a trip.
 * @param {Object} trip - The trip containing transit sections to display.
 */
function TripLines({ trip }) {
  const transitSections = (trip.sections ?? []).filter(
    (section) => section.type === 'transit',
  );
  if (transitSections.length === 0) {
    return (
      <div style={{ color: colors.mutedText, fontSize: 13 }}>
        {trip.sections?.[0]?.label || 'Transit option'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 11 }}>
      {transitSections.map((section, index) => {
        const line =
          section.transport?.shortName ??
          section.transport?.name?.split(/\s+/)[0] ??
          '?';
        return (
          <div
            key={section.id || `${line}-${index}`}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <LineBadge line={line} size={24} fontSize="10px" />
            <span style={{ color: colors.tealText, fontSize: 12 }}>
              {section.transport?.name || line}
              {section.transport?.headsign
                ? ` toward ${section.transport.headsign}`
                : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Render a transit trip card with timing, route details, transfer information, and an expandable itinerary.
 * @param {Object} trip - The transit trip to display.
 * @param {number} index - The trip's position in the results.
 * @param {boolean} expanded - Whether the full itinerary is visible.
 * @param {Function} onToggle - Called with the trip's line identifiers when the itinerary toggle is activated.
 * @param {Array} alerts - Transit alerts associated with the trip.
 * @param {string} [externalUrl] - Optional URL for opening the trip in a maps application.
 */
export default function TripCard({
  trip,
  index,
  expanded,
  onToggle,
  alerts,
  externalUrl,
}) {
  const itineraryId = useId();
  const lineIds = lineIdsFor(trip);
  const transfers = Number.isFinite(trip.transferCount)
    ? trip.transferCount
    : 0;
  const toggleLabel = `${expanded ? 'Hide' : 'View'} full itinerary for ${optionLabel(trip)}`;

  return (
    <article
      style={{
        ...card,
        padding: 15,
        boxShadow: index === 0 ? '0 7px 20px rgba(20, 32, 29, .06)' : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          {index === 0 && (
            <div
              style={{
                marginBottom: 4,
                color: colors.teal,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
              }}
            >
              Recommended
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            <span
              style={{
                fontFamily: fonts.serif,
                color: colors.ink,
                fontSize: 24,
                lineHeight: 1,
              }}
            >
              <RouteTime value={trip.departureTime} />
              {' – '}
              <RouteTime value={trip.arrivalTime} />
            </span>
            <span style={{ color: colors.teal, fontSize: 13, fontWeight: 600 }}>
              {formatDuration(trip.durationSeconds ?? 0)}
            </span>
          </div>
        </div>
      </div>

      <TripLines trip={trip} />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 7,
          marginTop: 10,
          color: colors.muted,
          fontSize: 11,
        }}
      >
        <span>
          {trip.walkingDurationSeconds > 0
            ? `Walk ${formatDuration(trip.walkingDurationSeconds)}`
            : 'No walking'}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {transfers === 0
            ? 'No transfers'
            : `${transfers} transfer${transfers === 1 ? '' : 's'}`}
        </span>
      </div>

      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={itineraryId}
        aria-label={toggleLabel}
        onClick={() => onToggle(lineIds)}
        style={{
          width: '100%',
          marginTop: 12,
          border: `1px solid ${colors.border}`,
          borderRadius: 999,
          padding: '10px 13px',
          background: expanded ? colors.sageDeep : colors.white,
          color: colors.teal,
          cursor: 'pointer',
          font: 'inherit',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {expanded ? 'Hide full itinerary' : 'View full itinerary'}
      </button>

      <div id={itineraryId} hidden={!expanded}>
        {expanded && (
          <>
            <TransitAlerts alerts={alerts} lineIds={lineIds} />
            <ItinerarySteps trip={trip} />
            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'block',
                  border: `1px solid ${colors.border}`,
                  borderRadius: 999,
                  padding: '10px 13px',
                  color: colors.ink,
                  textAlign: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Open in maps ↗
              </a>
            )}
          </>
        )}
      </div>
    </article>
  );
}
