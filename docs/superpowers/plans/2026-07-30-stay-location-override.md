# Stay-Link Location Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an encoded guest-preview URL make the existing **Allow location** action use and visibly identify `1620 Howard St, San Francisco` as the guest's current location.

**Architecture:** Extend the decoded stay payload with an optional validated `fakeLocation` object. `AppContext` feeds a valid override into the existing in-memory `coords` path before browser geolocation, so maps, distances, and HERE routing inherit it without moving the cottage or changing weather. Nearby and the online map render the optional label while existing stay links and real geolocation remain unchanged.

**Tech Stack:** React 19, Vitest 4, Testing Library, Vite 8, GitHub Pages.

## Global Constraints

- Keep the property's stored address, coordinates, weather location, transit stop configuration, and cottage marker unchanged.
- Do not geocode the fake address at runtime or monkey-patch the browser Geolocation API.
- A valid override uses the exact normalized shape `{ label, lat, lng, source: 'stay-override' }`.
- The 1620 Howard fixture uses label `1620 Howard St, San Francisco`, latitude `37.77154`, and longitude `-122.41761`.
- Activate the override only after the guest taps **Allow location**.
- A valid override must bypass `getCurrentPosition`; a missing or invalid override must use the existing browser geolocation path.
- Existing stay links without `fakeLocation` and the cottage fallback must behave unchanged.
- Render override labels as React text, never HTML, and do not persist them outside the URL/current session.
- The visible indicator must read `Using location: 1620 Howard St, San Francisco` and the marker popup must read `You are here · 1620 Howard St, San Francisco`.
- Follow red-green-refactor for every production behavior change.

---

### Task 1: Validate optional stay-location data

**Files:**
- Create: `app/src/lib/__tests__/stayHash.test.js`
- Modify: `app/src/lib/stayHash.js`

**Interfaces:**
- Consumes: decoded stay data with optional `fakeLocation`.
- Produces: `normalizeStayLocationOverride(stay) -> { label, lat, lng, source: 'stay-override' } | null`.

- [ ] **Step 1: Write the failing valid/boundary tests**

Create `stayHash.test.js` with:

