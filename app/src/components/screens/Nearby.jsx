import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { colors, fonts, screenPad, card, backLink } from '../../theme.js';
import MuniLogo from '../MuniLogo.jsx';
import LineBadge from '../LineBadge.jsx';
import NeighborhoodMap from '../nearby/NeighborhoodMap.jsx';
import DestinationSearch from '../nearby/DestinationSearch.jsx';
import LiveStatus from '../nearby/LiveStatus.jsx';
import TransitAlerts from '../nearby/TransitAlerts.jsx';
import TripOptions from '../nearby/TripOptions.jsx';
import { distanceMiles, stopHeadsToward } from '../../lib/geocode.js';
import { useHereTripPlanner } from '../../hooks/useHereTripPlanner.js';
import { useLiveDepartures } from '../../hooks/useLiveDepartures.js';
import { useSavedDestinations } from '../../hooks/useSavedDestinations.js';
import { useTransitAlerts } from '../../hooks/useTransitAlerts.js';

const BACK_HOME_ICON = {
  walk: { glyph: '○', style: { background: colors.sage, color: colors.teal } },
  ride: { glyph: '→', style: { background: colors.sage, color: colors.teal } },
};

/**
 * Build a Google Maps transit directions URL between two positions.
 * @param {{lat: number, lng: number}} origin - The starting geographic position.
 * @param {{lat: number, lng: number}} destination - The destination geographic position.
 * @return {string} A URL for transit directions between the positions.
 */
function mapsUrl(origin, destination) {
  const formatPosition = (position) => `${position.lat},${position.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(formatPosition(origin))}&destination=${encodeURIComponent(formatPosition(destination))}&travelmode=transit`;
}

/**
 * Render the nearby transit, trip-planning, and rideshare interface.
 * @returns {JSX.Element} The nearby transportation page.
 */
