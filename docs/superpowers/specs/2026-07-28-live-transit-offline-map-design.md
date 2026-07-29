# Live Transit and Offline Map Design

## Goal

Upgrade the existing SF Cottage React/Vite PWA so a guest can search for a destination, choose a matching place, and read a complete door-to-door public-transit itinerary without leaving the app. Preserve the existing Fog interface, curated property guidance, and static GitHub Pages deployment while making offline behavior and provider caching explicit and compliant.

## Scope

This change will:

- replace Photon destination lookup with HERE Geocoding and Search `/discover`;
- add HERE Public Transit Routing v8 itineraries that are fully readable in the PWA;
- retain 511 Stop Monitoring as the authoritative nearby departure source and add SF service alerts;
- add a packaged OSM-derived Ingleside neighborhood image for offline orientation;
- keep the existing Leaflet/OpenStreetMap map available online without prefetching or service-worker tile caching;
- add IndexedDB storage for user-saved state and provider responses only when storage is permitted;
- make live, cached, stale, unavailable, and misconfigured states visible and testable.

This change will not add a backend, migrate hosting away from GitHub Pages, package an interactive PMTiles archive, provide turn-by-turn navigation while the guest is moving, or replace the curated Explore content in the property JSON.

## Constraints and Decisions

### Static deployment

The browser calls HERE and 511 directly. `VITE_HERE_API_KEY` and `VITE_API_511_KEY` are build-time client credentials. The local `.env` remains ignored, `.env.example` documents variable names only, and credentials must never appear in logs, error copy, test fixtures, or service-worker caches.

The HERE key must be configured with trusted domains for the deployed site and the local development origins that need to call HERE. Direct browser use means the key is observable to a guest; trusted-domain restrictions are the intended control for this deployment model.

### Provider responsibilities

- HERE Discover supplies online address and POI candidates.
- HERE Public Transit Routing supplies door-to-door route options and all itinerary sections.
- 511 supplies nearby departure boards and current SF transit service alerts.
- Property JSON remains the permanent source for cottage instructions, curated places, fallback departure copy, destination suggestions, and back-to-cottage guidance.
- The browser geolocation API supplies a current origin only after guest consent. Denial or failure falls back to the cottage.

### Offline map

The online map remains Leaflet using standard OpenStreetMap tiles requested only for the guest's active viewport. The service worker must not prefetch or runtime-cache those tiles.

The offline fallback is a checked-in image generated from OpenStreetMap-derived vector data rather than downloaded standard tiles. It covers the useful walking area around the cottage, includes a cottage marker and important nearby transit anchors, and displays visible OpenStreetMap attribution. Its source, bounding box, creation date, and generation method are documented beside the asset so it can be regenerated.

## Architecture

### Provider adapters

`src/lib/hereSearch.js` accepts a query and location context and returns normalized candidates:

```js
{
  id,
  title,
  address,
  position: { lat, lng },
  resultType,
  categories,
  distanceMeters
}
```

It applies a San Francisco/Bay Area geographic constraint, limits the candidate count, aborts superseded requests, and distinguishes empty results, network failures, authorization failures, rate limits, and invalid responses.

`src/lib/hereTransit.js` accepts an origin, destination, and departure time and returns up to three normalized trip options. A trip has a stable UI-oriented shape:

```js
{
  id,
  departureTime,
  arrivalTime,
  durationSeconds,
  transferCount,
  walkingDurationSeconds,
  lines,
  sections,
  notices,
  plannedAt
}
```

Each section identifies its mode and contains the available departure/arrival places, timing, line or agency details, intermediate stops, platform information, and human-readable actions. Unknown HERE section or action types are retained as generic labeled steps rather than dropped or treated as fatal.

`src/lib/transit511.js` continues normalizing Stop Monitoring responses and adds service-alert normalization. The UI consumes stable alert fields such as ID, agency, affected lines, severity, header, description, active period, URL, and update timestamp. Alerts that can be matched to a displayed line are shown with that departure or itinerary; unmatched current SF alerts appear in a compact general-alert area.

