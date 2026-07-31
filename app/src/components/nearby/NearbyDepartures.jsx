import { card, colors, fonts } from '../../theme.js';
import { formatTime } from './itineraryFormat.jsx';
import TransitIdentity from './TransitIdentity.jsx';

/**
 * Return the effective departure time after applying a live delay.
 * @param {object} departure - Normalized departure data.
 * @returns {string|null} ISO departure timestamp, or null when invalid.
 */
function effectiveDepartureTime(departure) {
  const scheduledTime = Date.parse(departure?.scheduledTime);
  if (!Number.isFinite(scheduledTime)) return null;
  const delaySeconds = Number.isFinite(departure?.delaySeconds)
    ? departure.delaySeconds
    : 0;
  return new Date(scheduledTime + delaySeconds * 1_000).toISOString();
}

/**
 * Render one service and its next two departures.
 * @param {object} props - Component props.
 * @param {object} props.service - Normalized service data.
 * @returns {JSX.Element} Service identity and departure times.
 */
function NearbyService({ service }) {
  const section = {
    type: 'transit',
    agency: service.agency,
    transport: service.transport,
  };
  const departures = (service.departures ?? []).slice(0, 2);

  return (
    <div
      data-testid={`service-${service.key}`}
      style={{ padding: '10px 0', borderTop: `1px solid ${colors.borderSoft}` }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <TransitIdentity section={section} compact />
        {service.headsign ? (
          <span style={{ color: colors.tealText, fontSize: 13 }}>
            {service.headsign}
          </span>
        ) : null}
      </div>
      {departures.length > 0 ? (
        <ul
          aria-label="Next departures"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            listStyle: 'none',
            margin: '8px 0 0',
            padding: 0,
            color: colors.ink,
            fontSize: 13,
          }}
        >
          {departures.map((departure, index) => {
            const effectiveTime = effectiveDepartureTime(departure);
            const timeLabel = formatTime(effectiveTime);
            const isLive = Number.isFinite(departure.delaySeconds);
            return (
              <li key={`${departure.scheduledTime}-${index}`}>
                {timeLabel ? (
                  <time dateTime={effectiveTime}>{timeLabel}</time>
                ) : (
                  <span>Time unavailable</span>
                )}{' '}
                <span style={{ color: colors.mutedText, fontSize: 11 }}>
                  {isLive ? 'Live' : 'Scheduled'}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p style={{ margin: '8px 0 0', color: colors.mutedText, fontSize: 12 }}>
          No departures in the next hour
        </p>
      )}
    </div>
  );
}

/**
 * Render nearby transit loading, failure, empty, and station states.
 * @param {object} props - Component props.
 * @param {object|null} props.result - Current-origin nearby result.
 * @param {Function} props.onRetry - Failure retry action.
 * @returns {JSX.Element} Nearby departure board.
 */
export default function NearbyDepartures({ result, onRetry }) {
  const stations = result?.ok && Array.isArray(result.stations)
    ? result.stations.slice(0, 5)
    : [];

  return (
    <section aria-label="Nearby departures" style={card}>
      <h2
        style={{
          margin: '0 0 10px',
          color: colors.ink,
          fontFamily: fonts.serif,
          fontSize: 23,
          fontWeight: 400,
        }}
      >
        Nearby departures
      </h2>

      {result === null ? (
        <p style={{ margin: 0, color: colors.mutedText }}>
          Finding nearby departures…
        </p>
      ) : null}

      {result?.ok === false ? (
        <div>
          <p style={{ margin: '0 0 10px', color: colors.mutedText }}>
            Nearby departures unavailable
          </p>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      {result?.ok === true && stations.length === 0 ? (
        <p style={{ margin: 0, color: colors.mutedText }}>
          No nearby transit found
        </p>
      ) : null}

      {stations.map((station) => (
        <article
          data-testid="nearby-station"
          key={station.id}
          style={{ padding: '12px 0 0' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <h3
              style={{
                margin: 0,
                color: colors.ink,
                fontFamily: fonts.serif,
                fontSize: 19,
                fontWeight: 400,
              }}
            >
              {station.name}
            </h3>
            {Number.isFinite(station.distanceMeters) ? (
              <span
                style={{ color: colors.mutedText, fontSize: 12, whiteSpace: 'nowrap' }}
              >
                {(station.distanceMeters / 1609.344).toFixed(1)} mi away
              </span>
            ) : null}
          </div>
          {(station.services ?? []).map((service) => (
            <NearbyService key={service.key} service={service} />
          ))}
        </article>
      ))}
    </section>
  );
}
