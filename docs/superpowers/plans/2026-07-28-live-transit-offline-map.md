# Live Transit and Offline Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a guest search for a Bay Area destination, select the intended place, and read complete HERE public-transit itineraries inside the existing Fog PWA while retaining authoritative 511 departures/alerts and a compliant offline neighborhood map.

**Architecture:** Keep the static React/Vite/GitHub Pages deployment and isolate raw HERE and 511 schemas behind tested adapters. Use IndexedDB only for user state and provider responses whose retention rules permit storage, coordinate duplicate browser requests in memory, keep the service worker focused on app assets, and fall back from the live Leaflet map to a checked-in OSM-derived SVG.

**Tech Stack:** React 19, Vite 8, vite-plugin-pwa/Workbox, Leaflet/react-leaflet, IndexedDB, HERE Geocoding and Search v7, HERE Public Transit Routing v8, 511 Open Data, Vitest 4, Testing Library, jsdom, fake-indexeddb.

## Global Constraints

- Preserve the existing Fog visual language, phone-width shell, curated property JSON, and GitHub Pages base path `/guidebook/`.
- Keep `VITE_HERE_API_KEY` and `VITE_API_511_KEY` in ignored local environment files; never log keys or persist credential-bearing URLs.
- Configure HERE calls for direct browser use and document trusted-domain setup for production and development origins.
- HERE Discover supplies online candidates; HERE Public Transit Routing supplies complete door-to-door itineraries; 511 supplies nearby departures and SF service alerts.
- Present an explicit HERE candidate list; never silently choose the first search result.
- Render every itinerary section in-app. Group consecutive pedestrian maneuvers under their walking section, but omit no travel leg.
- Keep standard OpenStreetMap tiles online-only and requested only for the active viewport. Never prefetch or service-worker-cache them.
- The offline map must be generated from OSM-derived vector data, checked in, visibly attributed, and accompanied by source/bounds/date/generation provenance.
- Persist HERE results only when response HTTP caching headers explicitly permit storage. Delete expired HERE entries and never display them stale.
- Use five-minute 511 departure freshness with a 30-minute labeled stale window, and ten-minute 511 alert freshness with a 60-minute labeled stale window.
- Preserve current weather runtime caching; remove only OSM and 511 service-worker runtime routes.
- Missing credentials, denied location, offline mode, timeouts, malformed data, and individual provider failures must degrade without a blank screen.
- Every task follows red-green-refactor, ends with focused verification, and commits only its own files.

## File Map

### New data and request modules

- `app/src/lib/cachePolicy.js` — parse provider HTTP cache headers without retaining request URLs.
- `app/src/lib/responseStore.js` — IndexedDB stores for normalized provider entries and user-saved state.
- `app/src/lib/requestCoordinator.js` — deduplicate in-flight browser requests by credential-free logical keys.
- `app/src/lib/hereSearch.js` — build HERE Discover requests and normalize candidates.
- `app/src/lib/hereTransit.js` — build HERE transit requests and normalize routes, sections, and actions.
- `app/src/hooks/useHereTripPlanner.js` — own search/selection/routing state and abort superseded requests.
- `app/src/hooks/useSavedDestinations.js` — persist normalized guest-saved places separately from provider caches.
- `app/src/hooks/useTransitAlerts.js` — load normalized SF alerts on the approved refresh cadence.

### New UI modules

- `app/src/components/nearby/DestinationSearch.jsx` — query form and explicit candidate list.
- `app/src/components/nearby/TripOptions.jsx` — route collection and provider state.
- `app/src/components/nearby/TripCard.jsx` — one route summary and expansion control.
- `app/src/components/nearby/ItinerarySteps.jsx` — complete ordered sections/actions.
- `app/src/components/nearby/TransitAlerts.jsx` — affected-line and general alert summaries.
- `app/src/components/nearby/LiveStatus.jsx` — accessible live/cached/stale timestamp label.
- `app/src/components/nearby/NeighborhoodMap.jsx` — online/offline selection and tile-failure fallback.
- `app/src/components/nearby/OnlineNearbyMap.jsx` — existing Leaflet rendering moved behind the fallback boundary.

### Test and fixture modules

- `app/vitest.config.js`, `app/src/test/setup.js` — jsdom test environment.
- `app/src/test/fixtures/here-discover.json` — redacted Discover response.
- `app/src/test/fixtures/here-transit.json` — redacted multi-section route response.
- `app/src/test/fixtures/511-alerts.json` — redacted current-alert response using the API's `Entities`/`Alert` casing.
- `app/src/lib/__tests__/*.test.js`, `app/src/hooks/__tests__/*.test.jsx`, `app/src/components/nearby/__tests__/*.test.jsx` — focused unit/component coverage.

### Offline-map artifacts

