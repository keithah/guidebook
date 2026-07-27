# The SF Cottage — Guidebook

A guest guidebook PWA for The SF Cottage, implementing the "Fog" design
direction from `../project/Fog Guidebook.dc.html` (see `../README.md` and
`../chats/chat1.md` for the design history). Built with React + Vite.

## Running it

```
npm install
npm run dev
```

Open the printed localhost URL. The app is phone-width (max 430px) by
design — resize your browser or use device emulation.

```
npm run build   # production build to dist/
npm run preview # serve the production build locally
```

## Content

All copy lives in `src/data/properties/sfcottage.json` — rooms, transit,
food, explore places, emergency info, etc. Fields with a `_todo` sibling key
are plausible stand-ins (call it "the SF Cottage" and it works, but codes,
WiFi credentials, the host phone number, and the nearest hospital are all
placeholders) — replace them with the real values before this goes live for
actual guests. This mirrors the multi-property design in `uploads/SPEC.md`:
adding a second property later means adding another JSON file under
`properties/` and pointing the app at it.

## Guest links (`/sfcottage#<hash>`)

Per the spec, a guest's per-stay link carries their name, dates, and access
code so the home screen can go stay-phase-aware (before / during /
checkout) and show the door code. The real version of this is meant to come
from an Airbnb-scraping injection pipeline that doesn't exist yet ("defined
later" in the spec) — what's implemented here is the **consuming half**:
`src/lib/stayHash.js` decodes a base64url-encoded JSON payload
(`{ guestName, checkin, checkout, code }`) from the URL hash and derives the
stay phase from today's date.

Until the real pipeline exists, generic mode (no hash) shows a small "Dev:
preview a guest stay link" control at the bottom of the home screen that
builds one of these hashes for you — it's dev chrome, not part of the
design, and disappears once real links are being issued by something else.

You can also override the derived phase for a guest link with
`?phase=before|during|checkout` while testing.

## Live data

- **Weather** — `src/lib/weather.js` calls api.weather.gov (NWS), no API key
  needed. Falls back to the mockup's static copy if the request fails.
- **Transit departures** — `src/lib/transit511.js` is wired for the 511.org
  Transit API, but needs a free API key (`VITE_API_511_KEY` in `.env`) *and*
  real 511 stop codes per stop (the ones in `sfcottage.json` are flagged
  `_todo`, since they weren't available while building this). Until both
  exist, the app falls back to the static departure times already in the
  JSON — this is intentional graceful degradation, not a bug.
- **Map** — `src/components/NearbyMap.jsx` is a real Leaflet/OpenStreetMap
  map (no key needed), with geolocation via the browser's own permission
  prompt (`src/lib/geo.js`).
- **Photos** — `src/components/ImageSlot.jsx` lets you drag/drop or tap to
  upload a photo for each placeholder (cottage exterior, gate/door keypad).
  They're stored client-side (resized, as a data URL in `localStorage`) —
  fine for a single host filling in their own photos once, but a real
  multi-property deploy should eventually swap these for checked-in static
  assets instead.

## PWA / offline

`vite-plugin-pwa` generates the manifest and service worker (see
`vite.config.js`). App shell assets are precached; map tiles, weather, and
511 responses use network-first/cache-first runtime caching so the app
still opens something useful offline, per the spec's "installable PWA...
cached for offline use, live data degrades gracefully."
