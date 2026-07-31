# Location-Aware Nearby Transit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Nearby use the guest's active device or stay-override location for honest nearby transit, place deterministic destination shortcuts directly below address search, keep route-warning detail inside full itineraries, and replace every `ba` placeholder with the official local BART logo.

**Architecture:** Keep structured shortcuts in property JSON, restrict manual lookup to HERE geocoding result types, and add a separate HERE Public Transit station/departure adapter plus a location-keyed React hook. Normalize provider responses into five distance-ordered station view models that drive both the board and map. Extend route warnings only with section IDs, then pass those IDs through the existing trip timeline so collapsed cards expose a quiet per-line indicator while expanded cards retain full detail.

**Tech Stack:** React 19, Vite 8, Vitest 4, Testing Library, Leaflet/React-Leaflet, HERE Geocoding and Search v1, HERE Public Transit API v8, 511 normalized alerts, IndexedDB response storage, local SVG assets.

## Global Constraints

- Follow RED → GREEN → refactor for each task; do not write implementation before the named focused test fails for the expected reason.
- Do not add POI discovery, business results, curated nearby departures, fuzzy station grouping, straight-line walking estimates, or location-wide 511 alert UI.
- `coords` is the only routing, station-search, distance, and online-map origin. A stay override is a current location, never an address marker.
- Never fall back to `property.transit.nearbyStops` when the active-location provider request is unavailable. Keep that property data only for unrelated legacy/cottage reference surfaces.
- Cache normalized HERE station/departure results only when both responses explicitly permit a common positive lifetime. Never persist API keys, raw provider URLs, no-store responses, or expired responses.
- Refresh active nearby data no sooner than five minutes; a later provider expiry extends that interval.
- Keep all route warning text, source, severity, description, and links inside the expanded full itinerary. The collapsed UI may show only the approved yellow `!` on an affected transit identity.
- Preserve complete transit and walking itineraries, Google Maps links, rideshare placeholders, offline map behavior, active stay-location hash behavior, and property data outside the named fields.
- Use `apply_patch` for repository edits. Treat the official BART file as a verbatim third-party asset and record its source/license; do not redraw or optimize it.
- Do not expose either provider credential in source, fixtures, logs, cache keys, screenshots, commits, or PR text.

---

## File and Responsibility Map

**Create**

- `app/src/assets/bart-logo.svg` — verbatim official BART artwork from Wikimedia's original-file redirect.
- `app/src/assets/bart-logo.LICENSE.md` — source, public-domain/simple-logo note, and trademark caveat.
- `app/src/components/BartLogo.jsx` — standalone/decorative accessible local logo.
- `app/src/components/BartLogo.test.jsx` — local asset and accessibility contract.
- `app/src/components/nearby/QuickDestinations.jsx` — ordered direct-selection buttons.
- `app/src/components/nearby/__tests__/QuickDestinations.test.jsx` — order and direct-callback behavior.
- `app/src/test/fixtures/here-geocode.json` — address/locality plus deliberately excluded POI samples.
- `app/src/test/fixtures/here-stations.json` — nearby station payload with physical-parent and malformed cases.
- `app/src/test/fixtures/here-departures.json` — live, zero-delay, scheduled, multi-line, and empty boards.
- `app/src/lib/hereNearbyTransit.js` — URL construction, station/board normalization, joining, cache policy, and failure mapping.
- `app/src/lib/__tests__/hereNearbyTransit.test.js` — complete adapter contract.
- `app/src/hooks/useNearbyTransit.js` — active-origin lifecycle, cancellation, publication key, polling, and retry.
- `app/src/hooks/__tests__/useNearbyTransit.test.jsx` — enablement, stale suppression, clearing, refresh, and cleanup.
- `app/src/components/nearby/NearbyDepartures.jsx` — loading/failure/empty/success board UI.
- `app/src/components/nearby/__tests__/NearbyDepartures.test.jsx` — honest distance/timing/operator rendering.

**Modify**

- `app/src/data/properties/sfcottage.json` — replace free-form `destSuggestions` with six canonical destination objects.
- `app/src/lib/hereSearch.js` and `app/src/lib/__tests__/hereSearch.test.js` — geocode endpoint and non-POI filtering.
- `app/src/hooks/useHereTripPlanner.js` and its tests — direct structured selection that clears search results.
- `app/src/components/nearby/DestinationSearch.jsx` and its tests — address wording, saved-address filtering seam, and move selected summary below shortcuts.
- `app/src/components/LineBadge.jsx` — use `BartLogo` for BART.
- `app/src/components/nearby/TransitIdentity.jsx` and tests — local BART logo and optional warning indicator.
- `app/src/components/screens/HowToRide.jsx` and focused rendering coverage — standalone BART logo.
- `app/src/components/nearby/OnlineNearbyMap.jsx` and tests — local BART artwork in Leaflet pins and exact `You` marker semantics.
- `app/src/lib/tripWarnings.js` and tests — attach and merge matching section IDs.
- `app/src/components/nearby/JourneyTimeline.jsx`, `TripCard.jsx`, and tests — line-scoped indicator and expanded-only warning detail.
- `app/src/lib/geo.js`, `app/src/context/AppContext.jsx`, and context tests — distinguish device from cottage fallback origin.
- `app/src/components/screens/Nearby.jsx` and tests — approved hierarchy, dynamic stations/map, and removal of static board rendering.
- `app/README.md` — document dynamic nearby behavior and local BART asset provenance.

---

### Task 1: Replace Every BART Placeholder with the Official Local Asset

**Files:**
- Create: `app/src/assets/bart-logo.svg`
- Create: `app/src/assets/bart-logo.LICENSE.md`
- Create: `app/src/components/BartLogo.jsx`
- Create: `app/src/components/BartLogo.test.jsx`
- Modify: `app/src/components/LineBadge.jsx`
- Modify: `app/src/components/nearby/TransitIdentity.jsx`
- Modify: `app/src/components/screens/HowToRide.jsx`
- Modify: `app/src/components/nearby/OnlineNearbyMap.jsx`
- Modify: relevant component/map tests