- `app/scripts/generate-offline-map.mjs` — fetch a bounded OSM Overpass extract and render a deterministic SVG.
- `app/public/images/ingleside-neighborhood.svg` — packaged map.
- `app/public/images/ingleside-neighborhood.md` — attribution and regeneration provenance.

---

### Task 1: Test Harness, Cache Policy, IndexedDB, and Request Deduplication

**Files:**
- Modify: `app/package.json:6-26`
- Modify: `app/package-lock.json`
- Create: `app/vitest.config.js`
- Create: `app/src/test/setup.js`
- Create: `app/src/lib/cachePolicy.js`
- Create: `app/src/lib/responseStore.js`
- Create: `app/src/lib/requestCoordinator.js`
- Test: `app/src/lib/__tests__/cachePolicy.test.js`
- Test: `app/src/lib/__tests__/responseStore.test.js`
- Test: `app/src/lib/__tests__/requestCoordinator.test.js`

**Interfaces:**
- Produces: `cacheUntilFromHeaders(headers, nowMs) -> number | null`.
- Produces: `providerResponseStore.get(key)`, `.put(entry)`, `.delete(key)`, `.clear()` where an entry is `{ key, data, fetchedAt, expiresAt, staleUntil }`.
- Produces: `savedStateStore.get(key)`, `.put(key, value)`, `.delete(key)`.
- Produces: `dedupeRequest(key, loader) -> Promise`, plus `resetRequestCoordinatorForTests()`.

- [ ] **Step 1: Install and configure the test runtime**

Run:

```bash
cd app
npm install --save-dev vitest@^4.1.10 jsdom@^30.0.1 @testing-library/react@^16.3.2 @testing-library/jest-dom@^7.0.0 fake-indexeddb@^6.2.5
```

Add scripts to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    clearMocks: true,
  },
});
```

Create `src/test/setup.js`:

```js
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

- [ ] **Step 2: Write failing cache-policy tests**

Cover explicit `max-age`, `s-maxage` exclusion, `no-store`, `no-cache`, a future `Expires`, an expired `Expires`, and missing headers:

```js
expect(cacheUntilFromHeaders(new Headers({ 'cache-control': 'public, max-age=120' }), 1_000)).toBe(121_000);
expect(cacheUntilFromHeaders(new Headers({ 'cache-control': 'no-store, max-age=120' }), 1_000)).toBeNull();
expect(cacheUntilFromHeaders(new Headers({ 'cache-control': 'no-cache' }), 1_000)).toBeNull();
expect(cacheUntilFromHeaders(new Headers(), 1_000)).toBeNull();
```

- [ ] **Step 3: Write failing storage and deduplication tests**

Assert that provider entries round-trip, expired entries can be deleted, saved state uses a separate store, and concurrent loaders run once:

```js
const loader = vi.fn(async () => ({ ok: true }));
const [first, second] = await Promise.all([
  dedupeRequest('511:SF:15794', loader),
  dedupeRequest('511:SF:15794', loader),
]);
expect(loader).toHaveBeenCalledTimes(1);
expect(first).toBe(second);
```

- [ ] **Step 4: Run the tests and confirm the red state**

Run: `npm test -- src/lib/__tests__/cachePolicy.test.js src/lib/__tests__/responseStore.test.js src/lib/__tests__/requestCoordinator.test.js`

Expected: FAIL because the three modules do not exist.

- [ ] **Step 5: Implement the minimal cache and storage modules**

`cacheUntilFromHeaders` must prefer `Cache-Control`, refuse `no-store` and `no-cache`, accept only a positive browser `max-age`, and use `Expires` only when no `Cache-Control` directive determines the result.

Use IndexedDB database `sfcottage-guidebook`, version `1`, with object stores `providerResponses` and `savedState`, both keyed by `key`. Store normalized data only—never raw URLs or request headers.

Implement request deduplication with a module-level map and guaranteed cleanup:

```js
const inFlight = new Map();

export function dedupeRequest(key, loader) {
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = Promise.resolve().then(loader).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
```

- [ ] **Step 6: Run focused tests, lint, and commit**

Run:

```bash
npm test -- src/lib/__tests__/cachePolicy.test.js src/lib/__tests__/responseStore.test.js src/lib/__tests__/requestCoordinator.test.js
npm run lint
git add app/package.json app/package-lock.json app/vitest.config.js app/src/test app/src/lib/cachePolicy.js app/src/lib/responseStore.js app/src/lib/requestCoordinator.js app/src/lib/__tests__
git commit -m "test: add provider cache foundations"
```

Expected: all focused tests PASS and lint exits zero.

---

### Task 2: HERE Discover Adapter

**Files:**
- Create: `app/src/lib/hereSearch.js`
- Create: `app/src/test/fixtures/here-discover.json`
- Test: `app/src/lib/__tests__/hereSearch.test.js`
- Modify: `app/.env.example:1-6`

