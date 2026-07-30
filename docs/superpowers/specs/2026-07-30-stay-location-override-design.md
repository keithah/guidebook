# Stay-Link Location Override Design

## Goal

Allow a guest-preview URL to supply a fake current location so testing the app's **Allow location** flow can use `1620 Howard St, San Francisco` instead of browser geolocation. The fake location must drive the same downstream map, distance, and HERE routing behavior as a real browser location while leaving the cottage itself unchanged.

## Non-goals

- Do not change the property's stored address, coordinates, weather location, transit stop configuration, or cottage marker.
- Do not geocode an address at runtime.
- Do not bypass or monkey-patch the browser Geolocation API.
- Do not change existing stay links that omit the override.

## Stay-link contract

The existing base64url-encoded JSON stay payload gains one optional field:

```js
{
  guestName: 'Jamie',
  checkin: '2026-07-30',
  checkout: '2026-08-03',
  code: '2468',
  fakeLocation: {
    label: '1620 Howard St, San Francisco',
    lat: 37.77154,
    lng: -122.41761
  }
}
```

The location is kept in the URL fragment with the rest of the stay payload, so it is decoded entirely in the browser and is not sent to GitHub Pages in the HTTP request. Base64url is encoding, not encryption; guest-link contents remain inspectable by anyone who receives the link.

## Validation boundary

`app/src/lib/stayHash.js` will export a focused helper that accepts decoded stay data and returns either a normalized override or `null`. A valid override requires:

- a non-empty string `label`, trimmed before use;
- a finite numeric latitude from -90 through 90;
- a finite numeric longitude from -180 through 180.

The normalized value will be `{ label, lat, lng, source: 'stay-override' }`. Invalid or incomplete overrides are ignored; they never block the stay itself from decoding.

## Location flow

`AppContext` keeps the existing explicit-consent interaction. The override is not activated merely by opening the URL. When the guest taps **Allow location**:

1. If the decoded stay contains a valid override, set it as `coords`, mark location as enabled, and do not call `navigator.geolocation`.
2. Otherwise, run the existing browser geolocation path unchanged.
3. If real geolocation fails, retain the existing cottage fallback and error copy.

Because the override enters through the existing `coords` state, it automatically becomes the HERE trip origin, map center and “you” marker, and the reference point for nearby-distance behavior. Weather continues to use `property.address` and therefore remains cottage weather.

## Guest-visible behavior

When the active coordinates came from a stay override, the Nearby screen will show `Using location: 1620 Howard St, San Francisco` above the map. The user-location marker popup will read `You are here · 1620 Howard St, San Francisco`.

Real browser locations retain the existing generic `You are here` popup and do not display a fabricated address. Choosing **Not now — use the cottage as my location** continues to use the cottage and shows no override label.

## Files and responsibilities

- `app/src/lib/stayHash.js`: validate and normalize the optional `fakeLocation` payload.
- `app/src/context/AppContext.jsx`: choose the validated override before requesting browser geolocation.
- `app/src/components/screens/Nearby.jsx`: show the active override label and pass it to the map.
- `app/src/components/nearby/OnlineNearbyMap.jsx`: render the optional label in the user-marker popup.
- Existing focused test files cover each boundary; a new `stayHash` test file covers payload validation.

## Error handling and compatibility

- Existing hashes without `fakeLocation` behave exactly as they do now.
- A malformed override falls back to real geolocation rather than the cottage immediately.
- Extra fields in a decoded stay remain tolerated for backward compatibility.
- The label is rendered as React text, not injected as HTML.
- No location override is persisted outside the link and current in-memory app session.

## Testing

- Unit tests validate accepted coordinates, trimming, boundary values, missing labels, non-numeric values, and out-of-range coordinates.
- Context tests verify a valid override bypasses the geolocation helper and an invalid override still calls it.
- Nearby tests verify the visible location indicator and propagation to the map while preserving the existing cottage destination.
- Map tests verify labeled and unlabeled user-marker popups.
- The full unit suite, lint, production build, and deployed fake-stay URL smoke test must pass before completion.

