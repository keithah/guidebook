import LineBadge from '../LineBadge.jsx';
import { colors, fonts } from '../../theme.js';

// oxlint-disable-next-line react/only-export-components -- required pure formatter API
export const formatDuration = (seconds) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
    : `${minutes} min`;
};

function formatTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function lineIdFor(section) {
  return (
    section.transport?.shortName ??
    section.transport?.name?.split(/\s+/)[0] ??
    section.transport?.mode ??
    '?'
  );
}

function sectionHeading(section) {
  if (section.type === 'pedestrian') {
    return `Walk to ${section.arrival?.name || 'the next stop'}`;
  }
  if (section.type === 'transit') {
    const line =
      section.transport?.name ??
      section.transport?.shortName ??
      'Transit';
    const destination =
      section.transport?.headsign || section.arrival?.name;
    return destination ? `${line} toward ${destination}` : line;
  }
  return section.label || 'Route step';
}

function RouteTime({ value }) {
  const text = formatTime(value);
  return text ? <time dateTime={value}>{text}</time> : null;
}

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

function KnownSection({ section }) {
  const isTransit = section.type === 'transit';
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {isTransit ? (
          <LineBadge line={lineIdFor(section)} size={26} fontSize="11px" />
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
      <div
        style={{ marginTop: 7, color: colors.tealText, fontSize: 13 }}
      >
        {section.instruction || 'Continue to the next part of the trip.'}
      </div>
    </>
  );
}

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
