# Location-Aware Nearby Transit Design

**Date:** 2026-07-30

**Status:** Approved

**Scope:** Nearby-page hierarchy, deterministic destination shortcuts, location-aware departure boards, restrained route warnings, and official BART identity

## Objective

Make the Nearby page reflect the guest's active device or simulated location instead of always presenting transit around the cottage. Keep destination shortcuts immediately below the search field, route shortcuts directly to canonical destinations without POI result lists, place route instructions below those shortcuts, and reduce service-warning prominence until a guest expands an itinerary.

The page must never present cottage stop names, walking times, departure times, or provider-status labels as if they describe another active location.

## Non-goals

- General POI discovery or browsing
- Restaurant, attraction, or business recommendations
- A packaged regional GTFS pipeline
- A 511-wide stop catalog downloaded in the browser
- Invented or property-curated departure estimates for an arbitrary location
- Redesigning the transit itinerary or walking-direction content

## Page hierarchy

Once location consent has been resolved, Nearby uses this order:

1. Page heading and active-location status
2. Destination search field and its address/locality results
3. Quick destination buttons
4. Back-to-cottage instructions when requested
5. Selected destination summary, travel-mode selector, and route content
6. Neighborhood map
7. Location-aware nearby departure boards
8. Existing first-time transit guidance

The quick destination row contains, in this exact order:

1. `⌂ Take me back to the cottage`
2. `Downtown / Union Square`
3. `SFO`
4. `Golden Gate Park`
5. `The Mission`
6. `Ocean Beach`

The row is rendered immediately after the destination-search component. No map, departure board, or route result appears between the search field and these buttons. Selecting a quick destination does not open or populate the candidate-result list.

## Canonical quick destinations

Quick destinations become structured property data rather than free-form strings. Each entry contains a stable ID, button label, destination title, canonical address/locality label, coordinates, and result type. The approved waypoints are:

| Button | Destination title/address | Latitude | Longitude | Type |
|---|---|---:|---:|---|
| Take me back to the cottage | The SF Cottage, 251 Harold Ave, San Francisco, CA | 37.72260 | -122.45470 | property |
| Downtown / Union Square | Union Square, San Francisco, CA | 37.78782 | -122.40748 | locality |
| SFO | San Francisco International Airport, CA | 37.62131 | -122.37896 | airport |
| Golden Gate Park | Golden Gate Park, San Francisco, CA | 37.77181 | -122.48088 | locality |
| The Mission | Mission District, San Francisco, CA | 37.75993 | -122.41808 | locality |
| Ocean Beach | Ocean Beach, San Francisco, CA | 37.75975 | -122.51016 | locality |

All six buttons call the same direct-selection interface used by an accepted search result. The back-to-cottage button additionally opens the existing curated instructions. The other five do not display a result picker.

## Search without POIs

Manual destination search moves from HERE Discover to HERE Geocoding and Search's geocode endpoint. Only address and geographic results are accepted: house numbers, streets, postal codes, localities, districts, and administrative areas. Provider results classified as places/businesses are excluded.

Existing saved POI records remain untouched in local storage for possible future support but are hidden from the Nearby search UI. Address/locality saved destinations remain usable. Empty or fully filtered responses render the normal no-results state.

## Active location and map semantics

`coords` remains the single route, station-search, distance, and map-center origin. Both browser geolocation and a URL stay-location override represent the guest's active location.

- The active-origin map marker is always labeled `You` to assistive technology and in its popup.
- A stay override may still show `Using location: 1620 Howard St, San Francisco` as status text outside the map.
- The cottage remains a separate marker labeled with the property name.
- The dynamic nearby stations replace `property.transit.nearbyStops` as map stop markers whenever a current station result exists.
- A location change synchronously clears prior station boards and markers before starting the next request.

The UI must not call a stay override an address marker or use its street label as the marker identity.

## Nearby station and departure data

HERE Public Transit is used for location discovery and departure boards. This is transit-specific station/departure functionality, not POI discovery.

