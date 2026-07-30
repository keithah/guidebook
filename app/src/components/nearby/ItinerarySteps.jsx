import { colors, fonts } from '../../theme.js';
import { formatDuration, RouteTime } from './itineraryFormat.jsx';
import TransitIdentity from './TransitIdentity.jsx';

/**
 * Create a display heading for an itinerary section.
 * @param {Object} section - The itinerary section to describe.
 * @returns {string} A heading based on the section type, destination, line, or label.
 */
function sectionHeading(section) {
  if (section.type === 'pedestrian') {
    return `Walk to ${section.arrival?.name || 'the next stop'}`;
  }
  if (section.type === 'transit') {
    const line =
      section.transport?.name ?? section.transport?.shortName ?? 'Transit';
    const destination = section.transport?.headsign || section.arrival?.name;
    return destination ? `${line} toward ${destination}` : line;
  }
  return section.label || 'Route step';
}

/**
 * Display a place name with optional platform and stop code details.
 * @param {Object} place - The place information to display.
 * @param {string} prefix - The label shown before the place name.
 * @returns {JSX.Element|null} The place details, or `null` when the place has no name.
 */
function PlaceDetails({ place, prefix }) {
  if (!place?.name) return null;
  const details = [
    place.platform ? `Platform ${place.platform}` : null,
    place.stopCode ? `Stop ${place.stopCode}` : null,
  ].filter(Boolean);

  return (
    <div style={{ lineHeight: 1.5 }}>
      <span style={{ fontWeight: 600 }}>{prefix}:</span> {place.name}
      {details.length > 0 && (
        <div style={{ color: colors.mutedText, fontSize: 12 }}>
          {details.join(' · ')}
        </div>
      )}
    </div>
  );
}

/**
 * Render the ordered instructions associated with an itinerary section.
 * @param {Object} section - The itinerary section containing the actions to display.
 * @returns {JSX.Element|null} An ordered instruction list, or `null` when the section has no actions.
 */