**Interfaces:**
- Consumes: `cacheUntilFromHeaders`, `providerResponseStore`, and `dedupeRequest` from Task 1.
- Produces: `buildHereSearchUrl(query, center, apiKey) -> URL`.
- Produces: `normalizeHereCandidates(payload) -> Candidate[]` where `Candidate` is `{ id, title, address, position: { lat, lng }, resultType, categories, distanceMeters }`.
- Produces: `searchHereDestinations(query, center, options?) -> Promise<SearchResult>` where success is `{ ok: true, candidates, source, fetchedAt, expiresAt }` and failure is `{ ok: false, reason }`.

- [ ] **Step 1: Add the HERE environment contract**

Add to `.env.example` without a value:

```dotenv
# Browser API key for HERE Discover and Public Transit Routing.
# Restrict it to trusted production/development domains in HERE Access Manager.
VITE_HERE_API_KEY=
```

- [ ] **Step 2: Create a redacted Discover fixture and failing normalization tests**

The fixture must contain multiple `items`, including a place and an address, with representative `id`, `title`, `address.label`, `position`, `resultType`, `categories`, and `distance` fields. Assert exact normalized objects and omission of malformed items without numeric coordinates.

```js
expect(normalizeHereCandidates(fixture)[0]).toEqual({
  id: 'here:af:streetsection:union-square',
  title: 'Union Square',
  address: 'Union Square, San Francisco, CA 94108, United States',
  position: { lat: 37.7879, lng: -122.4075 },
  resultType: 'place',
  categories: [],
  distanceMeters: 7900,
});
```

- [ ] **Step 3: Write failing request, caching, and error tests**

Verify the URL uses `/v1/discover`, `in=circle:<lat>,<lng>;r=80000`, `limit=5`, `lang=en-US`, encoded `q`, and `apiKey`. Test network success, empty candidates, `401/403 -> unauthorized`, `429 -> rate-limited`, `AbortError -> aborted`, other failures -> network, malformed JSON -> invalid-response, and missing key -> missing-api-key.

Stub a response with `Cache-Control: no-store` and assert `providerResponseStore.put` is not called. Stub `max-age=60`, assert normalized data is stored under a logical key that contains the query and rounded center but no API key, then assert a second call uses `{ source: 'cache' }`.

- [ ] **Step 4: Run the adapter tests and confirm the red state**

Run: `npm test -- src/lib/__tests__/hereSearch.test.js`

Expected: FAIL because `hereSearch.js` does not exist.

- [ ] **Step 5: Implement HERE Discover with abort and header-aware persistence**

Use dependency injection only for tests:

```js
export async function searchHereDestinations(
  query,
  center,
  { signal, fetchImpl = fetch, apiKey = import.meta.env.VITE_HERE_API_KEY, now = Date.now } = {}
) { /* normalized settled result */ }
```

Trim the query, reject empty input as `empty-query`, bound searches to an 80 km circle, cap candidates at five, and persist only normalized candidates when `cacheUntilFromHeaders(response.headers, fetchedAt)` returns a future timestamp. Do not store raw HERE payloads or credential-bearing URLs.

- [ ] **Step 6: Run focused tests, lint, and commit**

Run:

```bash
npm test -- src/lib/__tests__/hereSearch.test.js
npm run lint
git add app/.env.example app/src/lib/hereSearch.js app/src/lib/__tests__/hereSearch.test.js app/src/test/fixtures/here-discover.json
git commit -m "feat: add HERE destination search adapter"
```

---

### Task 3: HERE Public Transit Route Adapter

**Files:**
- Create: `app/src/lib/hereTransit.js`
- Create: `app/src/test/fixtures/here-transit.json`
- Test: `app/src/lib/__tests__/hereTransit.test.js`

**Interfaces:**
- Consumes: Task 1 cache/storage/deduplication modules.
- Produces: `buildHereTransitUrl(origin, destination, departureTime, apiKey) -> URL`.
- Produces: `normalizeHereRoutes(payload, plannedAt) -> Trip[]` using the design's normalized trip shape.
- Produces: `fetchHereTransitRoutes(origin, destination, options?) -> Promise<RouteResult>` with the same settled status conventions as HERE search.

- [ ] **Step 1: Create a representative multi-leg route fixture**

Include three route objects. The first must contain pedestrian → transit → pedestrian sections, `travelSummary.duration`, departure/arrival places and times, actions, a transit `transport` block with a K line/headsign, intermediate stops, and an incident notice. The second must include a transfer between two transit sections. The third must contain an unknown section/action type to prove forward-compatible rendering.

- [ ] **Step 2: Write failing route-normalization tests**

Assert exact departure/arrival times, duration, transfer count, summed pedestrian duration, ordered line summaries, section order, platform/stop fields, intermediate stops, incidents/notices, action instructions, and `plannedAt`.