### Request flow

1. Validate the active latitude and longitude.
2. Request up to ten stations within 1,200 meters using `GET https://transit.hereapi.com/v8/stations` with `in={lat},{lng};r=1200`, `maxPlaces=10`, and `return=transport`.
3. Normalize stations with a usable ID, name, finite location, and at least one transit mode or line.
4. Sort by geodesic distance from the active origin.
5. Request departure boards for the normalized station IDs using `GET https://transit.hereapi.com/v8/departures` with `ids={comma-separated station IDs}`, `timespan=60`, `maxPerTransport=2`, and `sort=transport`.
6. Join boards to stations and render the five nearest useful stations. A station remains useful without an imminent departure when its station response identifies service; it displays `No departures in the next hour` rather than disappearing.

Opposite-direction platforms are combined only when HERE supplies the same physical station/place ID or an explicit common parent. Names are never fuzzy-matched to combine stops.

### Presentation

Each station row shows:

- Official operator mark when known
- Station/stop name
- Geodesic distance such as `0.2 mi away`
- Served line and direction/headsign
- Up to two subsequent departure times per transport
- `Live` only when a departure contains HERE's finite `delay` field, including a zero-second delay
- `Scheduled` when only a scheduled value is available

The page does not derive walking minutes from straight-line distance and does not display `Curated schedule` for dynamic stations. Actual walking duration remains part of a selected HERE route.

### Loading, caching, refresh, and failure

- The station/departure hook is enabled only while Nearby has a finite active origin.
- Changing origin or leaving the screen aborts in-flight caller work and invalidates its publication version.
- Responses are cached in IndexedDB only when HERE response headers permit storage. Cache keys round latitude and longitude to three decimal places (roughly a 100-meter bucket) so tiny GPS changes do not create unbounded entries.
- An allowed fresh cache may render immediately. No disallowed or expired response is retained as a hidden fallback.
- Refresh no more often than every five minutes while enabled; provider cache expiry may lengthen that interval.
- Missing credentials, invalid coordinates, timeout, authorization, rate limiting, invalid responses, and network failure map to explicit result states.
- When no usable response is available, render `Nearby departures unavailable` with no cottage stop rows or fallback times.

511 remains the source for route-relevant service alerts. It is not used for location-wide stop discovery because its stops endpoint has no geographic filter and its default token budget is 60 requests per hour.

## Restrained route warnings

Warning matching remains conservative and route-specific. Global, unrelated, and substring-only service alerts remain excluded.

Collapsed transit cards do not render warning headers, severity copy, advisory labels, descriptions, sources, or links. Instead:

- Each affected line identity displays one small yellow circular `!`.
- Its accessible label is `Service advisory in full itinerary`.
- The indicator does not use an alert/live-region role and does not animate.
- Route-scoped 511 entities mark only their matching line.
- HERE incidents attached to a section mark that section's line.
- An unscoped trip notice does not add a collapsed line indicator.

Expanding `View full itinerary` renders the existing complete warning block above the itinerary steps. Collapsing removes that detailed block from the accessibility tree again.

The normalized warning model gains the minimum section/route association needed to place indicators. Warning text and matching rules otherwise remain unchanged.

## Official BART identity

The current text `ba` placeholder is replaced everywhere by the SVG identified by Wikimedia Commons as the Bay Area Rapid Transit logo. The original file is stored locally in the application so transit identity does not depend on Wikipedia or Wikimedia availability.

A reusable `BartLogo` component mirrors `MuniLogo` behavior:

- Decorative inside an already labeled transit identity
- Accessible name `BART` when used standalone
- Intrinsic aspect ratio preserved
- No remote image request

The component is used by transit route identities, nearby departure rows, generic `LineBadge` BART rendering, and the How to Ride BART section. Color-line pills and train icons remain alongside the operator logo. Source and public-domain text-logo status are recorded with the asset; the BART trademark is not presented as an app endorsement.

