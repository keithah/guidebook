import { useId } from 'react';
import { card, colors, fonts } from '../../theme.js';
import ItinerarySteps from './ItinerarySteps.jsx';
import JourneyTimeline from './JourneyTimeline.jsx';
import { formatDuration, RouteTime } from './itineraryFormat.jsx';
import TripWarnings from './TripWarnings.jsx';

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
 * Render a transit trip card with timing, route details, transfer information, and an expandable itinerary.
 * @param {Object} trip - The transit trip to display.
 * @param {number} index - The trip's position in the results.
 * @param {boolean} expanded - Whether the full itinerary is visible.
 * @param {Function} onToggle - Called when the itinerary toggle is activated.
 * @param {Array} warnings - Warnings matched to the trip.
 * @param {string} [externalUrl] - Optional URL for opening the trip in a maps application.
 */
export default function TripCard({
  trip,
  index,
  expanded,
  onToggle,
  warnings,
  externalUrl,
}) {
  const itineraryId = useId();
  const transfers = Number.isFinite(trip.transferCount)
    ? trip.transferCount
    : 0;
  const toggleLabel = `${expanded ? 'Hide' : 'View'} full itinerary for ${optionLabel(trip)}`;
  const advisorySectionIds = new Set(
    (Array.isArray(warnings) ? warnings : []).flatMap(
      (warning) => warning.sectionIds ?? [],
    ),
  );

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
              <RouteTime
                value={trip.departureTime}
                fallback={<span>Time pending</span>}
              />
              {' – '}
              <RouteTime
                value={trip.arrivalTime}
                fallback={<span>Time pending</span>}
              />
            </span>
            <span style={{ color: colors.teal, fontSize: 13, fontWeight: 600 }}>
              {formatDuration(trip.durationSeconds ?? 0)}
            </span>
          </div>
        </div>
      </div>

      <JourneyTimeline
        sections={trip.sections ?? []}
        advisorySectionIds={advisorySectionIds}
      />

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
        onClick={() => onToggle()}
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
            <TripWarnings warnings={warnings} />
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
                Open transit directions in Google Maps ↗
              </a>
            )}
          </>
        )}
      </div>
    </article>
  );
}