**Interfaces:**
- Consumes: a requested pixel height and whether an already-labeled parent owns accessibility.
- Produces: `BartLogo({ height = 18, decorative = false })` backed by the bundled SVG.
- Preserves: `LineBadge({ line, size, fontSize })` and `TransitIdentity({ section, compact })` callers.

- [ ] **Step 1: Write failing BART identity tests**

Add these assertions before creating the component:

```jsx
// app/src/components/BartLogo.test.jsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import BartLogo from './BartLogo.jsx';

afterEach(cleanup);

describe('BartLogo', () => {
  it('renders the bundled SVG with a standalone accessible name', () => {
    render(<BartLogo height={24} />);
    const logo = screen.getByRole('img', { name: 'BART' });
    expect(logo.getAttribute('src')).toMatch(/bart-logo\.svg$/);
    expect(logo).toHaveStyle({ height: '24px', width: 'auto' });
  });

  it('is ignored when an accessible parent already names BART', () => {
    render(<BartLogo decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute('alt', '');
  });
});
```

Extend `OnlineNearbyMap.test.jsx` so its BART pin HTML contains `bart-logo.svg` and does not contain `>ba<`. Extend `TripCard.test.jsx`/identity coverage so a BART leg has one accessible `BART Yellow train` identity and a decorative bundled logo. Add a focused How-to-Ride assertion for one standalone `img` named `BART`.

- [ ] **Step 2: Run the focused tests to prove RED**

Run:

```bash
cd app
npm test -- src/components/BartLogo.test.jsx src/components/nearby/__tests__/OnlineNearbyMap.test.jsx src/components/nearby/__tests__/TripCard.test.jsx
```

Expected: FAIL because `BartLogo.jsx` and the bundled asset do not exist, and current surfaces still emit `ba`.

- [ ] **Step 3: Add and verify the verbatim source asset**

Fetch the original only into a temporary file, verify it, then add the exact inspected text to the repository with `apply_patch`:

```bash
curl -L --fail --silent --show-error \
  'https://en.wikipedia.org/wiki/Special:Redirect/file/Bart-logo.svg' \
  > /tmp/guidebook-bart-logo.svg
sha256sum /tmp/guidebook-bart-logo.svg
wc -c /tmp/guidebook-bart-logo.svg
```

Expected SHA-256: `6ccf60f929e4bc2d32c913009fd0f22c9987a6ca0e5cc70d77018fa29e547cc9`; expected size: `5972` bytes. If either differs, inspect Wikimedia's current original and record the new digest rather than silently accepting it.

Create `bart-logo.LICENSE.md` with:

```md
# BART logo asset

Source: https://en.wikipedia.org/wiki/File:Bart-logo.svg
Original file: https://en.wikipedia.org/wiki/Special:Redirect/file/Bart-logo.svg
Creator: San Francisco Bay Area Rapid Transit District (BART)

Wikimedia Commons describes this simple text/logo artwork as public domain for
copyright purposes. BART names and marks may still be protected by trademark;
the guidebook uses the logo only to identify BART service and does not imply
endorsement.

Vendored unchanged. SHA-256:
`6ccf60f929e4bc2d32c913009fd0f22c9987a6ca0e5cc70d77018fa29e547cc9`.
```

- [ ] **Step 4: Implement the reusable component and replace React placeholders**

```jsx
// app/src/components/BartLogo.jsx
import bartLogoUrl from '../assets/bart-logo.svg';

export default function BartLogo({ height = 18, decorative = false }) {
  return (
    <img
      src={bartLogoUrl}
      alt={decorative ? '' : 'BART'}
      aria-hidden={decorative ? 'true' : undefined}
      style={{ display: 'block', width: 'auto', height }}
    />
  );
}
```

In `LineBadge.jsx`, special-case BART while retaining the existing sized container:

```jsx
if (line === 'BART') {
  return (
    <div role="img" aria-label="BART" style={lineBadgeStyle(line, { size, fontSize })}>
      <BartLogo height={(size ?? 28) * 0.48} decorative />
    </div>
  );
}
```

In `TransitIdentity.jsx`, render `<BartLogo height={compact ? 10 : 12} decorative />` inside the already labeled transit mark. In `HowToRide.jsx`, use `<BartLogo height={18} />` standalone.

Import `bartLogoUrl` in `OnlineNearbyMap.jsx`; for `line === 'BART'`, make `lineDivIcon` put `<img src="${bartLogoUrl}" alt="" ...>` inside the existing pin instead of calling `lineLabel`. Keep train/color-line identity in React route displays.

- [ ] **Step 5: Prove all `ba` placeholders are gone and tests are GREEN**

Run:

```bash
cd app
npm test -- src/components/BartLogo.test.jsx src/components/nearby/__tests__/OnlineNearbyMap.test.jsx src/components/nearby/__tests__/JourneyTimeline.test.jsx src/components/nearby/__tests__/TripCard.test.jsx
! rg -n --glob '!**/*.json' --glob '!**/*.md' '(^|[>{[:space:]])ba([<}[:space:]]|$)' src
```

Expected: focused tests PASS and the placeholder scan returns no match.

- [ ] **Step 6: Commit the official identity change**

```bash
git add app/src/assets/bart-logo.svg app/src/assets/bart-logo.LICENSE.md app/src/components/BartLogo.jsx app/src/components/BartLogo.test.jsx app/src/components/LineBadge.jsx app/src/components/nearby/TransitIdentity.jsx app/src/components/screens/HowToRide.jsx app/src/components/nearby/OnlineNearbyMap.jsx app/src/components/nearby/__tests__
git commit -m "feat: use official BART identity"
```

---

### Task 2: Add Canonical Shortcuts and Restrict Search to Addresses/Localities