function ActionList({ section }) {
  if (!section.actions?.length) return null;

  return (
    <ol
      data-testid={
        section.type === 'pedestrian' ? 'walking-maneuvers' : undefined
      }
      aria-label={
        section.type === 'pedestrian'
          ? `Walking directions to ${section.arrival?.name || 'the next stop'}`
          : 'Boarding and arrival instructions'
      }
      style={{
        margin: '11px 0 0',
        paddingLeft: 21,
        color: colors.tealText,
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      {section.actions.map((action, index) => (
        <li
          key={`${action.type}-${index}`}
          style={{ padding: '2px 0 2px 3px' }}
        >
          {action.instruction || action.label || 'Route step'}
        </li>
      ))}
    </ol>
  );
}

/**
 * Display intermediate stops with optional platform and departure-time details.
 * @param {Array<Object>} stops - The intermediate stops to display.
 * @returns {JSX.Element|null} The rendered stop list, or `null` when no stops are provided.
 */
function IntermediateStops({ stops }) {
  if (!stops?.length) return null;

  return (
    <div style={{ marginTop: 11 }}>
      <div
        style={{
          color: colors.muted,
          fontSize: 11,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
        }}
      >
        {stops.length} intermediate {stops.length === 1 ? 'stop' : 'stops'}
      </div>
      <ol
        aria-label="Intermediate stops"
        style={{
          margin: '5px 0 0',
          paddingLeft: 21,
          color: colors.mutedText,
          fontSize: 12,
          lineHeight: 1.55,
        }}
      >
        {stops.map((stop, index) => (
          <li key={stop.id || `${stop.name}-${index}`}>
            <span>{stop.name || 'Unnamed stop'}</span>
            {stop.platform && <span> · Platform {stop.platform}</span>}
            {stop.departureTime && (
              <>
                {' · '}
                <RouteTime value={stop.departureTime} />
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Display service notices and incident descriptions for a route section.
 * @param {Object} section - The route section containing notices and incidents.
 * @returns {JSX.Element|null} A list of service notes, or null when none are available.
 */
function SectionNotices({ section }) {
  const notices = [
    ...(section.notices ?? []).map((notice) => notice.title),
    ...(section.incidents ?? []).map(
      (incident) => incident.summary || incident.description,
    ),
  ].filter(Boolean);
  if (!notices.length) return null;

  return (
    <ul
      aria-label="Service notes"
      style={{
        listStyle: 'none',
        margin: '10px 0 0',
        padding: '9px 10px',
        borderRadius: 10,
        background: colors.cream,
        color: colors.tealText,
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      {notices.map((notice, index) => (
        <li key={`${notice}-${index}`}>{notice}</li>
      ))}
    </ul>
  );
}

/**
 * Render detailed information for a known itinerary section.
 * @param {Object} section - The itinerary section to display.
 */
function KnownSection({ section }) {
  const isTransit = section.type === 'transit';
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {isTransit ? (
          <TransitIdentity section={section} />
        ) : (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              flexShrink: 0,
              borderRadius: '50%',
              background: colors.sage,
              color: colors.teal,
              fontSize: 14,
            }}
          >
            ○
          </span>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <h4
            style={{
              margin: 0,
              fontFamily: fonts.serif,
              color: colors.ink,
              fontSize: 19,
              fontWeight: 400,
              lineHeight: 1.15,
            }}
          >
            {sectionHeading(section)}
          </h4>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 5,
              marginTop: 3,
              color: colors.muted,
              fontSize: 11,
            }}
          >
            <RouteTime value={section.departureTime} />
            {section.departureTime && section.arrivalTime && (
              <span aria-hidden="true">→</span>
            )}
            <RouteTime value={section.arrivalTime} />
            {Number.isFinite(section.durationSeconds) && (
              <span>· {formatDuration(section.durationSeconds)}</span>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 5,
          marginTop: 10,
          color: colors.ink,
          fontSize: 12,
        }}
      >
        <PlaceDetails place={section.departure} prefix="From" />
        <PlaceDetails place={section.arrival} prefix="To" />
      </div>
      <ActionList section={section} />
      <IntermediateStops stops={section.intermediateStops} />
      <SectionNotices section={section} />
    </>
  );
}

/**
 * Render a simplified itinerary section with its heading and instruction.
 * @param {Object} section - The itinerary section to display.
 */
function UnknownSection({ section }) {
  return (
    <>
      <h4
        style={{
          margin: 0,
          fontFamily: fonts.serif,
          color: colors.ink,
          fontSize: 19,
          fontWeight: 400,
        }}
      >
        {sectionHeading(section)}
      </h4>
      <div style={{ marginTop: 7, color: colors.tealText, fontSize: 13 }}>
        {section.instruction || 'Continue to the next part of the trip.'}
      </div>
    </>
  );
}

/**
 * Render all itinerary sections in order.
 * @param {Object} trip - Trip data containing an optional `sections` array.
 * @returns {JSX.Element} An ordered list of itinerary sections.
 */
export default function ItinerarySteps({ trip }) {
  const sections = Array.isArray(trip?.sections) ? trip.sections : [];

  return (
    <ol
      aria-label="Full itinerary"
      style={{ listStyle: 'none', margin: 0, padding: 0 }}
    >
      {sections.map((section, index) => (
        <li
          key={section.id || `${section.type}-${index}`}
          data-testid="itinerary-section"
          style={{
            position: 'relative',
            padding: '15px 0',
            borderBottom:
              index === sections.length - 1
                ? 'none'
                : `1px solid ${colors.borderSoft}`,
          }}
        >
          {section.type === 'unknown' ? (
            <UnknownSection section={section} />
          ) : (
            <KnownSection section={section} />
          )}
        </li>
      ))}
    </ol>
  );
}
