# The SF Cottage — Guidebook

A phone-width React/Vite PWA for guests at The SF Cottage. The app combines
curated property content with live Bay Area place search, door-to-door transit
itineraries, nearby departures, service alerts, and an offline neighborhood
orientation map.

## Local setup

Use Node.js 22 or newer, then install dependencies and copy the environment
template:

```sh
npm install
cp .env.example .env
```

Set both values in the ignored `.env` file; never commit or paste either key
into source code:

```dotenv
VITE_HERE_API_KEY=
VITE_API_511_KEY=
```

- `VITE_HERE_API_KEY` is a browser key for HERE Discover and HERE Public
  Transit Routing. In HERE Access Manager, restrict it to the origins used by
  this app: `https://keithah.github.io`, `http://localhost:5173`, and
  `http://127.0.0.1:4173`. Add another exact local origin only when intentionally
  running Vite on a different host or port.
- `VITE_API_511_KEY` is a 511 Open Data token from
  <https://511.org/open-data/token>.

Start the development server with `npm run dev` and open
`http://localhost:5173/guidebook/`. The app is designed for a maximum width of
430 px, so use a phone viewport or resize the browser when checking layout.

## Provider responsibilities

- HERE Discover returns up to five destination candidates. A guest must choose
  the intended candidate; the app never silently selects the first result.
- HERE Public Transit Routing returns up to three complete door-to-door
  itineraries, including walking, transit, transfers, intermediate stops, and
  the final arrival.
- 511 supplies authoritative nearby departure boards and San Francisco service
  alerts. Curated times and instructions in
  `src/data/properties/sfcottage.json` remain available when live data fails.

The UI labels a network response `Live`, an unexpired stored response `Cached`,
and a stored 511 response shown after a failed refresh `Last known`. Departure
data is fresh for five minutes and may be shown as last known for at most 30
minutes from retrieval. Alert data is fresh for ten minutes and may be shown as
last known for at most 60 minutes from retrieval.

HERE responses are persisted only when HERE's HTTP caching headers explicitly
allow it. Current HERE `no-store` responses remain in application memory only
for the active session and do not enter IndexedDB or Cache Storage.

## Storage and offline boundaries

The generated Workbox service worker precaches the application shell, checked-in
images, property data bundled with the app, and
`public/images/ingleside-neighborhood.svg`. Its only runtime caches are NWS
weather and Google Fonts. Standard OpenStreetMap tiles, HERE responses, and 511
responses are never stored in service-worker Cache Storage.

IndexedDB database `sfcottage-guidebook` has two separate stores:

- `providerResponses` stores normalized 511 data and only those normalized HERE
  responses whose caching headers permit persistence.
- `savedState` stores user-saved destination candidates.

Both stores use credential-free logical keys. Raw provider payloads, request
URLs, request headers, and API keys are not persisted. Other guest preferences
and uploaded placeholder photos use existing browser-local storage.

When the live Leaflet map cannot load, the app displays the packaged
OSM-derived orientation map with visible OpenStreetMap attribution. Refresh it
intentionally from the `app` directory with:

```sh
node scripts/generate-offline-map.mjs
```

Regeneration fetches the fixed bounds documented in
`public/images/ingleside-neighborhood.md`. Commit the generated SVG and update
that provenance file's generation date if the source is refreshed. Preserve
both the in-SVG `© OpenStreetMap contributors · ODbL` notice and the visible
linked OpenStreetMap attribution in the app.

## Verification and deployment

Run the complete automated gate:

```sh
npm test
npm run lint
npm run build
```

`npm run build` writes the GitHub Pages production bundle to `dist/` using the
base path `/guidebook/`. To inspect that exact bundle locally:

```sh
npm run preview -- --host 127.0.0.1
```

Open `http://127.0.0.1:4173/guidebook/`. For the offline smoke test, first load
the preview online and exercise destination search and a route. In browser
DevTools, switch Network to Offline and reload. Confirm the shell, property
content, photographs, and attributed offline map remain readable; a new route
search should explain that a connection is required instead of showing a blank
screen. Restore Network to Online and confirm the live map and retry controls
recover.

Before deployment, also inspect DevTools Application:

- Cache Storage should contain the Workbox precache with
  `images/ingleside-neighborhood.svg`, and no OSM tile, HERE, or 511 response.
- IndexedDB should contain only normalized logical keys without credentials.
  With current HERE `no-store` headers, no HERE provider entry should remain.

Deploy `dist/` to the `keithah.github.io/guidebook/` project path after the
automated gate and production-preview smoke test pass.

## Content and guest links

Property copy lives in `src/data/properties/sfcottage.json`. Fields with a
`_todo` sibling are stand-ins that must be replaced before real guest use.

Guest links use `/sfcottage#<hash>`, where the hash is base64url-encoded JSON
with this shape:

```js
{
  guestName,
  checkin,
  checkout,
  code,
  fakeLocation: {
    label: '1620 Howard St, San Francisco',
    lat: 37.77154,
    lng: -122.41761
  }
}
```

`fakeLocation` is optional and intended for preview/testing links. A valid
override applies only after the guest selects **Allow location**; an invalid
override is ignored. The payload stays in the URL fragment. Base64url encoding
is not encryption, so do not put secrets in the payload.

`src/lib/stayHash.js` decodes the hash and derives the stay phase. Until the
upstream link-creation pipeline exists, generic mode exposes a development
preview control on the home screen. Use `?phase=before|during|checkout` to
override the derived phase while testing.