**Files:**
- Create: `app/src/components/nearby/QuickDestinations.jsx`
- Create: `app/src/components/nearby/__tests__/QuickDestinations.test.jsx`
- Create: `app/src/test/fixtures/here-geocode.json`
- Modify: `app/src/data/properties/sfcottage.json`
- Modify: `app/src/lib/hereSearch.js`
- Modify: `app/src/lib/__tests__/hereSearch.test.js`
- Modify: `app/src/hooks/useHereTripPlanner.js`
- Modify: `app/src/hooks/__tests__/useHereTripPlanner.test.jsx`
- Modify: `app/src/components/nearby/DestinationSearch.jsx`
- Modify: `app/src/components/nearby/__tests__/DestinationSearch.test.jsx`

**Interfaces:**
- Consumes: `property.transit.quickDestinations` in permanent display order.
- Produces: `QuickDestinations({ destinations, onSelect })`, where `onSelect(destination)` receives the exact structured object and does no search.
- Produces: `isAddressDestination(candidate) -> boolean` for HERE and saved-result filtering.
- Produces: `planner.selectDirectDestination(destination) -> Promise<routeResult>` that clears candidate/search state before routing.

- [ ] **Step 1: Write failing data, component, planner, and geocode tests**

Use this exact destination contract in test expectations:

```js
const expected = [
  ['cottage', '⌂ Take me back to the cottage', 'The SF Cottage', '251 Harold Ave, San Francisco, CA', 37.72260, -122.45470, 'property'],
  ['union-square', 'Downtown / Union Square', 'Union Square', 'Union Square, San Francisco, CA', 37.78782, -122.40748, 'locality'],
  ['sfo', 'SFO', 'San Francisco International Airport', 'San Francisco International Airport, CA', 37.62131, -122.37896, 'airport'],
  ['golden-gate-park', 'Golden Gate Park', 'Golden Gate Park', 'Golden Gate Park, San Francisco, CA', 37.77181, -122.48088, 'locality'],
  ['mission-district', 'The Mission', 'Mission District', 'Mission District, San Francisco, CA', 37.75993, -122.41808, 'locality'],
  ['ocean-beach', 'Ocean Beach', 'Ocean Beach', 'Ocean Beach, San Francisco, CA', 37.75975, -122.51016, 'locality'],
];
```

`QuickDestinations.test.jsx` must assert exact button order, one callback with the exact Mission object, and no search form/result-list ownership. `useHereTripPlanner.test.jsx` must first populate candidates, then call `selectDirectDestination`; assert candidates become empty, status becomes idle, selected destination is exact, and only route fetch runs.

Replace the discover fixture with geocode examples containing accepted `houseNumber`, `street`, `intersection`, `postalCodePoint`, `locality`, and `administrativeArea` items plus excluded `place` items. Assert categories/POI copy never reaches candidates and the URL is:

```js
expect(url.origin).toBe('https://geocode.search.hereapi.com');
expect(url.pathname).toBe('/v1/geocode');
expect(url.searchParams.get('q')).toBe('Mission District, San Francisco, CA');
expect(url.searchParams.get('at')).toBe('37.77154,-122.41761');
expect(url.searchParams.get('limit')).toBe('5');
expect(url.searchParams.get('lang')).toBe('en-US');
```

- [ ] **Step 2: Run tests to prove RED**

```bash
cd app
npm test -- src/components/nearby/__tests__/QuickDestinations.test.jsx src/lib/__tests__/hereSearch.test.js src/hooks/__tests__/useHereTripPlanner.test.jsx src/components/nearby/__tests__/DestinationSearch.test.jsx
```

Expected: FAIL because shortcuts/direct selection do not exist and search still calls Discover.

- [ ] **Step 3: Replace property strings with structured objects**

Replace `destSuggestions` with `quickDestinations`, mapping each tuple above to:

```json
{
  "id": "mission-district",
  "buttonLabel": "The Mission",
  "title": "Mission District",
  "address": "Mission District, San Francisco, CA",
  "position": { "lat": 37.75993, "lng": -122.41808 },
  "resultType": "locality",
  "categories": [],
  "distanceMeters": null
}
```

The first object is the cottage and all six remain in the exact approved order.

- [ ] **Step 4: Implement direct shortcuts and planner selection**

`QuickDestinations.jsx` maps the array without sorting and calls `onSelect(destination)` directly. Style the cottage button with the existing teal primary pill and the other five with the existing bordered white pill.

Add this planner action:

```js
const selectDirectDestination = useCallback(async (destination) => {
  searchAbortRef.current?.abort();
  setQuery(destination.title);
  setCandidates([]);
  setSearchStatus({ status: 'idle' });
  setSelectedDestination(destination);
  return requestRoutes(destination);
}, [requestRoutes]);
```

Return it from `useHereTripPlanner`. Keep `selectDestination` for accepted manual/saved search rows.

- [ ] **Step 5: Implement geocode-only normalization and hide saved POIs**

Use:

```js
const HERE_GEOCODE_URL = 'https://geocode.search.hereapi.com/v1/geocode';
const ADDRESS_RESULT_TYPES = new Set([
  'address', // legacy saved Discover address
  'houseNumber',
  'street',
  'intersection',
  'postalCodePoint',
  'locality',
  'administrativeArea',
]);

export function isAddressDestination(candidate) {
  return ADDRESS_RESULT_TYPES.has(String(candidate?.resultType ?? ''));
}
```

Build with `q`, `at=${center.lat},${center.lng}`, `limit=5`, `lang=en-US`, and `apiKey`. Filter before mapping. Set `categories: []`, and preserve finite `distance` only when HERE supplies it. Rename the cache prefix to `here-geocode` so old Discover POI entries can never satisfy the new query.

Change search copy to `Looking for addresses…`, `No matching address or neighborhood…`, and `Address search needs a connection…`. Remove the selected-destination summary block from `DestinationSearch`; retain candidate `aria-pressed`. Filter `saved.savedDestinations` with `isAddressDestination` before passing them from `Nearby` so stored POIs remain untouched but hidden.

- [ ] **Step 6: Run focused GREEN tests and commit**