### Storage and request coordination

`src/lib/responseStore.js` provides a small IndexedDB interface with separate stores for:

- provider responses and their cache metadata;
- guest-saved destinations and preferences.

A shared request coordinator deduplicates in-flight and recently completed calls. This prevents the top bar and Nearby screen from independently spending requests on the same 511 stop.

511 stop boards use a five-minute freshness window and remain as a labeled stale fallback for 30 minutes. SF alerts use a ten-minute freshness window and remain as a labeled stale fallback for 60 minutes. With the currently configured monitored stops, deduplication keeps one active guest below 511's default limit of 60 requests per hour.

HERE responses are persisted only when the response's HTTP caching headers explicitly permit storage. Stored expiration never exceeds the provider's declared lifetime. A response without storage permission is reused only in memory during the current page session and is not written to IndexedDB. An expired HERE response is deleted and never displayed. Provider caches are per browser/end user and are never used to build a shared data repository.

Every provider result carries retrieval and expiration metadata. The UI labels a result as live, cached, or stale and displays an update/planning time where timing matters. Expired data is never silently presented as current. Only 511 data inside the explicit stale-retention windows is displayed as a last-known fallback.

### Service worker

The generated service worker precaches the application shell, compiled assets, property data, property photographs, icons, and the offline neighborhood map. It does not store HERE responses, 511 responses, or OpenStreetMap tiles. Provider response storage belongs exclusively to the IndexedDB layer so permission, expiry, timestamps, and deletion behavior remain explicit.

Weather retains its existing runtime-cache behavior in this change. It remains independent from HERE/511 storage and cannot cause OSM tiles to enter the service-worker cache.

## Guest Experience

### Origin and map

The Nearby screen retains its current location consent card. On success it uses the guest's position; on denial, timeout, or error it explains that the cottage will be used instead. The map indicates the cottage, guest when available, nearby transit stops, and the selected destination.

When the browser is offline, or when online tiles fail to load, the component replaces the interactive map with the packaged neighborhood image. Offline copy makes clear that the map is for orientation and that live route planning requires a connection.

### Destination search

Submitting a destination query calls HERE Discover. The interface presents a short list with title and address so the guest explicitly chooses the intended result. Curated destination chips use the same search-and-select flow. The current query and any prior successful selection remain visible while a retry is in progress.

An empty search suggests adding a street or neighborhood. A failed search keeps the query, offers retry, and leaves curated destination and back-to-cottage guidance usable.

### Route options

Selecting a destination requests up to three routes departing now. Each collapsed card shows:

- departure and arrival time;
- total duration;
- number of transfers;
- total walking time;
- the major transit lines in order;
- whether the result is live, cached, or stale.

The first HERE-ranked result is visually marked as recommended but does not expand automatically. The guest chooses which trip to inspect.

### Full itinerary

Expanding a trip renders every route section in order. The itinerary includes, when provided:

- walking instructions to the first stop;
- stop, station, entrance, and platform information;
- wait and boarding instructions;
- transit line, destination/headsign, departure and arrival times;
- intermediate stop counts or names;
- transfer and alighting instructions;
- final walking instructions and arrival.

Durations and times are formatted for people rather than exposing raw API units. Consecutive pedestrian maneuvers are grouped under their walking section, but no travel leg is omitted. Each trip includes a secondary external navigation link as an escape hatch; the in-app itinerary remains complete on its own.

### Departures and alerts

Nearby stop rows continue to show 511 predictions with static property data as the non-live fallback. A timestamp and live/cached/stale label remove ambiguity.

Relevant 511 alerts appear near the affected line or trip. Alert summaries are collapsed by default, expose details on demand, and avoid overwhelming the route choices. Alert retrieval failure does not block departure boards or HERE routing.

