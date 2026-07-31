# Journey Modes and Route-Relevant Alerts Design

**Status:** Approved design

## Purpose

Improve destination directions in the SF Cottage PWA so guests can compare transit, walking, and rideshare choices without being distracted by unrelated citywide alerts. Preserve the current HERE transit itineraries while making operator, vehicle, and transfer information immediately legible.

## Goals

- Replace the standalone “Current SF service alerts” area with warnings attached only to affected transit options.
- Keep an affected route visible and place a prominent warning on its card; do not silently remove it.
- Add a Transit / Walk / Rideshare mode selector after a destination is chosen.
- Provide complete walking directions inside the app and a Google Maps fallback for both Transit and Walk.
- Render transit summaries as compact journey timelines.
- Distinguish Muni rail, Muni bus, and BART consistently using operator, vehicle, route name, and line color.
- Show approximate Uber, Lyft, and Waymo pickup waits from property data while leaving a clean seam for future live APIs.

## Non-goals

- Do not integrate, alter, or expand online or curated POI behavior.
- Do not add live Uber, Lyft, or Waymo APIs in this release.
- Do not add driving, bicycling, scooter, or taxi route calculation.
- Do not hide a transit option because it has an alert.
- Do not display general, unmatched, or alert-provider status messages.
- Do not replace HERE transit routing or 511 nearby departure boards.

## Guest Experience

### Mode selection

Once a guest selects a destination, show three labeled mode controls in this order:

1. **Transit** with a bus icon;
2. **Walk** with a pedestrian icon;
3. **Rideshare** with a car/taxi icon.

Transit is selected by default for every new origin/destination pair. Switching modes preserves already loaded results for that unchanged pair. A changed origin or destination resets the selected mode to Transit, invalidates old results, and cancels stale requests.

The controls use real accessible SVG/image assets in production rather than emoji. Their visible labels remain present, and the selected state is exposed semantically.

### Transit

Keep the current HERE Public Transit options and full expandable itineraries. Replace the current route-chip summary with the approved **Journey timeline** treatment:

- ordered legs run from left to right;
- each transit leg combines operator identity, vehicle icon, line identifier, and leg duration;
- walking and transfer legs remain visible between vehicles;
- the summary includes departure, arrival, total duration, and transfer count;
- two to four legs should fit the card when practical;
- longer journeys keep every leg in an accessible ordered list and allow horizontal scrolling rather than truncation;
- the expanded vertical itinerary continues to show every action, stop, platform, and route-specific notice.

Each card retains its secondary “Open in Google Maps” action.

### Walk

The first time Walk is opened for an origin/destination pair, request a pedestrian route from HERE Routing v8. Render:

- total walking time and distance;
- departure and arrival context;
- every normalized pedestrian action in order;
- route notices when they apply;
- an “Open walking directions in Google Maps” action.

The in-app route is the primary experience. The external link is a fallback, not a substitute for omitted instructions.

### Rideshare

Render the existing Uber, Lyft, and Waymo choices as compact pickup cards. Each card includes:

- provider identity;
- a clearly labeled approximate pickup wait from property JSON;
- a note that the estimate is approximate, not live;
- an app-launch or provider link configured for that provider.

No rideshare network request is made in this release. The data adapter must accept the same normalized result shape that future live provider adapters can return.

## Transit Identity and Icons

Classify a leg from normalized agency and transport metadata, with route-name heuristics used only as a fallback.

### Muni rail

When the agency is SFMTA/Muni and the transport mode is rail-like, including light rail, metro, subway, tram, or train:

- show the Muni mark;
- show a train/light-rail vehicle icon;
- show the route short name, such as J, K, L, M, N, or T;
- retain the provider line color when it is a valid display color.

### Muni bus

When the agency is SFMTA/Muni and the transport mode is bus-like, including bus or bus rapid transit:

- show the Muni mark;
- show a bus vehicle icon;
- show the complete short route name, including suffixes such as 38R or owl/express variants.