```bash
cd app
npm test -- src/components/nearby/__tests__/QuickDestinations.test.jsx src/lib/__tests__/hereSearch.test.js src/hooks/__tests__/useHereTripPlanner.test.jsx src/components/nearby/__tests__/DestinationSearch.test.jsx
git add src/data/properties/sfcottage.json src/components/nearby/QuickDestinations.jsx src/components/nearby/__tests__/QuickDestinations.test.jsx src/test/fixtures/here-geocode.json src/lib/hereSearch.js src/lib/__tests__/hereSearch.test.js src/hooks/useHereTripPlanner.js src/hooks/__tests__/useHereTripPlanner.test.jsx src/components/nearby/DestinationSearch.jsx src/components/nearby/__tests__/DestinationSearch.test.jsx
git commit -m "feat: add direct destination shortcuts"
```

Expected: focused tests PASS; no provider search occurs when a quick destination is selected.

---

### Task 3: Build the HERE Nearby Station and Departure Adapter

**Files:**
- Create: `app/src/test/fixtures/here-stations.json`
- Create: `app/src/test/fixtures/here-departures.json`
- Create: `app/src/lib/hereNearbyTransit.js`
- Create: `app/src/lib/__tests__/hereNearbyTransit.test.js`

**Interfaces:**
- Produces: `buildHereStationsUrl(origin, apiKey) -> URL`.
- Produces: `buildHereDeparturesUrl(ids, apiKey) -> URL`.
- Produces: `normalizeHereStations(payload, origin) -> Station[]`.
- Produces: `normalizeHereDepartureBoards(payload) -> Map<string, Departure[]>`.
- Produces: `joinNearbyStations(stations, boards) -> NearbyStation[]`.
- Produces: `fetchHereNearbyTransit(origin, options) -> Promise<NearbyResult>`.
- `NearbyStation` is `{ id, memberIds, name, position, distanceMeters, services }`; each service is `{ key, agency, transport, headsign, departures }` and each departure is `{ scheduledTime, delaySeconds, isRealtime }`.

- [ ] **Step 1: Add representative provider fixtures**

Use provider-shaped fixtures containing at least:

```json
{
  "stations": [
    {
      "place": { "id": "3516_3408", "name": "Mission St & South Van Ness Ave", "location": { "lat": 37.772994, "lng": -122.418485 } },
      "transports": [{ "mode": "bus", "shortName": "14", "name": "14 Mission", "headsign": "Ferry Plaza" }]
    },
    {
      "place": { "id": "platform-a", "parent": { "id": "civic-center" }, "name": "Civic Center", "location": { "lat": 37.7795, "lng": -122.4137 } },
      "transports": [{ "mode": "subway", "shortName": "Yellow", "name": "Yellow Line" }]
    },
    {
      "place": { "id": "platform-b", "parent": { "id": "civic-center" }, "name": "Civic Center", "location": { "lat": 37.7796, "lng": -122.4138 } },
      "transports": [{ "mode": "metro", "shortName": "K", "name": "K Ingleside" }]
    }
  ]
}
```

Departure boards must include a finite positive delay, `delay: 0`, a departure without `delay`, more than two departures for one transport, a BART agency/line, and a station with an empty board.

- [ ] **Step 2: Write the failing adapter contract**

Tests must prove:

- station URL uses `in=37.77154,-122.41761;r=1200`, `maxPlaces=10`, `return=transport`, and never includes an API key in a cache key;
- departure URL uses the exact comma-separated member IDs plus `timespan=60`, `maxPerTransport=2`, and `sort=transport`;
- invalid position/ID/name/transport stations are dropped;
- distance is Haversine/geodesic and sorted nearest first;
- two platforms group only because their explicit parent ID matches, while same-name/no-parent stops remain separate;
- a grouped station retains both member IDs and merged transport metadata;
- departures join by member ID, group by operator/line/headsign, and cap at two per service;
- finite delay including zero sets `isRealtime: true`; missing delay sets false;
- empty departure boards leave a useful station with an empty departure list;
- only five nearest joined stations are returned;
- missing key, invalid request, abort, timeout, 401/403, 429, 5xx/network, and malformed JSON map to existing standardized reasons;
- no-store on either response prevents IndexedDB writes;
- two cacheable responses persist only through the earlier common expiry;
- fresh cache skips both network calls; expired cache is deleted and never returned.

- [ ] **Step 3: Run the adapter test to prove RED**

```bash
cd app
npm test -- src/lib/__tests__/hereNearbyTransit.test.js
```

Expected: FAIL because the adapter does not exist.

- [ ] **Step 4: Implement URL builders and normalizers**

Use constants and a credential-free coordinate bucket:

```js
const HERE_STATIONS_URL = 'https://transit.hereapi.com/v8/stations';
const HERE_DEPARTURES_URL = 'https://transit.hereapi.com/v8/departures';
const SEARCH_RADIUS_METERS = 1_200;
const MAX_PLACES = 10;
const MAX_STATIONS = 5;
const REQUEST_TIMEOUT_MS = 10_000;

function cacheKey(origin) {
  return `here-nearby:${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}`;
}

export function buildHereStationsUrl(origin, apiKey) {
  const url = new URL(HERE_STATIONS_URL);
  url.searchParams.set('in', `${origin.lat},${origin.lng};r=${SEARCH_RADIUS_METERS}`);
  url.searchParams.set('maxPlaces', String(MAX_PLACES));
  url.searchParams.set('return', 'transport');
  url.searchParams.set('apiKey', apiKey);
  return url;
}

export function buildHereDeparturesUrl(ids, apiKey) {
  const url = new URL(HERE_DEPARTURES_URL);
  url.searchParams.set('ids', ids.join(','));
  url.searchParams.set('timespan', '60');
  url.searchParams.set('maxPerTransport', '2');
  url.searchParams.set('sort', 'transport');
  url.searchParams.set('apiKey', apiKey);
  return url;
}
```

