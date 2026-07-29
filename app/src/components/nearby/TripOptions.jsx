import { useState } from 'react';
import { colors } from '../../theme.js';
import LiveStatus from './LiveStatus.jsx';
import TripCard from './TripCard.jsx';

const FAILURE_MESSAGES = {
  'missing-api-key': 'Transit directions are not configured yet.',
  unauthorized: 'Transit directions are unavailable right now.',
  'rate-limited': 'Transit directions are busy. Try again in a moment.',
  'no-route': 'No transit route was found for this destination.',
};

export default function TripOptions({
  result,
  alerts = [],
  externalUrlForTrip,
}) {
  const [expandedTripId, setExpandedTripId] = useState(null);

  if (!result) return null;
  if (!result.ok) {
    return (
      <div role="status" style={{ color: colors.mutedText, fontSize: 13 }}>
        {FAILURE_MESSAGES[result.reason] ||
          'Transit directions need a connection. Your other nearby information is still available.'}
      </div>
    );
  }

  const trips = Array.isArray(result.trips) ? result.trips : [];
  if (trips.length === 0) {
    return (
      <div role="status" style={{ color: colors.mutedText, fontSize: 13 }}>
        No transit options are available for this destination.
      </div>
    );
  }

  return (
    <section aria-label="Transit options">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 7,
        }}
      >
        <div
          style={{
            color: colors.muted,
            fontSize: 11,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
          }}
        >
          Transit options
        </div>
        <LiveStatus source={result.source} timestamp={result.fetchedAt} />
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {trips.map((trip, index) => {
          const tripKey = trip.id ?? `rank-${index}`;
          const expanded = expandedTripId === tripKey;
          return (
            <TripCard
              key={tripKey}
              trip={trip}
              index={index}
              expanded={expanded}
              onToggle={() =>
                setExpandedTripId((current) =>
                  current === tripKey ? null : tripKey,
                )
              }
              alerts={alerts}
              externalUrl={externalUrlForTrip?.(trip)}
              instanceId={tripKey}
            />
          );
        })}
      </div>
    </section>
  );
}