```js
const trips = normalizeHereRoutes(fixture, '2026-07-28T18:00:00.000Z');
expect(trips[0]).toMatchObject({
  transferCount: 0,
  lines: [{ name: 'K Ingleside', headsign: 'Embarcadero' }],
  plannedAt: '2026-07-28T18:00:00.000Z',
});
expect(trips[0].sections.map((section) => section.type)).toEqual(['pedestrian', 'transit', 'pedestrian']);
```

- [ ] **Step 3: Write failing URL, caching, and failure tests**

Verify `origin`, `destination`, `departureTime`, `alternatives=2`, `units=imperial`, `lang=en-US`, and `return=intermediate,actions,travelSummary,incidents,sourceFeedMapping`. Test missing key, unauthorized, rate-limited, aborted, network, invalid-response, and no-route results.

Assert current HERE behavior (`no-store` or no positive caching header) never writes to IndexedDB. Also test a synthetic `max-age=60` response to prove permitted persistence and expiry deletion.

- [ ] **Step 4: Run the tests and confirm the red state**

Run: `npm test -- src/lib/__tests__/hereTransit.test.js`

Expected: FAIL because `hereTransit.js` does not exist.

- [ ] **Step 5: Implement route normalization and request handling**

Use this public signature:

```js
export async function fetchHereTransitRoutes(
  origin,
  destination,
  { departureTime = new Date(), signal, fetchImpl = fetch, apiKey = import.meta.env.VITE_HERE_API_KEY, now = Date.now } = {}
) { /* normalized settled result */ }
```

Calculate `transferCount` as one less than the number of transit sections, floored at zero. Sum pedestrian `travelSummary.duration` for walking time. Preserve every section. Convert unrecognized section/action types to `{ type: 'unknown', label, instruction }` instead of dropping them. Filter out a purely pedestrian alternative only when at least one transit route exists.

- [ ] **Step 6: Run focused tests, lint, and commit**

Run:

```bash
npm test -- src/lib/__tests__/hereTransit.test.js
npm run lint
git add app/src/lib/hereTransit.js app/src/lib/__tests__/hereTransit.test.js app/src/test/fixtures/here-transit.json
git commit -m "feat: normalize HERE transit itineraries"
```

---

### Task 4: Shared 511 Departures and Service Alerts

**Files:**
- Modify: `app/src/lib/transit511.js:1-33`
- Modify: `app/src/hooks/useLiveDepartures.js:1-43`
- Create: `app/src/hooks/useTransitAlerts.js`
- Create: `app/src/test/fixtures/511-alerts.json`
- Test: `app/src/lib/__tests__/transit511.test.js`
- Test: `app/src/hooks/__tests__/useLiveDepartures.test.jsx`
- Test: `app/src/hooks/__tests__/useTransitAlerts.test.jsx`
- Modify: `app/src/context/AppContext.jsx:130-190`

**Interfaces:**
- Consumes: `providerResponseStore` and `dedupeRequest` from Task 1.
- Produces: `fetchStopDepartures(stopCode, agency, options?) -> { ok, minutesList, source, fetchedAt, expiresAt }`.
- Produces: `fetchServiceAlerts(agency = 'SF', options?) -> { ok, alerts, source, fetchedAt, expiresAt }`.
- Produces: `useLiveDepartures(stops) -> { times, meta }`, retaining `times[index]` strings for existing consumers.
- Produces: `useTransitAlerts('SF') -> { alerts, status, updatedAt, error, refresh }`.

- [ ] **Step 1: Create a redacted alert fixture matching the live API**

Use top-level `Header` and `Entities`. Each entity uses `Id` and `Alert`; each alert includes `ActivePeriods`, `InformedEntities`, `HeaderText.Translations`, `DescriptionText.Translations`, and `Url.Translations`. Include one K alert, one bus alert, and one malformed entity.

- [ ] **Step 2: Write failing 511 normalization and status tests**

Test BOM stripping for Stop Monitoring, minutes clamped at zero, uppercase GTFS-realtime JSON normalization, English translation preference, route ID extraction, current-active-period filtering, and stable failure reasons for missing key, 401/403, 429, timeout/network, and invalid JSON.

```js
expect(normalizeServiceAlerts(fixture, now)).toEqual([
  expect.objectContaining({
    id: 'sf-k-delay',
    agency: 'SF',
    affectedLines: ['K'],
    header: 'K Ingleside delay',
  }),
  expect.objectContaining({ affectedLines: ['43'] }),
]);
```

- [ ] **Step 3: Write failing freshness/deduplication hook tests**

With fake timers and mocked fetch, mount two `useLiveDepartures` consumers containing stop `15794`. Assert one network call during the five-minute window, refresh after five minutes, cached metadata before expiry, stale metadata after a simulated network failure inside 30 minutes, and fallback removal after 30 minutes. Repeat for ten-/60-minute alert windows.

- [ ] **Step 4: Run the tests and confirm the red state**