Group stations with `(typeof place.parent === 'string' ? place.parent : place.parent?.id) || place.parentId || place.id`; never use names as a key. Keep the closest member's name/location and union exact transport records/member IDs. Use an inline Haversine helper with Earth radius `6_371_000` meters. Normalize both `station.transports` and a single/array `station.transport` defensively.

Normalize boards from `payload.boards`. A departure is valid only with a parseable `time` and useful `transport`; preserve the finite numeric `delay` exactly, including zero. Group services by normalized agency ID/name, mode, short name/name, and headsign, sort departures by effective epoch (`Date.parse(scheduledTime) + (delaySeconds ?? 0) * 1000`), and slice to two.

- [ ] **Step 5: Implement the two-request cache/failure flow**

Validate origin/key before storage or fetch. Check `providerResponseStore` first, then execute the whole two-request loader through `sharedProviderRequest`. Request stations; if none normalize, return success with `stations: []` without requesting departures, using only the station response's permitted expiry for that empty result. Otherwise request departures for every `memberIds` value.

Compute:

```js
const stationsExpiry = cacheUntilFromHeaders(stationsResponse.headers, fetchedAt);
const departuresExpiry = cacheUntilFromHeaders(departuresResponse.headers, fetchedAt);
const expiresAt =
  stationsExpiry > fetchedAt && departuresExpiry > fetchedAt
    ? Math.min(stationsExpiry, departuresExpiry)
    : null;
```

Persist only when `expiresAt !== null`. Store `{ stations }`, never raw responses or URLs. Return `{ ok: true, stations, source: 'network'|'cache', fetchedAt, expiresAt }` or `{ ok: false, reason }`.

- [ ] **Step 6: Run GREEN, inspect credential boundaries, and commit**

```bash
cd app
npm test -- src/lib/__tests__/hereNearbyTransit.test.js src/lib/__tests__/cachePolicy.test.js src/lib/__tests__/providerFetch.test.js src/lib/__tests__/responseStore.test.js
! rg -n 'test-key-not-a-credential' src/test/fixtures
git add src/test/fixtures/here-stations.json src/test/fixtures/here-departures.json src/lib/hereNearbyTransit.js src/lib/__tests__/hereNearbyTransit.test.js
git commit -m "feat: fetch nearby HERE departures"
```

Expected: adapter/storage tests PASS, fixtures contain no credential, and the result is capped to five distance-ordered physical stations.

---

### Task 4: Add the Active-Origin Hook and Honest Departure Board

**Files:**
- Create: `app/src/hooks/useNearbyTransit.js`
- Create: `app/src/hooks/__tests__/useNearbyTransit.test.jsx`
- Create: `app/src/components/nearby/NearbyDepartures.jsx`
- Create: `app/src/components/nearby/__tests__/NearbyDepartures.test.jsx`

**Interfaces:**
- Consumes: `useNearbyTransit({ origin, enabled })`.
- Produces: `{ result, refresh }`, where `result` is null while the current origin is loading and can never expose a previous origin's stations.
- Consumes: `NearbyDepartures({ result, onRetry })`.
- Produces: loading, explicit unavailable, empty, or at-most-five station rows.

- [ ] **Step 1: Write failing hook lifecycle tests**

Mirror the keyed-publication pattern in `useWalkingRoute.test.jsx`, but use origin keys. Prove:

1. `enabled: false` does no work;
2. enabling with Howard calls `fetchHereNearbyTransit(origin, { signal })`;
3. changing Howard → cottage aborts the first call and returns `result: null` on the first changed-origin render;
4. a late Howard success cannot overwrite a newer cottage success;
5. disabling/unmounting aborts and clears timers;
6. a failure is published without static fallback data;
7. `refresh()` clears a failure and retries;
8. fake timers do not trigger before 300,000 ms;
9. `expiresAt` later than five minutes delays refresh until expiry.

- [ ] **Step 2: Write failing departure-board rendering tests**

Assert exact UI outcomes:

- null: `Finding nearby departures…`;
- failure: heading plus `Nearby departures unavailable` and a retry button;
- success/empty: `No nearby transit found`;
- station: name and `0.2 mi away`, operator/line/train-or-bus identity, headsign, up to two times;
- `delaySeconds: 0` renders `Live`;
- missing delay renders `Scheduled`;
- no departures renders `No departures in the next hour`;
- no `min walk`, `Curated schedule`, Ocean Avenue, Plymouth Avenue, or Balboa Park fixture copy appears.

- [ ] **Step 3: Run focused tests to prove RED**

```bash
cd app
npm test -- src/hooks/__tests__/useNearbyTransit.test.jsx src/components/nearby/__tests__/NearbyDepartures.test.jsx
```

Expected: FAIL because neither module exists.

- [ ] **Step 4: Implement keyed hook publication and polling**

Use this publication shape:

```js
const originKey = isFinitePosition(origin) ? `${origin.lat},${origin.lng}` : '';
const [published, setPublished] = useState({ originKey: '', result: null });
const result = published.originKey === originKey ? published.result : null;
```

On every origin-key change, abort the prior controller, clear the timer, and reset publication before requesting. After a current request settles, publish only when controller and origin key still match. Schedule the next request after:

```js
Math.max(300_000, Number(result.expiresAt ?? 0) - Date.now())
```

Do not use `setInterval`; one `setTimeout` after each settled current request prevents overlapping polls. `refresh()` cancels the pending timer and starts a new request only while enabled/current.

- [ ] **Step 5: Implement the board using shared transit identities**

For each service, construct the normalized section expected by `TransitIdentity`:

```js
const section = {
  type: 'transit',
  agency: service.agency,
  transport: service.transport,
};
```

Format distance as `${(distanceMeters / 1609.344).toFixed(1)} mi away`. Format effective departure timestamps in local time, retaining each departure's `Live`/`Scheduled` label. Give the outer section `aria-label="Nearby departures"`; do not attach an alert/live-region role to normal refreshes.

- [ ] **Step 6: Run GREEN and commit**