## Component boundaries

- `hereNearbyTransit.js`: build URLs, validate/normalize HERE station and board payloads, join boards, label timing provenance, and fetch/cache standardized results.
- `useNearbyTransit.js`: origin lifecycle, cancellation, refresh scheduling, and stale-publication protection.
- `NearbyDepartures.jsx`: loading, failure, empty, and five-station rendering.
- `QuickDestinations.jsx`: ordered direct-selection controls and no provider searching.
- `BartLogo.jsx`: reusable local operator artwork.
- `TripCard.jsx`, `JourneyTimeline.jsx`, and `TransitIdentity.jsx`: pass warning associations to affected line identities and keep detail in the expanded panel.
- `Nearby.jsx`: compose the approved order and pass active origin/stations to the map.
- `hereSearch.js`: use geocoding and filter to allowed non-POI result types.
- Property JSON: own canonical quick-destination objects; retain static nearby stops only as permanent cottage reference data for other legacy surfaces, not the Nearby dynamic board.

## Test strategy

### Provider adapter

- Exact station and departure request parameters
- Station validation, distance ordering, physical-ID grouping, and five-result limit
- Line/direction normalization and two-time limit
- Explicit real-time versus scheduled provenance
- Empty boards and stations without imminent departures
- Malformed payloads and every standardized provider failure
- Cache permission, expiry, coordinate bucketing, and credential-free keys

### Hook

- Lazy enablement
- Origin change aborts/invalidates old work and clears published stations immediately
- A late Howard/cottage result cannot overwrite a newer active location
- Refresh scheduling and disable cleanup
- Failure publishes no static fallback rows

### UI

- Search is followed immediately by the six quick buttons in approved order
- Each quick button directly selects its exact structured destination and exposes no candidate list
- Manual POI results and stored POIs are hidden
- Route content and back-home instructions render below the shortcuts
- Howard Street origin never renders Ocean Avenue, Plymouth Avenue, or Balboa Park cottage rows
- Nearby rows use distance, live/scheduled provenance, and no `Curated schedule` copy
- Device and stay-override map origins are labeled `You`; address remains status-only
- Dynamic station markers replace cottage stop markers
- Collapsed affected lines expose only the yellow advisory indicator
- Expanded itinerary exposes complete warning details once
- Unaffected lines receive no indicator
- Every former `ba` surface renders the local BART SVG with correct accessible semantics

### Full gate

Run the full Vitest suite, lint, production PWA build, diff checks, and a mobile browser smoke using the 1620 Howard Street stay override. The smoke verifies DOM order, direct Mission selection, current-location map semantics, non-cottage station names, collapsed/expanded warning behavior, official BART rendering, and zero unexpected console/page errors.

## Acceptance criteria

1. Quick destinations are directly below search and select canonical destinations without POI lists.
2. `The Mission` routes to `Mission District, San Francisco, CA`.
3. Manual search does not expose POIs.
4. A simulated 1620 Howard Street origin is represented as `You`, and station requests use its coordinates.
5. The board shows at most five distance-ordered nearby stations from HERE, never the cottage's static stop board for another origin.
6. Departure times are provider-backed and labeled `Live` or `Scheduled`; no dynamic row says `Curated schedule`.
7. Failure shows an unavailable state rather than incorrect fallback stops.
8. Collapsed route cards show only a small yellow `!` on affected lines; warning details appear only after expansion.
9. The official local BART SVG replaces every `ba` placeholder.
10. All focused and full automated checks pass, and the mobile smoke matches the approved hierarchy and behavior.

## Sources

- [HERE Public Transit Station Search](https://docs.here.com/transit/reference/getstations)
- [HERE Public Transit Next Departures](https://docs.here.com/transit/reference/getdepartures)
- [511 SF Bay Transit Data APIs](https://511.org/open-data/transit)
- [BART logo file and licensing description](https://en.wikipedia.org/wiki/File:Bart-logo.svg)