Run: `npm test -- src/lib/__tests__/transit511.test.js src/hooks/__tests__/useLiveDepartures.test.jsx src/hooks/__tests__/useTransitAlerts.test.jsx`

Expected: FAIL because alert and metadata interfaces do not exist.

- [ ] **Step 5: Implement shared 511 cache coordination and alerts**

Use logical keys such as `511:departures:SF:15794` and `511:alerts:SF`; never include the API key. Store normalized 511 values with `fetchedAt`, fresh expiry, and stale cutoff. Return stale data only after a failed refresh and only inside the approved stale window.

Update `AppContext` to consume the compatible `times` map:

```js
const { times: optionTimes } = useLiveDepartures(property.transit.options);
const kTimes = optionTimes[kIndex] ?? property.transit.options[kIndex]?.times;
```

- [ ] **Step 6: Run focused tests, lint, build, and commit**

Run:

```bash
npm test -- src/lib/__tests__/transit511.test.js src/hooks/__tests__/useLiveDepartures.test.jsx src/hooks/__tests__/useTransitAlerts.test.jsx
npm run lint
npm run build
git add app/src/lib/transit511.js app/src/hooks/useLiveDepartures.js app/src/hooks/useTransitAlerts.js app/src/context/AppContext.jsx app/src/lib/__tests__/transit511.test.js app/src/hooks/__tests__ app/src/test/fixtures/511-alerts.json
git commit -m "feat: add shared 511 departures and alerts"
```

---

### Task 5: Complete In-App Itinerary Components

**Files:**
- Create: `app/src/components/nearby/LiveStatus.jsx`
- Create: `app/src/components/nearby/ItinerarySteps.jsx`
- Create: `app/src/components/nearby/TripCard.jsx`
- Create: `app/src/components/nearby/TripOptions.jsx`
- Create: `app/src/components/nearby/TransitAlerts.jsx`
- Test: `app/src/components/nearby/__tests__/ItinerarySteps.test.jsx`
- Test: `app/src/components/nearby/__tests__/TripOptions.test.jsx`
- Test: `app/src/components/nearby/__tests__/TransitAlerts.test.jsx`

**Interfaces:**
- Consumes: normalized `Trip`, section, action, and 511 alert shapes from Tasks 3 and 4.
- Produces: `LiveStatus({ source, timestamp, label })`.
- Produces: `TripOptions({ result, alerts, externalUrlForTrip })`; it owns a single `expandedTripId` and resets when remounted for a new route result.
- Produces: `TransitAlerts({ alerts, lineIds })` with affected and general display modes.

- [ ] **Step 1: Write failing full-itinerary rendering tests**

Render the normalized fixture from Task 3 and assert visible summary fields, accessible expansion buttons, every section heading, grouped walking maneuvers, platform/stop text, line/headsign, intermediate stops, transfer instructions, final arrival, and a generic row for the unknown section/action.

```jsx
render(<TripOptions result={{ ok: true, trips, source: 'network', fetchedAt }} alerts={[]} externalUrlForTrip={() => 'https://example.test/directions'} />);
await user.click(screen.getByRole('button', { name: /view full itinerary/i }));
expect(screen.getAllByTestId('itinerary-section')).toHaveLength(trips[0].sections.length);
expect(screen.getByText(/platform 2/i)).toBeVisible();
expect(screen.getByText(/arrive at union square/i)).toBeVisible();
```

- [ ] **Step 2: Write failing live/cached/stale and alert tests**

Assert accessible text for “Live · updated 2 min ago,” “Cached,” and “Last known · updated…”. Verify K alerts appear inside a K trip, unrelated alerts stay out of that trip, general SF alerts render in the standalone area, and details expand on deliberate action.

- [ ] **Step 3: Run the component tests and confirm the red state**

Run: `npm test -- src/components/nearby/__tests__/ItinerarySteps.test.jsx src/components/nearby/__tests__/TripOptions.test.jsx src/components/nearby/__tests__/TransitAlerts.test.jsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 4: Implement focused presentational components**

Use native `<button>` elements with `aria-expanded`, `<ol>` for ordered itinerary sections, `<time dateTime>` for timestamps, and line badges from the existing `LineBadge` component. Keep styles consistent with `colors`, `fonts`, `card`, and the current 430 px layout. `TripCard` marks only the first HERE-ranked option “Recommended” and leaves all cards collapsed initially. The expanded card renders the URL returned by `externalUrlForTrip(trip)` as the secondary “Open in maps” action.

Format seconds through small pure helpers inside `ItinerarySteps.jsx`:

```js
export const formatDuration = (seconds) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`;
};
```

- [ ] **Step 5: Run focused tests, lint, and commit**

Run:

```bash
npm test -- src/components/nearby/__tests__
npm run lint
git add app/src/components/nearby
git commit -m "feat: render complete transit itineraries"
```

---

### Task 6: Explicit Destination Selection and Nearby Screen Integration