## Error Handling

- Superseded search and route requests are aborted and cannot overwrite newer results.
- Network calls have bounded timeouts and retry only through deliberate guest action or the normal freshness refresh.
- HTTP 401/403 is treated as configuration/authorization failure; HTTP 429 is treated as temporary rate limiting.
- Development builds identify the missing variable and provider. Production shows calm guest-facing copy without credential details.
- Malformed provider responses resolve to normalized unavailable states rather than throwing through React rendering.
- Failure in one provider does not blank unrelated data from another provider.
- A HERE route failure leaves the destination selected so the guest can retry or choose another result.
- Geolocation failure uses the cottage; online map failure uses the offline image; 511 failure uses curated departure copy.
- Provider keys and full credential-bearing request URLs are excluded from application logging and persisted diagnostic data.

## Components

The existing `Nearby` screen coordinates the flow but delegates focused UI units:

- `DestinationSearch` renders the query, loading/error states, and explicit candidate selection.
- `TripOptions` renders the set of route choices.
- `TripCard` renders one summary and expansion state.
- `ItinerarySteps` renders normalized sections and actions.
- `TransitAlerts` renders line-specific and general SF alerts.
- `NeighborhoodMap` owns online Leaflet rendering, tile-failure detection, and offline-image fallback.

Provider response parsing, caching rules, and request deduplication remain outside React components. Components receive normalized data plus explicit status metadata.

## Testing and Completion Criteria

Add a lightweight Vite-compatible test setup for unit and React component tests. Provider tests use committed, redacted fixtures that represent successful responses and important edge cases.

Automated coverage includes:

- HERE Discover normalization, empty results, malformed data, authorization errors, rate limits, aborts, and geographic constraints;
- HERE route normalization for pedestrian, transit, transfer, intermediate-stop, notice, and unknown section/action cases;
- 511 departure and service-alert normalization;
- request deduplication and the five-/ten-minute 511 freshness windows;
- honoring HERE cache headers and refusing IndexedDB persistence when storage is not permitted;
- live, cached, stale, offline, and unavailable labels;
- destination selection and complete itinerary expansion;
- provider-isolated failures and retry behavior;
- geolocation, tile-failure, and offline-map fallbacks.

The feature is complete when:

1. A guest can search, select a destination, compare up to three routes, and read every itinerary leg inside the PWA.
2. Nearby departures use 511 and relevant SF alerts are visible without exceeding the documented default request rate in normal single-guest use.
3. The app shell, property data, and offline neighborhood map work with the network disabled.
4. Standard OpenStreetMap tiles and HERE/511 responses are absent from the service-worker caches.
5. HERE persistence follows response cache headers, and cached/stale data is visibly labeled.
6. Missing keys, denied location, offline mode, timeouts, malformed data, and provider failures degrade without a blank screen.
7. Lint, automated tests, and the production PWA build pass.

## Operational Follow-up

Before deployment, configure HERE trusted domains for the production GitHub Pages domain and required development origins. Confirm the deployed origin succeeds after HERE's configuration propagation delay. Monitor browser network requests during a smoke test to verify that 511 calls remain deduplicated and that no provider URL containing a credential is written to Cache Storage.

## References

- [HERE Public Transit API v8 introduction](https://docs.here.com/transit/docs/readme-public-transit-api-v8)
- [HERE Public Transit routes reference](https://docs.here.com/transit/reference/getroutes)
- [HERE Discover documentation](https://docs.here.com/geocoding-and-search/docs/discover)
- [HERE API key trusted domains](https://docs.here.com/identity-and-access-management/docs/plat-using-apikeys)
- [HERE Platform Terms: Location Services caching](https://legal.here.com/us-en/terms/here-platform/terms-november-2021)
- [511 Transit Data](https://511.org/open-data/transit)
- [511 Open Data FAQs](https://511.org/open-data/faqs)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