A digit-leading Muni short name is a bus fallback only when HERE omits a usable transport mode. An explicit rail mode always wins over the route-name fallback.

### BART

When the agency identifies Bay Area Rapid Transit:

- show the BART mark;
- show a train icon;
- show the complete color-line name, such as Blue, Yellow, Red, Green, or Orange;
- use the provider line color after validation, with named local fallbacks when it is absent.

Color is never the only identifier. The visible line name and accessible label always include “BART” and “train.”

### Other operators

Unknown or regional operators receive a generic transit icon plus the provider agency and route names. Missing or malformed metadata must not drop the leg from the timeline.

## Architecture

### Shared journey context

The selected origin and destination form a journey context consumed by three independent mode panels:

- `TripModeSelector` owns the active mode;
- the existing transit planner continues to own HERE Public Transit search state;
- a pedestrian planner owns lazy HERE Routing state;
- a rideshare adapter normalizes property estimates;
- `JourneyTimeline` renders ordered summary legs;
- `TransitIdentity` derives operator, vehicle, line label, accessible text, and safe display color.

Transit and walking use separate provider adapters because their endpoints and response schemas differ. They share request cancellation, failure-reason, cache, and display-formatting conventions rather than pretending their raw responses are identical.

### Pedestrian routing

Use HERE Routing API v8 with `transportMode=pedestrian` and request actions plus user-facing instructions. Normalize provider sections into a stable walking journey containing summary fields, ordered actions, notices, and timestamps.

Fetch lazily when Walk is opened. Cache only when provider response headers permit it, using the existing IndexedDB response-store policy. The cache key includes origin, destination, and relevant routing options but never credentials.

### Future rideshare adapters

Define a small normalized rideshare option shape with provider ID, name, approximate/live status, pickup wait label, brand color, and launch URL. The property adapter returns approximate entries now. A future provider adapter may replace those entries with live values without changing the selector or card layout.

## Route-Relevant Service Warnings

### Remove the global alert surface

Delete the standalone `TransitAlerts` rendering from the Nearby screen, including “Current SF service alerts,” alert loading state, stale/cache status, and alert errors. No current SF alert appears merely because it exists.

Fetch 511 service alerts only while Transit is the active mode and successful transit options exist for the selected journey. Stop or cancel alert work when the guest leaves Transit or when the result is cleared or superseded; the approved cache may satisfy a later return to Transit.

### Preserve matchable alert data

The 511 normalizer retains:

- alert ID and translated text;
- agency;
- severity/effect;
- every active period;
- informed-entity route ID, stop ID, and direction ID when present;
- URL and update timestamp.

It must not flatten away entity relationships needed for matching.

### Match alerts to individual trips

Derive comparable service identities from each transit leg: agency, route short name, departure/arrival time, direction when available, and departure/intermediate/arrival stop IDs and codes.

An alert is eligible for a route card only when one of its informed entities matches a leg:

1. agency matches when both sides provide an agency;
2. route ID matches after conservative normalization;
3. an active period overlaps the leg’s scheduled travel window;
4. when both sides expose comparable direction IDs, direction matches;
5. when an informed entity names a stop and the leg exposes comparable stop identifiers, at least one stop matches.

Missing optional direction or stop data does not invalidate an otherwise strong agency/route/time match. A route mismatch always excludes the alert. Alerts with no matchable route identity remain invisible.

Warnings appear on the collapsed affected route card and again in context when it is expanded. All affected options remain selectable. Severity changes visual prominence and copy but never silently hides a route.

HERE incidents and notices already attached to a returned route remain route-specific. Collapse duplicates across HERE and 511 using stable IDs when available and normalized warning text otherwise.

## External Links

- Transit builds a Google Maps URL with the current origin, selected destination, and transit travel mode.
- Walk builds the equivalent URL with walking travel mode.
- Rideshare uses provider launch URLs from normalized configuration. Do not commit placeholder `#` actions as working links; unavailable launch actions render as unavailable rather than navigating nowhere.

Every external action opens deliberately, uses safe link attributes, and has a provider/mode-specific accessible label.