**Files:**
- Create: `app/src/hooks/useHereTripPlanner.js`
- Create: `app/src/hooks/useSavedDestinations.js`
- Create: `app/src/components/nearby/DestinationSearch.jsx`
- Modify: `app/src/components/screens/Nearby.jsx:1-334`
- Modify: `app/src/context/AppContext.jsx:143-291`
- Test: `app/src/hooks/__tests__/useHereTripPlanner.test.jsx`
- Test: `app/src/hooks/__tests__/useSavedDestinations.test.jsx`
- Test: `app/src/components/nearby/__tests__/DestinationSearch.test.jsx`
- Test: `app/src/components/screens/Nearby.test.jsx`

**Interfaces:**
- Consumes: `searchHereDestinations`, `fetchHereTransitRoutes`, `TripOptions`, `TransitAlerts`, and the existing AppContext location state.
- Produces: `useHereTripPlanner({ origin }) -> { query, setQuery, candidates, selectedDestination, searchStatus, routeResult, search, selectDestination, clearDestination, retryRoutes }`.
- Produces: `useSavedDestinations() -> { savedDestinations, loading, isSaved, toggleSaved }` backed by `savedStateStore` key `saved-destinations` and capped at ten normalized candidates.
- Produces: `DestinationSearch` callbacks `onSubmit(query)`, `onSelect(candidate)`, and `onClear()`.

- [ ] **Step 1: Write failing trip-planner state tests**

Use deferred mocked promises to prove that a second search aborts the first and that the first cannot overwrite newer candidates. Assert that search success does not select a result or fetch routes, explicit selection fetches routes once, changing origin refetches the selected trip, clearing removes candidates/routes, and retry preserves query/selection.

- [ ] **Step 2: Write failing destination UI tests**

Assert that the form preserves the typed query, Enter and the Go button submit, candidates show both title and address, no candidate is preselected, keyboard-accessible candidate buttons call `onSelect`, empty/error/loading copy is calm, and retry does not erase the query. Assert that save/remove buttons have explicit accessible names and that saved destinations remain selectable when no online candidates are present.

Write `useSavedDestinations` tests that start empty, save a normalized candidate, survive hook remount through IndexedDB, remove the candidate, deduplicate by candidate ID, and cap the collection at the ten most recently saved places.

- [ ] **Step 3: Write the failing Nearby integration test**

Mock HERE adapters and location. Exercise: use cottage → submit “Union Square” → select the matching candidate → see three collapsed route cards → expand one → see every route section. Also assert that a HERE failure leaves nearest 511 departure rows, curated chips, back-home guidance, and rideshare cards visible.

- [ ] **Step 4: Run the tests and confirm the red state**

Run: `npm test -- src/hooks/__tests__/useHereTripPlanner.test.jsx src/hooks/__tests__/useSavedDestinations.test.jsx src/components/nearby/__tests__/DestinationSearch.test.jsx src/components/screens/Nearby.test.jsx`

Expected: FAIL because planner/search interfaces do not exist and `Nearby` still uses Photon.

- [ ] **Step 5: Implement the abort-safe planner hook**

Use separate `AbortController` refs for search and routes. Abort on superseding action and unmount. Search returns candidates only; selection sets the destination and then requests routes. Give `TripOptions` a key derived from selected destination ID and route `plannedAt` so its owned expansion state resets when the route result changes.

Move destination-query ownership out of `AppContext`: remove its `dest`/`setDest` state and memo entries because the value is private to the Nearby planner. Implement `useSavedDestinations` on the separate `savedStateStore`; store only normalized candidates, never HERE raw payloads, timestamps, or credential-bearing URLs. Selecting a saved destination while offline keeps the destination/map context and produces the normal connection-required route state.

Build the known cottage candidate without a HERE search for “Take me back”:

```js
const cottageDestination = {
  id: `property:${property.id}`,
  title: property.name,
  address: `${property.address.street}, ${property.address.city}`,
  position: cottage,
  resultType: 'property',
  categories: [],
  distanceMeters: 0,
};
```

- [ ] **Step 6: Replace Photon/external-first routing in `Nearby`**

Remove `geocodePlace` and the automatic first-result behavior. Keep `distanceMiles` and `stopHeadsToward`, passing `selectedDestination.position`. Place components in this order after the map: destination search/candidates, trip options, curated destination/back-home chips, relevant alerts, nearby departures, rideshare, how-to-ride.

Retain a secondary external link inside each expanded itinerary using the existing Google Maps URL construction, but remove the current primary “Transit directions” handoff card.

Use metadata from `useLiveDepartures` to render `LiveStatus` beside each live/cached/stale stop result and show “Data provided by 511.org” once below the departure group.

- [ ] **Step 7: Run focused tests, the entire suite, lint, build, and commit**

Run:

```bash
npm test -- src/hooks/__tests__/useHereTripPlanner.test.jsx src/hooks/__tests__/useSavedDestinations.test.jsx src/components/nearby/__tests__/DestinationSearch.test.jsx src/components/screens/Nearby.test.jsx
npm test
npm run lint
npm run build
git add app/src/hooks/useHereTripPlanner.js app/src/hooks/useSavedDestinations.js app/src/hooks/__tests__/useHereTripPlanner.test.jsx app/src/hooks/__tests__/useSavedDestinations.test.jsx app/src/components/nearby/DestinationSearch.jsx app/src/components/nearby/__tests__/DestinationSearch.test.jsx app/src/components/screens/Nearby.jsx app/src/components/screens/Nearby.test.jsx app/src/context/AppContext.jsx
git commit -m "feat: add in-app HERE trip planning flow"
```

---

### Task 7: Packaged OSM Map and Online Map Fallback

**Files:**
- Create: `app/scripts/generate-offline-map.mjs`
- Create: `app/public/images/ingleside-neighborhood.svg` (generated)
- Create: `app/public/images/ingleside-neighborhood.md`
- Create: `app/src/components/nearby/OnlineNearbyMap.jsx`
- Create: `app/src/components/nearby/NeighborhoodMap.jsx`
- Delete: `app/src/components/NearbyMap.jsx`
- Modify: `app/src/components/screens/Nearby.jsx`
- Modify: `app/src/index.css:29-31`
- Modify: `app/vite.config.js:32-76`
- Test: `app/src/components/nearby/__tests__/NeighborhoodMap.test.jsx`
- Test: `app/src/lib/__tests__/pwaCaching.test.js`

**Interfaces:**
- Produces: `NeighborhoodMap({ center, cottage, stops, showMe, dest })` as the only map component imported by `Nearby`.
- Produces: `generate-offline-map.mjs` with fixed bounds `south=37.708`, `west=-122.475`, `north=37.738`, `east=-122.435`.

- [ ] **Step 1: Write failing online/offline/failure map tests**

Mock `OnlineNearbyMap`. Assert online renders it, `offline` events switch to the static SVG and orientation copy, `online` switches back, and an `onTileFailure` callback switches to the static image without changing the browser's network state. Assert the image alt text describes Ingleside orientation and the rendered attribution links to OpenStreetMap copyright.

- [ ] **Step 2: Write a failing service-worker configuration test**

Export `runtimeCaching` from `vite.config.js` or a small config module and assert no rule matches `tile.openstreetmap.org`, `api.511.org`, or `hereapi.com`, while the NWS and Google Fonts rules remain.

```js
const patterns = runtimeCaching.map((entry) => String(entry.urlPattern));
expect(patterns.join('\n')).not.toMatch(/openstreetmap|511|hereapi/);
expect(patterns.join('\n')).toMatch(/weather/);
```

- [ ] **Step 3: Run the tests and confirm the red state**

Run: `npm test -- src/components/nearby/__tests__/NeighborhoodMap.test.jsx src/lib/__tests__/pwaCaching.test.js`

Expected: FAIL because the wrapper does not exist and Workbox still caches OSM/511.

- [ ] **Step 4: Move the live Leaflet implementation and add tile-failure signaling**

Move the current marker/icon/FitToDest implementation into `OnlineNearbyMap.jsx`. Keep visible OSM attribution and the standard URL `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Pass Leaflet `tileerror` events to `onTileFailure`; do not preload adjacent views or zoom levels.

`NeighborhoodMap` listens to `online`/`offline`, starts from `navigator.onLine`, and renders:

```jsx
<figure className="offline-neighborhood-map">
  <img src={`${import.meta.env.BASE_URL}images/ingleside-neighborhood.svg`} alt="Offline neighborhood map around The SF Cottage in Ingleside" />
  <figcaption>
    Offline orientation map · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>
  </figcaption>