```bash
cd app
npm test -- src/hooks/__tests__/useNearbyTransit.test.jsx src/components/nearby/__tests__/NearbyDepartures.test.jsx src/components/nearby/__tests__/LiveStatus.test.jsx
git add src/hooks/useNearbyTransit.js src/hooks/__tests__/useNearbyTransit.test.jsx src/components/nearby/NearbyDepartures.jsx src/components/nearby/__tests__/NearbyDepartures.test.jsx
git commit -m "feat: show active-location departures"
```

Expected: focused tests PASS, with no static station or curated-time fallback.

---

### Task 5: Reduce Collapsed Warnings to One Affected-Line Indicator

**Files:**
- Modify: `app/src/lib/tripWarnings.js`
- Modify: `app/src/lib/__tests__/tripWarnings.test.js`
- Modify: `app/src/components/nearby/TransitIdentity.jsx`
- Modify: `app/src/components/nearby/JourneyTimeline.jsx`
- Modify: `app/src/components/nearby/TripCard.jsx`
- Modify: `app/src/components/nearby/TripWarnings.jsx`
- Modify: corresponding component tests

**Interfaces:**
- Extends each warning to `{ ..., sectionIds: string[] }`.
- Extends `JourneyTimeline({ sections, advisorySectionIds })`.
- Extends `TransitIdentity({ section, compact, hasAdvisory })`.
- Preserves complete `TripWarnings({ warnings })` only in the expanded itinerary.

- [ ] **Step 1: Write failing association and UI tests**

Add library tests proving:

- a 511 K entity adds only the matching K section ID in a K + 38R trip;
- one alert matching two sections includes both IDs;
- a HERE section incident and section notice include that section ID;
- a trip-level HERE notice has `sectionIds: []`;
- ID/text deduplication merges all associated section IDs instead of dropping later associations.

Replace the old TripCard compact-warning test with:

```jsx
const warning = {
  id: 'k-alert',
  header: 'K service delay',
  description: 'Allow extra travel time.',
  severity: 'SIGNIFICANT_DELAYS',
  source: '511',
  url: 'https://example.test/k-alert',
  sectionIds: ['s2'],
};

expect(screen.queryByText('K service delay')).not.toBeInTheDocument();
expect(screen.getByLabelText('Service advisory in full itinerary')).toHaveTextContent('!');
expect(screen.getAllByLabelText(/Muni .* train|bus/)).toHaveLength(2);
```

After rerendering expanded, assert warning header/description occur once above itinerary steps. Assert the 38R identity has no advisory sibling, an unscoped warning adds no indicator, and the indicator has neither `role="alert"` nor `aria-live`.

- [ ] **Step 2: Run warning tests to prove RED**

```bash
cd app
npm test -- src/lib/__tests__/tripWarnings.test.js src/components/nearby/__tests__/JourneyTimeline.test.jsx src/components/nearby/__tests__/TripCard.test.jsx src/components/nearby/__tests__/TripWarnings.test.jsx
```

Expected: FAIL because warnings have no section associations and collapsed cards render warning copy.

- [ ] **Step 3: Attach exact section IDs and merge them during deduplication**

Use one stable helper everywhere:

```js
function sectionId(section, index) {
  return String(section?.id ?? `section:${index}`);
}
```

For 511, collect every matching transit leg rather than returning from `some`. For HERE, build trip notices separately from section notices/incidents. Replace filter-only deduplication with a reducer keyed by provider ID when present, otherwise normalized header/description; merge IDs with:

```js
existing.sectionIds = [...new Set([
  ...(existing.sectionIds ?? []),
  ...(warning.sectionIds ?? []),
])];
```

- [ ] **Step 4: Render the subtle accessible indicator and remove compact detail**

In `TripCard`:

```js
const advisorySectionIds = new Set(
  warnings.flatMap((warning) => warning.sectionIds ?? []),
);
```

Pass it to `JourneyTimeline` and delete `<TripWarnings warnings={warnings} compact />`. Keep exactly one `<TripWarnings warnings={warnings} />` inside the expanded branch, above `ItinerarySteps`.

In `TransitIdentity`, keep the labeled identity and indicator as siblings so `role="img"` does not flatten the indicator from the accessibility tree:

```jsx
<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
  <span
    role="img"
    aria-label={identity.accessibleLabel}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
  >
    {identity.operator === 'muni' ? (
      <MuniLogo height={compact ? 10 : 12} decorative />
    ) : null}
    {identity.operator === 'bart' ? (
      <BartLogo height={compact ? 10 : 12} decorative />
    ) : null}
    {identity.operator === 'other' ? (
      <span aria-hidden="true">{identity.operatorLabel}</span>
    ) : null}
    <JourneyIcon type={identity.vehicle} />
    <span
      aria-hidden="true"
      style={{
        borderRadius: 999,
        padding: '2px 6px',
        background: identity.color,
        color: identity.foreground,
        fontWeight: 700,
      }}
    >
      {identity.lineLabel}
    </span>
  </span>
  {hasAdvisory ? (
    <span
      role="img"
      aria-label="Service advisory in full itinerary"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 16, height: 16, borderRadius: '50%', background: '#F4C84A',
        color: '#14201D', fontSize: 11, fontWeight: 800,
      }}
    >
      !
    </span>
  ) : null}
</span>
```

Remove the unused compact branch/API from `TripWarnings` and update its focused test to cover detailed rendering only.

- [ ] **Step 5: Run GREEN, scan collapsed copy, and commit**

```bash
cd app
npm test -- src/lib/__tests__/tripWarnings.test.js src/components/nearby/__tests__/JourneyTimeline.test.jsx src/components/nearby/__tests__/TripCard.test.jsx src/components/nearby/__tests__/TripWarnings.test.jsx src/components/nearby/__tests__/TripOptions.test.jsx
! rg -n '<TripWarnings[^>]*compact|compact.*TripWarnings' src
git add src/lib/tripWarnings.js src/lib/__tests__/tripWarnings.test.js src/components/nearby/TransitIdentity.jsx src/components/nearby/JourneyTimeline.jsx src/components/nearby/TripCard.jsx src/components/nearby/TripWarnings.jsx src/components/nearby/__tests__
git commit -m "fix: keep route warnings in full itineraries"
```

