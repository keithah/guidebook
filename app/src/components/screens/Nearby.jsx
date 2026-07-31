import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { colors, fonts, screenPad, card, backLink } from '../../theme.js';
import MuniLogo from '../MuniLogo.jsx';
import LineBadge from '../LineBadge.jsx';
import NeighborhoodMap from '../nearby/NeighborhoodMap.jsx';
import DestinationSearch from '../nearby/DestinationSearch.jsx';
import NearbyDepartures from '../nearby/NearbyDepartures.jsx';
import QuickDestinations from '../nearby/QuickDestinations.jsx';
import TripOptions from '../nearby/TripOptions.jsx';
import TripModeSelector from '../nearby/TripModeSelector.jsx';
import WalkingJourney from '../nearby/WalkingJourney.jsx';
import RideshareOptions from '../nearby/RideshareOptions.jsx';
import { googleMapsDirectionsUrl } from '../../lib/mapsDirections.js';
import { isFinitePosition } from '../../lib/providerFetch.js';
import { isAddressDestination } from '../../lib/hereSearch.js';
import { useHereTripPlanner } from '../../hooks/useHereTripPlanner.js';
import { useNearbyTransit } from '../../hooks/useNearbyTransit.js';
import { useSavedDestinations } from '../../hooks/useSavedDestinations.js';
import { useTransitAlerts } from '../../hooks/useTransitAlerts.js';
import { useWalkingRoute } from '../../hooks/useWalkingRoute.js';

const BACK_HOME_ICON = {
  walk: { glyph: '○', style: { background: colors.sage, color: colors.teal } },
  ride: { glyph: '→', style: { background: colors.sage, color: colors.teal } },
};

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
  const showMe =
    coords?.source === 'device' || coords?.source === 'stay-override';
  const locationLabel =
    coords?.source === 'stay-override' ? coords.label : null;
  const planner = useHereTripPlanner({ origin });
  const nearby = useNearbyTransit({
    origin,
    enabled: located && isFinitePosition(origin),
  });
  const mapStops = nearby.result?.ok
    ? nearby.result.stations.map((station) => {
        const services = Array.isArray(station.services)
          ? station.services
          : [];
        const firstService = services[0];
        const agency = [firstService?.agency?.id, firstService?.agency?.name]
          .filter(Boolean)
          .join(' ');
        return {
          name: station.name,
          sub: services
            .map(
              (service) =>
                service.transport?.shortName || service.transport?.name,
            )
            .filter(Boolean)
            .join(' · '),
          line: /BART|BAY AREA RAPID TRANSIT/i.test(agency)
            ? 'BART'
            : firstService?.transport?.shortName || 'TRANSIT',
          lat: station.position.lat,
          lng: station.position.lng,
        };
      })
    : [];
  const saved = useSavedDestinations();
  const [modeSelection, setModeSelection] = useState({
    journeyKey: '',
    mode: 'transit',
  });
  const selectedPosition = planner.selectedDestination?.position ?? null;
  const journeyKey = selectedPosition
    ? `${origin.lat},${origin.lng}:${selectedPosition.lat},${selectedPosition.lng}`
    : '';
  if (modeSelection.journeyKey !== journeyKey) {
    setModeSelection({ journeyKey, mode: 'transit' });
  }
  const activeMode =
    modeSelection.journeyKey === journeyKey
      ? modeSelection.mode
      : 'transit';
  const selectMode = (mode) => setModeSelection({ journeyKey, mode });
  const walking = useWalkingRoute({
    origin,
    destination: selectedPosition,
    enabled: activeMode === 'walk',
  });
  const alertsEnabled = Boolean(
    activeMode === 'transit' &&
      planner.routeResult?.ok &&
      planner.routeResult.trips?.length,
  );
  const { alerts } = useTransitAlerts('SF', { enabled: alertsEnabled });
  const canLinkToExternalDirections =
    isFinitePosition(origin) && isFinitePosition(selectedPosition);
  const transitExternalUrl = canLinkToExternalDirections
    ? googleMapsDirectionsUrl(origin, selectedPosition, 'transit')
    : undefined;
  const walkingExternalUrl = canLinkToExternalDirections
    ? googleMapsDirectionsUrl(origin, selectedPosition, 'walking')
    : undefined;
  const tripKey = [
    planner.selectedDestination?.id,
    planner.routeResult?.trips?.[0]?.plannedAt,
    planner.routeResult?.fetchedAt,
    planner.routeResult?.reason,
  ]
    .filter(Boolean)
    .join(':');

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
          <DestinationSearch
            query={planner.query}
            onQueryChange={planner.setQuery}
            candidates={planner.candidates}
            selectedDestination={planner.selectedDestination}
            searchStatus={planner.searchStatus}
            savedDestinations={saved.savedDestinations.filter(
              isAddressDestination,
            )}
            isSaved={saved.isSaved}
            onToggleSaved={saved.toggleSaved}
            onSubmit={(query) => {
              setBackOpen(false);
              void planner.search(query);
            }}
            onSelect={planner.selectDestination}
          />

          <QuickDestinations
            destinations={property.transit.quickDestinations}
            onSelect={(destination) => {
              setBackOpen(destination.resultType === 'property');
              void planner.selectDirectDestination(destination);
            }}
          />

          {backOpen && (
            <div
              style={{
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

          {planner.selectedDestination && (
            <section
              aria-label="Selected destination"
              style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {planner.selectedDestination.title}
                </div>
                <div
                  style={{ marginTop: 2, color: colors.muted, fontSize: 12 }}
                >
                  {planner.selectedDestination.address}
                </div>
              </div>
              <button
                type="button"
                aria-label="Clear destination"
                onClick={() => {
                  setBackOpen(false);
                  planner.clearDestination();
                }}
                style={{
                  flexShrink: 0,
                  border: 0,
                  padding: 8,
                  background: 'transparent',
                  color: colors.teal,
                  cursor: 'pointer',
                  font: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Clear
              </button>
            </section>
          )}

          {selectedPosition && (
            <TripModeSelector value={activeMode} onChange={selectMode} />
          )}

          {selectedPosition && activeMode === 'transit' && (
            <div>
              <TripOptions
                key={tripKey}
                result={planner.routeResult}
                alerts={alerts}
                externalUrlForTrip={() => transitExternalUrl}
              />
              {planner.routeResult && !planner.routeResult.ok && (
                <button
                  type="button"
                  className="journey-text-button"
                  onClick={planner.retryRoutes}
                  style={{
                    minHeight: 44,
                    marginTop: 2,
                    border: 0,
                    padding: '8px 0',
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
          )}

          {selectedPosition && activeMode === 'walk' && (
            <WalkingJourney
              result={walking.routeResult}
              onRetry={walking.retryWalking}
              externalUrl={walkingExternalUrl}
            />
          )}

          {selectedPosition && activeMode === 'rideshare' && (
            <RideshareOptions rides={property.transit.rides} />
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
              center={origin}
              cottage={cottage}
              stops={mapStops}
              showMe={showMe}
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

          <NearbyDepartures result={nearby.result} onRetry={nearby.refresh} />

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