</figure>
```

- [ ] **Step 5: Add the deterministic OSM-to-SVG generator**

The script submits this bounded Overpass query only when intentionally run:

```js
const query = `[out:json][timeout:60];(
  way[highway](${south},${west},${north},${east});
  node[public_transport](${south},${west},${north},${east});
  node[railway=station](${south},${west},${north},${east});
);out body;>;out skel qt;`;
```

Project longitude/latitude linearly into a `1200 × 900` SVG, draw roads by highway class, label only named primary/secondary/tertiary roads plus Ocean Avenue, draw the cottage and curated stop markers from `sfcottage.json`, and include the text `© OpenStreetMap contributors · ODbL` inside the SVG. Sort ways/nodes by numeric OSM ID before rendering so repeated generation from the same extract is deterministic.

Run: `node scripts/generate-offline-map.mjs`

Inspect the generated SVG for a non-empty `viewBox`, road paths, cottage marker, transit markers, and visible attribution. Write `ingleside-neighborhood.md` with the exact bounds, generation date, Overpass endpoint/query, script path, ODbL attribution, and regeneration command.

- [ ] **Step 6: Remove prohibited/duplicative Workbox routes**

Delete the OSM `CacheFirst` entry and the 511 `NetworkFirst` entry from `vite.config.js`. Keep NWS and Google Fonts runtime rules. Ensure `globPatterns` still includes SVG so the packaged map is precached.

- [ ] **Step 7: Run tests, lint, build, inspect the generated service worker, and commit**

Run:

```bash
npm test -- src/components/nearby/__tests__/NeighborhoodMap.test.jsx src/lib/__tests__/pwaCaching.test.js
npm run lint
npm run build
test -s dist/images/ingleside-neighborhood.svg
! rg -n "osm-tiles|511-transit|tile\\.openstreetmap|api\\.511\\.org" dist/sw.js
git add app/scripts/generate-offline-map.mjs app/public/images/ingleside-neighborhood.svg app/public/images/ingleside-neighborhood.md app/src/components/nearby app/src/components/screens/Nearby.jsx app/src/index.css app/vite.config.js app/src/lib/__tests__/pwaCaching.test.js
git rm app/src/components/NearbyMap.jsx
git commit -m "feat: add compliant offline neighborhood map"
```

Expected: map asset exists in `dist`, forbidden runtime cache identifiers are absent, and all focused checks pass.

---

### Task 8: Documentation, Security Audit, and End-to-End Verification

**Files:**
- Modify: `app/README.md:1-70`
- Modify: `app/.env.example`
- Modify: `docs/superpowers/specs/2026-07-28-live-transit-offline-map-design.md` only if implementation discovered an approved factual correction.
- Test: all test files created in Tasks 1-7.

**Interfaces:**
- Consumes: the complete guest flow and all completion criteria.
- Produces: deployment instructions and current verification evidence.

- [ ] **Step 1: Update operator documentation**

Document:

- `VITE_HERE_API_KEY` and `VITE_API_511_KEY` setup without example secrets;
- HERE trusted domains for `keithah.github.io` and each explicitly used localhost origin;
- HERE Discover/transit versus 511 departure/alert responsibilities;
- the offline SVG regeneration command and attribution requirements;
- service-worker versus IndexedDB boundaries;
- live/cached/stale labels and exact five-/30-minute and ten-/60-minute 511 windows;
- the fact that current HERE `no-store` responses remain memory-only;
- test, build, preview, and offline-smoke commands.

- [ ] **Step 2: Run the full automated completion gate**

Run:

```bash
cd app
npm test
npm run lint
npm run build
```

Expected: all tests PASS, lint exits zero, and Vite produces a PWA build without warnings that invalidate precaching.

- [ ] **Step 3: Audit secrets and cache output**

Run without printing `.env`:

```bash
git check-ignore -q app/.env
test -n "$(sed -n 's/^VITE_HERE_API_KEY=.*/configured/p' app/.env)"
test -n "$(sed -n 's/^VITE_API_511_KEY=.*/configured/p' app/.env)"
! git grep -n "apiKey=.*[^=]" -- ':!docs/**'
! rg -n "osm-tiles|511-transit|tile\\.openstreetmap|api\\.511\\.org|hereapi\\.com" dist/sw.js
```

Expected: `.env` is ignored, both variables are configured, no literal credential-bearing source URL is committed, and the service worker has no provider/map runtime route.

- [ ] **Step 4: Perform a production-preview guest smoke test**

Run `npm run preview -- --host 127.0.0.1` and verify at the printed `/guidebook/` URL:

1. choose the cottage origin;
2. search “Union Square” and confirm a selectable result list;
3. select the intended result and confirm up to three HERE route cards;
4. expand a route and confirm all walking/transit/transfer/final sections are readable;
5. confirm nearby 511 departures and any SF alerts show source/timestamp state;
6. switch DevTools offline and reload;
7. confirm the shell, property content, photographs, and attributed offline map load;
8. confirm route search explains that a connection is required and no blank screen appears;
9. restore online mode and confirm the interactive map and retry actions recover.

- [ ] **Step 5: Inspect Cache Storage in the preview**

Confirm the Workbox precache contains app assets and `images/ingleside-neighborhood.svg`, while no cache contains standard OSM tiles, HERE responses, or 511 responses. Confirm IndexedDB contains only normalized logical keys without API credentials; with current HERE `no-store` headers, no HERE provider entries should be present.

- [ ] **Step 6: Review the final diff and commit documentation**

Run:

```bash
git diff --check
git status --short
git diff --stat HEAD~7..HEAD
git add app/README.md app/.env.example
git commit -m "docs: explain live transit and offline behavior"
```

Expected: only intended documentation remains uncommitted before the final commit, and the worktree is clean afterward.

- [ ] **Step 7: Final verification after the last commit**

Run:

```bash
npm test
npm run lint
npm run build
git status --short
```

Expected: tests, lint, and build pass; `git status --short` prints nothing.