Expected: relevant route matching remains conservative; only affected collapsed line identities receive the quiet indicator.

---

### Task 6: Compose the Approved Nearby Hierarchy and Map Semantics

**Files:**
- Modify: `app/src/lib/geo.js`
- Modify: `app/src/context/AppContext.jsx`
- Modify: `app/src/context/__tests__/AppContext.test.jsx`
- Modify: `app/src/components/nearby/OnlineNearbyMap.jsx`
- Modify: `app/src/components/nearby/__tests__/OnlineNearbyMap.test.jsx`
- Modify: `app/src/components/screens/Nearby.jsx`
- Modify: `app/src/components/screens/Nearby.test.jsx`

**Interfaces:**
- `coords.source` is `device`, `stay-override`, or `cottage` after location resolution.
- `NeighborhoodMap.stops` receives current dynamic HERE station markers or `[]`, never the static cottage board.
- The active marker popup/title is exactly `You`; stay address remains only in the external status text.

- [ ] **Step 1: Write failing origin-source and map-marker tests**

In geo/context tests assert browser geolocation publishes `source: 'device'`, explicit cottage choice/failure publishes `source: 'cottage'`, and stay override remains `source: 'stay-override'`.

Change the online-map test to capture `Marker.title`, then assert:

```jsx
expect(meMarker).toHaveAttribute('data-title', 'You');
expect(within(meMarker).getByTestId('popup')).toHaveTextContent(/^You$/);
expect(within(meMarker).getByTestId('popup')).not.toHaveTextContent('1620 Howard');
```

Keep the separate cottage marker test.

- [ ] **Step 2: Write the failing Nearby hierarchy/integration tests**

Mock `useNearbyTransit` with a Howard result whose first station is `Mission St & South Van Ness Ave`. Assert DOM order with `compareDocumentPosition`:

1. destination form;
2. six-button shortcut group;
3. back-home instructions when cottage is selected;
4. selected summary/mode/routes;
5. map;
6. nearby departures.

Also assert:

- shortcuts have the exact approved order;
- clicking The Mission calls no search, routes immediately to exact `Mission District, San Francisco, CA`, and exposes no candidate list;
- location status shows `Using location: 1620 Howard St, San Francisco`;
- the mocked map gets Howard as center, `showMe=true`, no location label, and current result stations as stops;
- the board/map never contains `Ocean Ave & Lee St`, `Plymouth Ave & Ocean`, `Balboa Park`, or `Curated schedule`;
- provider failure passes `[]` to the map and renders only `Nearby departures unavailable`;
- changing active coordinates never exposes an earlier location's mocked result.

- [ ] **Step 3: Run integration tests to prove RED**

```bash
cd app
npm test -- src/context/__tests__/AppContext.test.jsx src/components/nearby/__tests__/OnlineNearbyMap.test.jsx src/components/screens/Nearby.test.jsx
```

Expected: FAIL because the old page renders map/static stops before shortcuts and labels the marker with the stay address.

- [ ] **Step 4: Make origin provenance explicit**

Return `{ lat, lng, source: 'device' }` from `getCurrentPosition`. Set `{ lat, lng, source: 'cottage' }` in both cottage fallback paths. Derive:

```js
const showMe = coords?.source === 'device' || coords?.source === 'stay-override';
```

Extra `source` metadata must not enter HERE URL parameters; adapters read only `lat` and `lng`.

- [ ] **Step 5: Recompose Nearby in the approved order**

Remove `useLiveDepartures`, `distanceMiles` stop-direction sorting, `stopHeadsToward`, `LiveStatus`, and every render of `property.transit.nearbyStops` from `Nearby.jsx`. Add:

```js
const nearby = useNearbyTransit({ origin, enabled: located && isFinitePosition(origin) });
const mapStops = nearby.result?.ok ? nearby.result.stations.map((station) => {
  const firstService = station.services[0];
  const agency = [firstService?.agency?.id, firstService?.agency?.name]
    .filter(Boolean)
    .join(' ');
  return {
    name: station.name,
    sub: station.services.map((service) =>
      service.transport.shortName || service.transport.name,
    ).filter(Boolean).join(' · '),
    line: /BART|BAY AREA RAPID TRANSIT/i.test(agency)
      ? 'BART'
      : firstService?.transport?.shortName || 'TRANSIT',
    lat: station.position.lat,
    lng: station.position.lng,
  };
}) : [];
```

Immediately after `DestinationSearch`, render `QuickDestinations`. Its callback calls `planner.selectDirectDestination(destination)`; set `backOpen` only when `destination.resultType === 'property'`. Render back-home instructions next. Then render a selected-destination summary with a clear button, mode selector, and mode content. Render map next, then `<NearbyDepartures result={nearby.result} onRetry={nearby.refresh} />`, then the existing first-time guidance.

Pass `saved.savedDestinations.filter(isAddressDestination)` to search. The cottage shortcut uses the structured property object; delete the hand-built `cottageDestination` and old free-form search handlers.

- [ ] **Step 6: Make the active map marker exactly `You`**

Remove `locationLabel` from `OnlineNearbyMap` props. Render:

```jsx
{showMe && (
  <Marker title="You" position={[center.lat, center.lng]} icon={meIcon}>
    <Popup>You</Popup>
  </Marker>
)}
```

Keep `Using location: …` in `Nearby` status text only. Dynamic station markers use the current hook result; unavailable/loading location data does not resurrect cottage stops.

- [ ] **Step 7: Run focused GREEN, then the Nearby regression set**

```bash
cd app
npm test -- src/context/__tests__/AppContext.test.jsx src/components/nearby/__tests__/OnlineNearbyMap.test.jsx src/components/nearby/__tests__/NeighborhoodMap.test.jsx src/components/screens/Nearby.test.jsx src/hooks/__tests__/useHereTripPlanner.test.jsx src/hooks/__tests__/useNearbyTransit.test.jsx
```