```js
import { describe, expect, it } from 'vitest';
import {
  decodeStayHash,
  encodeStay,
  normalizeStayLocationOverride,
} from '../stayHash.js';

const howardLocation = {
  label: '  1620 Howard St, San Francisco  ',
  lat: 37.77154,
  lng: -122.41761,
};

describe('stay location overrides', () => {
  it('round-trips and normalizes a valid fake location', () => {
    const stay = {
      guestName: 'Jamie',
      checkin: '2026-07-30',
      checkout: '2026-08-03',
      code: '2468',
      fakeLocation: howardLocation,
    };

    const decoded = decodeStayHash(`#${encodeStay(stay)}`);

    expect(normalizeStayLocationOverride(decoded)).toEqual({
      label: '1620 Howard St, San Francisco',
      lat: 37.77154,
      lng: -122.41761,
      source: 'stay-override',
    });
  });

  it.each([
    [-90, -180],
    [90, 180],
  ])('accepts boundary coordinates %s, %s', (lat, lng) => {
    expect(
      normalizeStayLocationOverride({
        fakeLocation: { label: 'Boundary', lat, lng },
      }),
    ).toEqual({ label: 'Boundary', lat, lng, source: 'stay-override' });
  });
});
```

- [ ] **Step 2: Run the stay-hash test and verify RED**

```bash
cd app
npm test -- src/lib/__tests__/stayHash.test.js
```

Expected: FAIL because `normalizeStayLocationOverride` is not exported.

- [ ] **Step 3: Add the failing invalid-input table**

Add inside the same `describe` block:

```js
it.each([
  [undefined],
  [{}],
  [{ fakeLocation: null }],
  [{ fakeLocation: { label: '', lat: 37.7, lng: -122.4 } }],
  [{ fakeLocation: { label: '   ', lat: 37.7, lng: -122.4 } }],
  [{ fakeLocation: { label: 'Howard', lat: '37.7', lng: -122.4 } }],
  [{ fakeLocation: { label: 'Howard', lat: Number.NaN, lng: -122.4 } }],
  [{ fakeLocation: { label: 'Howard', lat: 91, lng: -122.4 } }],
  [{ fakeLocation: { label: 'Howard', lat: 37.7, lng: -181 } }],
])('rejects invalid override %#', (stay) => {
  expect(normalizeStayLocationOverride(stay)).toBeNull();
});
```

- [ ] **Step 4: Implement the validation boundary**

Update the payload comment in `stayHash.js` to include optional `fakeLocation`, then add:

```js
export function normalizeStayLocationOverride(stay) {
  const candidate = stay?.fakeLocation;
  if (!candidate || typeof candidate.label !== 'string') return null;

  const label = candidate.label.trim();
  const { lat, lng } = candidate;
  if (
    !label ||
    typeof lat !== 'number' ||
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    typeof lng !== 'number' ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { label, lat, lng, source: 'stay-override' };
}
```

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
cd app
npm test -- src/lib/__tests__/stayHash.test.js
```

Expected: every valid, boundary, and invalid-input case passes.

- [ ] **Step 6: Commit the validation boundary**

```bash
git add app/src/lib/stayHash.js app/src/lib/__tests__/stayHash.test.js
git commit -m "feat: validate stay location overrides"
```

---

### Task 2: Select the override before browser geolocation

**Files:**
- Modify: `app/src/context/AppContext.jsx`
- Modify: `app/src/context/__tests__/AppContext.test.jsx`

**Interfaces:**
- Consumes: `normalizeStayLocationOverride(stay)` from Task 1 and the existing `getCurrentPosition()` helper.
- Produces: `coords` containing either the normalized stay override, real browser coordinates, or the existing cottage fallback.

- [ ] **Step 1: Write the failing valid-override context test**

Import `act` from Testing Library, `beforeEach` from Vitest, `getCurrentPosition` from `../../lib/geo.js`, and `encodeStay` from `../../lib/stayHash.js`. Add this setup before the tests:

```jsx
beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = '';
  useLiveDepartures.mockReturnValue({ times: {}, meta: {} });
});
```

Then add:

```jsx
it('uses a valid stay location override without calling browser geolocation', async () => {
  window.location.hash = encodeStay({
    guestName: 'Jamie',
    checkin: '2026-07-30',
    checkout: '2026-08-03',
    fakeLocation: {
      label: '1620 Howard St, San Francisco',
      lat: 37.77154,
      lng: -122.41761,
    },
  });
  getCurrentPosition.mockResolvedValue({ lat: 1, lng: 2 });
  renderProvider();

  await act(async () => latestContext.allowLocation());

  expect(getCurrentPosition).not.toHaveBeenCalled();
  expect(latestContext.coords).toEqual({
    label: '1620 Howard St, San Francisco',
    lat: 37.77154,
    lng: -122.41761,
    source: 'stay-override',
  });
  expect(latestContext.located).toBe(true);
});
```

- [ ] **Step 2: Run the context suite and verify RED**

```bash
cd app
npm test -- src/context/__tests__/AppContext.test.jsx
```

Expected: FAIL because the current action calls `getCurrentPosition` and stores its result.

- [ ] **Step 3: Add the invalid-override fallback test**

```jsx
it('uses browser geolocation when the stay override is invalid', async () => {
  window.location.hash = encodeStay({
    guestName: 'Jamie',
    checkin: '2026-07-30',
    checkout: '2026-08-03',
    fakeLocation: {
      label: '1620 Howard St, San Francisco',
      lat: '37.77154',
      lng: -122.41761,
    },
  });
  getCurrentPosition.mockResolvedValue({ lat: 37.78, lng: -122.42 });
  renderProvider();

  await act(async () => latestContext.allowLocation());

  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  expect(latestContext.coords).toEqual({ lat: 37.78, lng: -122.42 });
});
```

- [ ] **Step 4: Implement override selection**

Import `normalizeStayLocationOverride` with the other stay helpers. Memoize it from `stay`:

```jsx
const stayLocationOverride = useMemo(
  () => normalizeStayLocationOverride(stay),
  [stay],
);
```

Inside `allowLocation`, replace the direct geolocation call with:

```jsx
const pos = stayLocationOverride ?? (await getCurrentPosition());
```

Add `stayLocationOverride` to the callback dependency array. Keep the existing success, error, cottage fallback, and loading behavior unchanged.

- [ ] **Step 5: Run the context suite and verify GREEN**

```bash
cd app
npm test -- src/context/__tests__/AppContext.test.jsx
```

Expected: both new tests and all existing context tests pass.

- [ ] **Step 6: Commit the context behavior**

```bash
git add app/src/context/AppContext.jsx app/src/context/__tests__/AppContext.test.jsx
git commit -m "feat: use stay location for guest consent"
```

---

### Task 3: Show the active fake location in Nearby and the map

**Files:**
- Modify: `app/src/components/screens/Nearby.jsx`
- Modify: `app/src/components/screens/Nearby.test.jsx`
- Modify: `app/src/components/nearby/OnlineNearbyMap.jsx`
- Modify: `app/src/components/nearby/__tests__/OnlineNearbyMap.test.jsx`

**Interfaces:**
- Consumes: `coords.source`, `coords.label`, and the existing `NeighborhoodMap` prop pass-through.
- Produces: optional `locationLabel` prop for `OnlineNearbyMap` plus visible Nearby status text.

- [ ] **Step 1: Write the failing Nearby indicator/propagation test**

Update the `NeighborhoodMap` mock to expose its optional label:

```jsx
vi.mock('../nearby/NeighborhoodMap.jsx', () => ({
  default: ({ locationLabel }) => (
    <div aria-label="Neighborhood map" data-location-label={locationLabel ?? ''} />
  ),
}));
```

Import `encodeStay`, then add:

```jsx
it('shows and propagates the active stay location label', async () => {
  window.location.hash = encodeStay({
    guestName: 'Jamie',
    checkin: '2026-07-30',
    checkout: '2026-08-03',
    fakeLocation: {
      label: '1620 Howard St, San Francisco',
      lat: 37.77154,
      lng: -122.41761,
    },
  });
  render(
    <AppProvider>
      <Nearby />
    </AppProvider>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Allow location' }));

  expect(
    await screen.findByText(
      'Using location: 1620 Howard St, San Francisco',
    ),
  ).toBeVisible();
  expect(screen.getByLabelText('Neighborhood map')).toHaveAttribute(
    'data-location-label',
    '1620 Howard St, San Francisco',
  );
});
```

- [ ] **Step 2: Run the Nearby test and verify RED**

```bash
cd app
npm test -- src/components/screens/Nearby.test.jsx
```

Expected: FAIL because the indicator is absent and no `locationLabel` is passed.

- [ ] **Step 3: Implement the Nearby label**

Derive the label without displaying labels from real coordinates:

```jsx
const locationLabel =
  coords?.source === 'stay-override' ? coords.label : null;
```

Inside the `located && coords` block, render before the map:

```jsx
{locationLabel && (
  <div role="status" style={{ color: colors.muted, fontSize: 12 }}>
    Using location: {locationLabel}
  </div>
)}
```

Pass `locationLabel={locationLabel}` to `NeighborhoodMap`. Do not alter `cottage`, `origin`, or weather data.

- [ ] **Step 4: Write the failing labeled-popup map test**

Add to `OnlineNearbyMap.test.jsx`:

```jsx
it('adds an optional stay location label to the user marker popup', () => {
  useMap.mockReturnValue({ fitBounds: vi.fn() });
  render(
    <OnlineNearbyMap
      center={center}
      cottage={cottage}
      stops={[]}
      showMe
      locationLabel="1620 Howard St, San Francisco"
      dest={null}
      onTileFailure={vi.fn()}
    />,
  );

  const meMarker = getMarkers().find(
    (marker) => marker.getAttribute('data-icon-class') === 'sfc-me-pin',
  );
  expect(within(meMarker).getByTestId('popup')).toHaveTextContent(
    'You are here · 1620 Howard St, San Francisco',
  );
});
```

The existing unlabeled marker test remains the regression for real geolocation.

- [ ] **Step 5: Run the map suite and verify RED**

```bash
cd app
npm test -- src/components/nearby/__tests__/OnlineNearbyMap.test.jsx
```

Expected: FAIL because the component ignores `locationLabel`.

- [ ] **Step 6: Implement the optional popup label**

Accept `locationLabel` in `OnlineNearbyMap`, document it in JSDoc, and change only the user popup:

```jsx
<Popup>
  {locationLabel ? `You are here · ${locationLabel}` : 'You are here'}
</Popup>
```

- [ ] **Step 7: Run both UI suites and verify GREEN**

```bash
cd app
npm test -- src/components/screens/Nearby.test.jsx src/components/nearby/__tests__/OnlineNearbyMap.test.jsx
```

Expected: the new labeled behavior passes and existing unlabeled/cottage marker behavior remains green.

- [ ] **Step 8: Commit the location UI**

```bash
git add app/src/components/screens/Nearby.jsx app/src/components/screens/Nearby.test.jsx app/src/components/nearby/OnlineNearbyMap.jsx app/src/components/nearby/__tests__/OnlineNearbyMap.test.jsx
git commit -m "feat: label stay location on nearby map"
```

---

### Task 4: Document the guest-link extension

**Files:**
- Modify: `app/README.md`

**Interfaces:**
- Consumes: the final `fakeLocation` payload contract.
- Produces: operator documentation explaining how to create and safely interpret location-override links.

- [ ] **Step 1: Extend the guest-link documentation**

In `app/README.md` under **Content and guest links**, document:

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

State that `fakeLocation` is optional, applies only after **Allow location**, is intended for preview/testing links, stays in the URL fragment, and is ignored when invalid. Note that base64url is not encryption.

- [ ] **Step 2: Validate and commit the documentation**

```bash
git diff --check
git add app/README.md
git commit -m "docs: explain stay location overrides"
```

Expected: `git diff --check` exits zero and only the intended README section changes.

---

### Task 5: Verify, publish, deploy, and produce the fake-stay URL

**Files:**
- Review: every file changed in Tasks 1-4.
- Remote update: pull request from `feat/stay-location-override` into `main`.

**Interfaces:**
- Produces: verified deployment and a working fake-stay URL for Jamie at 1620 Howard Street.

- [ ] **Step 1: Run the full local gate**

```bash
cd app
npm test
npm run lint
npm run build
cd ..
git diff --check
git status --short
```

Expected: all tests pass, lint exits zero, the production PWA build succeeds, the diff check is clean, and all intended source/docs changes are committed.

- [ ] **Step 2: Generate and locally verify the requested hash**

```bash
node --input-type=module -e "import { encodeStay, decodeStayHash, normalizeStayLocationOverride } from './app/src/lib/stayHash.js'; const stay={guestName:'Jamie',checkin:'2026-07-30',checkout:'2026-08-03',code:'2468',fakeLocation:{label:'1620 Howard St, San Francisco',lat:37.77154,lng:-122.41761}}; const hash=encodeStay(stay); const decoded=decodeStayHash('#'+hash); if (!normalizeStayLocationOverride(decoded)) process.exit(1); console.log('https://keithah.github.io/guidebook/#'+hash);"
```

Expected: one deployed-site URL whose decoded location matches the normalized Howard Street override.

- [ ] **Step 3: Push and create the pull request**

```bash
git push -u origin feat/stay-location-override
gh pr create --base main --head feat/stay-location-override \
  --title "Add stay-link location overrides" \
  --body "Adds a validated client-only fakeLocation field for guest preview links, routes it through explicit location consent, labels it in Nearby, and preserves real geolocation and cottage behavior."
```

- [ ] **Step 4: Review and merge normally**

Wait until GitHub reports the PR mergeable and all required checks/reviews are satisfied. Merge with `gh pr merge --merge` without administrative bypass. Record the merge commit.

- [ ] **Step 5: Monitor the merge-triggered Pages deployment**

Select the run whose `headSha` equals the merge commit:

```bash
merge_sha_task=$(gh pr view --json mergeCommit --jq '.mergeCommit.oid')
run_id_task=$(gh run list --workflow deploy-guidebook.yml --branch main --limit 10 --json databaseId,headSha --jq ".[] | select(.headSha == \"$merge_sha_task\") | .databaseId" | head -1)
test -n "$run_id_task"
gh run watch "$run_id_task" --exit-status
```

Expected: both Pages build and deploy jobs succeed at the merge commit.

- [ ] **Step 6: Smoke-test the deployed fake-location flow**

Open the generated URL in a fresh browser context, navigate to **Around** → **Nearby**, and tap **Allow location**. Verify:

1. the browser does not show a geolocation permission prompt;
2. `Using location: 1620 Howard St, San Francisco` is visible;
3. the map is centered at the Howard Street coordinates and the user popup reads `You are here · 1620 Howard St, San Francisco`;
4. the cottage marker/address remains The SF Cottage;
5. selecting a destination sends HERE routing origin `37.77154,-122.41761`.

- [ ] **Step 7: Confirm final state**

Confirm the PR is merged, `origin/main` contains the feature head, the Pages run succeeded at the merge commit, the live URL works, and the tracked worktree is clean. Preserve the linked worktree for later PR feedback.