## Failure and Offline Behavior

Each mode fails independently:

- a transit failure leaves Walk and Rideshare available;
- a walking failure keeps the destination selected, explains the failure, offers retry, and retains the Google Maps walking link;
- a 511 alert failure is silent and never blocks transit results;
- static rideshare estimates remain readable offline, while launch actions explain that a connection or installed app may be required;
- a missing HERE credential produces a mode-specific configuration message without blanking other modes;
- stale or aborted transit/walking responses cannot overwrite a newer origin/destination pair.

## Accessibility and Mobile Layout

- Use buttons with text labels for the mode selector and expose the selected state.
- Render timeline legs and itinerary actions as semantic ordered lists.
- Give combined operator/vehicle/route marks one concise accessible name instead of repeating image alt text.
- Do not rely on brand or line color alone.
- Preserve visible keyboard focus, adequate touch targets, and the existing narrow mobile layout.
- A horizontally scrollable long timeline must remain keyboard reachable and must not hide leg text from assistive technology.
- Reduced-motion preferences disable nonessential timeline or selector animation.

## Testing

### Unit tests

- classify Muni rail, Muni bus, BART color lines, regional transit, and malformed metadata;
- validate provider colors and named BART fallbacks;
- build and normalize HERE pedestrian requests, summaries, actions, notices, failures, caching, timeout, and cancellation;
- preserve 511 informed-entity structure;
- match alerts by agency, route, active time, direction, and stop;
- exclude unrelated, expired, route-less, and mismatched alerts;
- deduplicate equivalent HERE and 511 warnings;
- normalize static rideshare estimates and unavailable launch links.

### Component and integration tests

- select Transit, Walk, and Rideshare and preserve per-context loaded state;
- reset/cancel when origin or destination changes;
- render the complete timeline and expanded details without omitting legs;
- render Muni/BART operator and vehicle identities with accessible labels;
- show a warning on each affected card while leaving it selectable;
- prove the standalone SF alert section and alert-service statuses never render;
- render complete walking steps and both Google Maps link modes;
- render approximate Uber, Lyft, and Waymo waits;
- keep unaffected modes usable when one provider fails.

### Browser verification

On a mobile viewport, select a destination and verify:

1. Transit is the default mode and each option uses the journey timeline;
2. Muni rail, Muni bus, and BART legs use the correct operator and vehicle treatments;
3. an injected unrelated SF alert is absent;
4. an injected matching alert warns only the affected route;
5. Walk loads complete in-app actions and its Google Maps link uses walking mode;
6. Transit retains its Google Maps link using transit mode;
7. Rideshare shows approximate waits and working configured actions;
8. mode switching, keyboard operation, and long-timeline scrolling work at the supported narrow width.

## Acceptance Criteria

1. No standalone “Current SF service alerts” content or provider-status message appears anywhere in destination planning.
2. Only alerts matched to an individual transit option are displayed, and affected options remain visible with prominent warnings.
3. A destination offers Transit, Walk, and Rideshare in that order, with Transit selected by default.
4. Walking directions are complete and readable inside the app.
5. Transit and Walk each include a correctly parameterized Google Maps fallback.
6. Muni rail uses Muni plus a train icon; Muni bus uses Muni plus a bus icon; BART color lines use BART plus a train icon and a visible line name.
7. Journey summaries follow the approved timeline treatment and omit no travel leg.
8. Uber, Lyft, and Waymo show clearly approximate property-based pickup waits and configured launch actions, with no live provider integration.
9. Existing POI behavior and data remain unchanged.
10. Existing nearby 511 departure boards, offline map behavior, location override behavior, and full transit itinerary expansion continue to work.

## References

- HERE Routing API v8 transport modes: https://docs.here.com/routing/docs/routing-v8-transport-modes-overview
- HERE Routing API v8 display instructions: https://docs.here.com/routing/docs/routing-v8-instructions-display
- HERE Public Transit API v8 routes: https://docs.here.com/transit/reference/getroutes