Expected: all PASS; exact DOM hierarchy and Howard-origin honesty are covered.

- [ ] **Step 8: Commit the page integration**

```bash
git add app/src/lib/geo.js app/src/context/AppContext.jsx app/src/context/__tests__/AppContext.test.jsx app/src/components/nearby/OnlineNearbyMap.jsx app/src/components/nearby/__tests__/OnlineNearbyMap.test.jsx app/src/components/screens/Nearby.jsx app/src/components/screens/Nearby.test.jsx
git commit -m "feat: make nearby transit location aware"
```

---

### Task 7: Documentation, Full Verification, Review, PR, and Live Smoke

**Files:**
- Modify: `app/README.md`
- Modify only on verified failures: exact source/test files implicated by the failure.

**Interfaces:**
- Consumes: complete feature branch and configured local/CI HERE credential.
- Produces: documented behavior, green local gate, reviewed PR, and reproducible 1620 Howard smoke evidence.

- [ ] **Step 1: Update operational documentation**

Document that Nearby uses HERE stations/departures from the active consented origin, refreshes no sooner than five minutes, stores only header-permitted normalized results, and shows unavailable rather than property fallback rows. State that search is address/locality-only and quick destinations are property-controlled. Link `src/assets/bart-logo.LICENSE.md` from the asset/provider note.

- [ ] **Step 2: Run the complete local gate fresh**

```bash
cd app
npm test
npm run lint
npm run build
cd ..
git diff --check origin/main...HEAD
```

Expected: all tests PASS, lint exits 0, production PWA build exits 0, and diff check is clean.

- [ ] **Step 3: Run falsifiable scope/security scans**

```bash
! rg -n --glob '!**/*.md' --glob '!**/*.test.*' 'Curated schedule|Current SF service alerts|BART\.gov Alert' app/src/components
! rg -n --glob '!**/*.md' --glob '!**/*.test.*' 'destSuggestions|discover\.search\.hereapi\.com' app/src
! rg -n --glob '!**/*.json' --glob '!**/*.md' '(^|[>{[:space:]])ba([<}[:space:]]|$)' app/src
! git diff origin/main...HEAD -- app/src/components/screens/Explore.jsx | rg '.'
! git diff origin/main...HEAD -- app/src/data/properties/sfcottage.json | rg '"explore"|"food"|"poi"'
! git diff origin/main...HEAD | rg 'VITE_HERE_API_KEY=|VITE_511_TOKEN=|apiKey=[A-Za-z0-9_-]{16,}'
```

Expected: no collapsed/general alert surface, old Discover/search strings, BART placeholder, POI-surface change, or credential-like diff.

- [ ] **Step 4: Self-review exact specification coverage**

Read `git diff origin/main...HEAD` and check each acceptance criterion in the approved design. Specifically verify type consistency across the provider → hook → component station model, warning `sectionIds`, destination result types, and `coords.source`. Search for unused imports, obsolete props, duplicate warning rendering, static stop reads in `Nearby`, and cache writes outside the shared expiry.

If any issue is found, add a focused test that fails, apply the smallest fix, rerun its focused suite, then restart Task 7 at Step 2.

- [ ] **Step 5: Request code review and process only verified findings**

Use `superpowers:requesting-code-review` on `origin/main...HEAD`. Any Critical or Important finding requires a falsifiable RED test and focused fix before re-review. Re-run the full gate on the final reviewed head.

- [ ] **Step 6: Run production-preview mobile smoke at 1620 Howard**

Start the built app network-accessibly:

```bash
cd app
npm run preview -- --host 0.0.0.0
```

At a 430×900 viewport in a fresh browser context, use the documented fake-stay hash with `{ label: '1620 Howard St, San Francisco', lat: 37.77154, lng: -122.41761 }`, select **Allow location**, then verify:

1. `Using location: 1620 Howard St, San Francisco` appears, while the active map marker popup/title is exactly `You`;
2. search is followed immediately by the six shortcuts in approved order;
3. The Mission directly selects `Mission District, San Francisco, CA` and renders a route without a candidate group;
4. instructions/results occur below shortcuts and the map occurs below them;
5. the station request uses `37.77154,-122.41761`, the board contains no cottage stop names, and there are at most five distance-ordered stations;
6. each departure is `Live` or `Scheduled`, with no curated schedule/walking-minute claim;
7. an affected collapsed transit line shows only a yellow `!`; expanding full itinerary reveals warning detail once; unrelated lines have no indicator;
8. BART surfaces load the bundled SVG and show train/color-line identity;
9. zero page errors, unexpected console errors, credential-bearing cache keys, HERE entries contrary to response headers, or provider URLs in Cache Storage.

If live HERE returns no BART itinerary during the smoke, use the automated BART fixture proof for that assertion and record that the live path was unavailable rather than changing destination semantics.

- [ ] **Step 7: Finish the branch through a PR**

Use `superpowers:finishing-a-development-branch`. On the PR path, push the feature branch and open a PR describing canonical shortcuts, geocode-only search, HERE station boards, active map semantics, collapsed-warning restraint, official BART identity, tests, and explicit POI/static-fallback non-goals. Do not merge or deploy without the user's later authorization.

- [ ] **Step 8: Verify PR checks and report handoff evidence**

Wait for every check on the exact head SHA, inspect unresolved review threads, and rerun any failed check locally before changing code. Report the plan/spec links, PR URL, exact head SHA, complete test count, lint/build result, Howard smoke observations, and any live-provider limitation. Do not claim the feature complete or deployed until all required evidence exists.

---

## Primary References

- Approved design: `docs/superpowers/specs/2026-07-30-location-aware-nearby-design.md`
- HERE station search: https://docs.here.com/transit/reference/getstations
- HERE next departures: https://docs.here.com/transit/reference/getdepartures
- 511 transit API constraints: https://511.org/open-data/transit
- BART logo source/license description: https://en.wikipedia.org/wiki/File:Bart-logo.svg