export default function Nearby() {
  const {
    property,
    backToAround,
    goSub,
    located,
    coords,
    locating,
    locateError,
    allowLocation,
    useCottageAsLocation,
    backOpen,
    setBackOpen,
  } = useApp();

  const cottage = { lat: property.address.lat, lng: property.address.lng };
  const origin = coords ?? cottage;
  const showMe = Boolean(
    coords &&
      (coords.source === 'stay-override' ||
        coords.lat !== cottage.lat ||
        coords.lng !== cottage.lng),
  );
  const locationLabel =
    coords?.source === 'stay-override' ? coords.label : null;
  const planner = useHereTripPlanner({ origin });
  const saved = useSavedDestinations();
  const { times: liveTimes, meta: departureMeta } = useLiveDepartures(
    property.transit.nearbyStops,
  );
  const {
    alerts,
    status: alertStatus,
    updatedAt: alertsUpdatedAt,
    error: alertError,
  } = useTransitAlerts('SF');
  const [expandedAlertLineIds, setExpandedAlertLineIds] = useState([]);
  const selectedPosition = planner.selectedDestination?.position ?? null;
  const nearBase =
    showMe && distanceMiles(coords, cottage) < 60
      ? { point: coords, label: 'you' }
      : { point: cottage, label: 'the cottage' };

  const stopRows = property.transit.nearbyStops.map((stop, index) => ({
    stop,
    index,
    toward: selectedPosition ? stopHeadsToward(stop, selectedPosition) : null,
  }));
  const orderedStops = selectedPosition
    ? [...stopRows].sort(
        (a, b) => Number(Boolean(b.toward)) - Number(Boolean(a.toward)),
      )
    : stopRows;
  const cottageDestination = {
    id: `property:${property.id}`,
    title: property.name,
    address: `${property.address.street}, ${property.address.city}`,
    position: cottage,
    resultType: 'property',
    categories: [],
    distanceMeters: 0,
  };
  const tripKey = [
    planner.selectedDestination?.id,
    planner.routeResult?.trips?.[0]?.plannedAt,
    planner.routeResult?.fetchedAt,
    planner.routeResult?.reason,
  ]
    .filter(Boolean)
    .join(':');

  useEffect(() => {
    setExpandedAlertLineIds([]);
  }, [tripKey]);

  const chooseCottage = () => {
    planner.setQuery(property.address.street);
    setBackOpen(true);
    void planner.selectDestination(cottageDestination);
  };

  return (
    <div style={screenPad}>
      <button
        type="button"
        onClick={backToAround}
        style={{
          ...backLink,
          border: 0,
          padding: 0,
          background: 'transparent',
        }}
      >
        ← Around Here
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <MuniLogo height={17} />
        <span style={{ fontSize: 15, color: colors.muted }}>metro</span>
        <span style={{ fontSize: 13, color: colors.faint }}>
          · and everything else nearby
        </span>
      </div>
      <div style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 1.1 }}>
        Getting somewhere
      </div>

      {!located && (
        <div
          style={{
            ...card,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 18,
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              aria-hidden="true"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: '50%',
                background: colors.sage,
                color: colors.teal,
                fontSize: 18,
              }}
            >
              ◎
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                Use your location?
              </div>
              <div
                style={{
                  marginTop: 3,
                  color: colors.mutedText,
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                So {property.host.name} can show the stops nearest you and the
                way back to the cottage. Nothing leaves your phone.
              </div>
            </div>
          </div>
          {locateError && (
            <div style={{ color: '#b3261e', fontSize: 12 }}>
              {locateError} Showing the cottage instead.
            </div>
          )}
          <button
            type="button"
            onClick={allowLocation}
            style={{
              border: 0,
              borderRadius: 999,
              padding: 13,
              background: colors.teal,
              color: '#F2F7F5',
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            {locating ? 'Locating…' : 'Allow location'}
          </button>
          <button
            type="button"
            onClick={useCottageAsLocation}
            style={{
              border: 0,
              padding: 0,
              background: 'transparent',
              color: colors.muted,
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 13,
            }}
          >
            Not now — use the cottage as my location
          </button>
        </div>
      )}

      {located && coords && (
        <>
          {locationLabel && (
            <div role="status" style={{ color: colors.muted, fontSize: 12 }}>
              Using location: {locationLabel}
            </div>
          )}
          <div
            style={{
              height: 220,
              overflow: 'hidden',
              border: `1px solid ${colors.border}`,
              borderRadius: 18,
            }}
          >
            <NeighborhoodMap
              center={coords}
              cottage={cottage}
              stops={property.transit.nearbyStops}
              showMe={showMe}
              locationLabel={locationLabel}
              dest={
                planner.selectedDestination
                  ? {
                      ...planner.selectedDestination.position,
                      name: planner.selectedDestination.title,
                    }
                  : null
              }
            />
          </div>

          <DestinationSearch
            query={planner.query}
            onQueryChange={planner.setQuery}
            candidates={planner.candidates}
            selectedDestination={planner.selectedDestination}
            searchStatus={planner.searchStatus}
            savedDestinations={saved.savedDestinations}
            isSaved={saved.isSaved}
            onToggleSaved={saved.toggleSaved}
            onSubmit={(query) => {
              setBackOpen(false);
              void planner.search(query);
            }}
            onSelect={planner.selectDestination}
            onClear={() => {
              setBackOpen(false);
              planner.clearDestination();
            }}
          />

          {selectedPosition && (
            <div style={{ marginTop: -8, color: colors.muted, fontSize: 12 }}>
              {distanceMiles(nearBase.point, selectedPosition).toFixed(1)} mi
              from {nearBase.label}
            </div>
          )}

          <div>
            <TripOptions
              key={tripKey}
              result={planner.routeResult}
              alerts={alerts}
              externalUrlForTrip={() =>
                selectedPosition ? mapsUrl(origin, selectedPosition) : undefined
              }
              onExpandedLineIdsChange={setExpandedAlertLineIds}
            />
            {planner.routeResult && !planner.routeResult.ok && (
              <button
                type="button"
                onClick={planner.retryRoutes}
                style={{
                  marginTop: 7,
                  border: 0,
                  padding: 0,
                  background: 'transparent',
                  color: colors.teal,
                  cursor: 'pointer',
                  font: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Retry transit directions
              </button>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                type="button"
                onClick={chooseCottage}
                style={{
                  border: 0,
                  borderRadius: 999,
                  padding: '7px 13px',
                  background: colors.teal,
                  color: '#F2F7F5',
                  cursor: 'pointer',
                  font: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                ⌂ Take me back to the cottage
              </button>
              {property.transit.destSuggestions.map((destination) => (
                <button
                  key={destination}
                  type="button"
                  onClick={() => {
                    setBackOpen(false);
                    planner.setQuery(destination);
                    void planner.search(destination);
                  }}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 999,
                    padding: '7px 13px',
                    background: colors.white,
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {destination}
                </button>
              ))}
            </div>

            {backOpen && (
              <div
                style={{
                  marginTop: 10,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 18,
                  padding: '4px 16px',
                  background: colors.white,
                }}
              >
                <button
                  type="button"
                  onClick={() => setBackOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    border: 0,
                    borderBottom: `1px solid ${colors.borderSoft}`,
                    padding: '10px 0',
                    background: 'transparent',
                    color: colors.teal,
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: 11,
                    letterSpacing: '.16em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span>Suggestions · back to {property.address.street}</span>
                  <span aria-hidden="true">▴</span>
                </button>
                {property.transit.backHome.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      borderBottom: `1px solid ${colors.borderSoft}`,
                      padding: '13px 0',
                    }}
                  >
                    {item.line ? (
                      <LineBadge
                        line={item.line}
                        size={22}
                        fontSize={item.line === 'BART' ? '9px' : '12px'}
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 22,
                          height: 22,
                          flexShrink: 0,
                          borderRadius: '50%',
                          fontSize: 12,
                          ...BACK_HOME_ICON[item.icon]?.style,
                        }}
                      >
                        {BACK_HOME_ICON[item.icon]?.glyph}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {item.label}
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          color: colors.mutedText,
                          fontSize: 13,
                          lineHeight: 1.55,
                        }}
                      >
                        {item.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <TransitAlerts
            alerts={alerts}
            status={alertStatus}
            updatedAt={alertsUpdatedAt}
            error={alertError}
            excludeLineIds={expandedAlertLineIds}
          />

          <section aria-label="Nearby departures">
            <div
              style={{
                marginBottom: 2,
                color: colors.muted,
                fontSize: 11,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
              }}
            >
              {planner.selectedDestination
                ? `Stops toward ${planner.selectedDestination.title}`
                : 'Nearest stops right now'}
            </div>
            {orderedStops.map(({ stop, index, toward }) => {
              const meta = departureMeta[index];
              const hasLivePrediction = liveTimes[index] != null;
              const showStatus = [
                'live',
                'cached',
                'stale',
                'unavailable',
              ].includes(meta?.status);
              return (
                <div
                  key={`${stop.name}-${stop.sub}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    borderBottom: `1px solid ${colors.border}`,
                    padding: '11px 0',
                    opacity: selectedPosition && !toward ? 0.45 : 1,
                  }}
                >
                  <LineBadge
                    line={stop.line}
                    size={stop.line === 'BART' || stop.line === 'BUS' ? 26 : 28}
                    fontSize={
                      stop.line === 'BART'
                        ? '10px'
                        : stop.line === 'BUS'
                          ? '11px'
                          : undefined
                    }
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {stop.name}
                    </div>
                    <div
                      style={{
                        marginTop: 1,
                        color: colors.muted,
                        fontSize: 12,
                      }}
                    >
                      {stop.sub} · {stop.walkMin} min walk
                    </div>
                    {toward && (
                      <div
                        style={{
                          marginTop: 2,
                          color: colors.teal,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {toward.label === 'right there'
                          ? '→ closest stop to it'
                          : `→ heads toward ${toward.label}`}
                      </div>
                    )}
                    {selectedPosition && !toward && (
                      <div
                        style={{
                          marginTop: 2,
                          color: colors.muted,
                          fontSize: 11,
                        }}
                      >
                        heads the other way
                      </div>
                    )}
                  </div>
                  {showStatus && (
                    <LiveStatus
                      source={meta.status}
                      timestamp={meta.updatedAt}
                    />
                  )}
                  <div
                    style={{
                      color: colors.teal,
                      fontFamily: fonts.serif,
                      fontSize: 20,
                      whiteSpace: 'nowrap',
                      textAlign: 'right',
                    }}
                  >
                    <div>{liveTimes[index] ?? stop.times}</div>
                    {!hasLivePrediction && (
                      <div
                        style={{
                          marginTop: 2,
                          color: colors.mutedText,
                          fontFamily: fonts.sans,
                          fontSize: 10,
                        }}
                      >
                        Curated schedule
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 7, color: colors.faint, fontSize: 11 }}>
              Data provided by 511.org
            </div>
          </section>

          <section aria-label="Rideshare options">
            <div
              style={{
                marginBottom: 7,
                color: colors.muted,
                fontSize: 11,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
              }}
            >
              Or get a ride
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {property.transit.rides.map((ride) => (
                <div
                  key={ride.name}
                  style={{
                    flex: 1,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 16,
                    padding: '13px 12px',
                    background: colors.white,
                  }}
                >
                  <div
                    style={{ color: ride.color, fontSize: 15, fontWeight: 600 }}
                  >
                    {ride.name}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      color: colors.muted,
                      fontSize: 11,
                      lineHeight: 1.4,
                    }}
                  >
                    {ride.note}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 8,
                color: colors.muted,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              No account yet?{' '}
              <a href={property.transit.rides[0].referralUrl}>
                Grab a sign-up link
              </a>{' '}
              — first ride is usually discounted.
            </div>
          </section>

          <button
            type="button"
            onClick={goSub('ride')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: 0,
              borderRadius: 16,
              padding: '14px 16px',
              background: colors.sage,
              color: colors.ink,
              cursor: 'pointer',
              font: 'inherit',
              textAlign: 'left',
            }}
          >
            <span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>
                First time on Muni or BART?
              </span>
              <span
                style={{
                  display: 'block',
                  marginTop: 2,
                  color: colors.tealText,
                  fontSize: 13,
                }}
              >
                How to ride, and how to pay
              </span>
            </span>
            <span aria-hidden="true" style={{ color: colors.teal }}>
              →
            </span>
          </button>
        </>
      )}
    </div>
  );
}
