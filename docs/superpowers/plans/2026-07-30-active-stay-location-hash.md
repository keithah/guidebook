# Active Stay-Location Hash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a valid fake-location stay hash replace previously consented browser coordinates in a running app, without another browser geolocation request.

**Architecture:** Keep consent and coordinate synchronization inside `AppProvider`. Record whether the guest used **Allow location**, then let the existing hash synchronization effect activate any valid override for the current hash while retaining the existing stale-override cleanup path.

**Tech Stack:** React 19 context/hooks, Vitest 4, Testing Library, Vite 8.

## Global Constraints

- A valid `fakeLocation` remains inactive until the guest has allowed location in the current app session.
- Activating or replacing a valid override must not call browser geolocation, reload the page, or reset unrelated application state.
- Removing an override or replacing it with an invalid override clears stale override-owned coordinates.
- Choosing **Not now — use the cottage as my location** does not grant location consent and must continue to preserve cottage coordinates across hash changes.
- Do not change the guest-link payload or any map, routing, weather, or provider API behavior.

---

### Task 1: Activate valid stay coordinates after consent

**Files:**
- Modify: `app/src/context/AppContext.jsx:152-192`
- Test: `app/src/context/__tests__/AppContext.test.jsx:104-148`

**Interfaces:**
- Consumes: `stayLocationOverride` from `normalizeStayLocationOverride(stay)`, `stayHash`, and the existing `allowLocation`, `useCottageAsLocation`, `coords`, and `located` state.
- Produces: internal `locationConsentGranted: boolean` state and hash synchronization that writes normalized override coordinates to `coords`; no public context shape changes.

- [ ] **Step 1: Replace the two stale-transition expectations with the desired behavior**

Update the existing replacement-override test so a consented Howard override changes directly to the valid Ferry Building override:

```jsx
it('activates a replacement stay location override after consent', async () => {
  window.location.hash = encodeStay(howardStay);
  renderProvider();

  await act(async () => latestContext.allowLocation());
  await changeStayHash({
    guestName: 'Morgan',
    checkin: '2026-08-04',
    checkout: '2026-08-08',
    fakeLocation: {
      label: 'Ferry Building, San Francisco',
      lat: 37.7955,
      lng: -122.3937,
    },
  });

  expect(latestContext.coords).toEqual({
    label: 'Ferry Building, San Francisco',
    lat: 37.7955,
    lng: -122.3937,
    source: 'stay-override',
  });
  expect(latestContext.located).toBe(true);
  expect(getCurrentPosition).not.toHaveBeenCalled();
});
```

Replace the browser-coordinate preservation test with the reported Montana reproduction:

```jsx
it('replaces consented browser coordinates when a valid stay location hash arrives', async () => {
  getCurrentPosition.mockResolvedValue({ lat: 46.8797, lng: -110.3626 });
  renderProvider();

  await act(async () => latestContext.allowLocation());
  expect(latestContext.coords).toEqual({ lat: 46.8797, lng: -110.3626 });

  await changeStayHash(howardStay);

  expect(latestContext.coords).toEqual({
    label: '1620 Howard St, San Francisco',
    lat: 37.77154,
    lng: -122.41761,
    source: 'stay-override',
  });
  expect(latestContext.located).toBe(true);
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
cd app
npm test -- src/context/__tests__/AppContext.test.jsx
```

Expected: the two changed tests fail because the current effect clears a replaced active override and preserves Montana browser coordinates. The unchanged cottage test must still pass.

- [ ] **Step 3: Add explicit consent state and activate the current valid override**

Add consent state beside the existing location state:

```jsx
const [locationConsentGranted, setLocationConsentGranted] = useState(false);
```

Extend the hash synchronization effect so a current valid override wins only after consent, before the stale-override cleanup branch:

```jsx
useEffect(() => {
  if (
    locationConsentGranted &&
    stayLocationOverride &&
    activeStayLocationHashRef.current !== stayHash
  ) {
    activeStayLocationHashRef.current = stayHash;
    setCoords(stayLocationOverride);
    setLocated(true);
    return;
  }

  if (
    coords?.source === 'stay-override' &&
    activeStayLocationHashRef.current !== stayHash
  ) {
    activeStayLocationHashRef.current = null;
    setCoords(null);
    setLocated(false);
  }
}, [coords, locationConsentGranted, stayHash, stayLocationOverride]);
```

Record consent after `allowLocation` finishes resolving its current attempt, and explicitly clear it when the guest chooses the cottage:

```jsx
} finally {
  setLocationConsentGranted(true);
  setLocating(false);
}
```

```jsx
const useCottageAsLocation = useCallback(() => {
  activeStayLocationHashRef.current = null;
  setLocationConsentGranted(false);
  setCoords({ lat: property.address.lat, lng: property.address.lng });
  setLocated(true);
}, []);
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
cd app
npm test -- src/context/__tests__/AppContext.test.jsx
```

Expected: all context tests pass, including Montana-to-Howard, valid replacement, override removal, cottage preservation, and invalid-override geolocation.

- [ ] **Step 5: Run the full local verification gate**

Run:

```bash
cd app
npm test
npm run lint
npm run build
cd ..
git diff --check
```

Expected: all tests pass; lint exits zero with no new warnings in edited files; Vite builds the production PWA; `git diff --check` exits zero.

- [ ] **Step 6: Commit the tested fix**

```bash
git add app/src/context/AppContext.jsx app/src/context/__tests__/AppContext.test.jsx
git commit -m "fix: activate stay location after consent"
```

### Task 2: Review, publish, and verify production

**Files:**
- No product files should change.

**Interfaces:**
- Consumes: the reviewed Task 1 commit and the repository's existing GitHub Pages workflow.
- Produces: a merged pull request and a successful merge-SHA-matched Pages deployment.

- [ ] **Step 1: Review the focused implementation diff**

Review the Task 1 commit against the approved spec. Reject any change that calls geolocation again, auto-activates before consent, replaces explicitly chosen cottage coordinates, or changes unrelated providers and screens.

- [ ] **Step 2: Re-run verification immediately before publication**

Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check` again after the final review change. Do not publish if any command fails.

- [ ] **Step 3: Push and open a pull request against `main`**

Push `fix/activate-stay-location-on-hash`, open a PR explaining the Montana reproduction and Howard result, and wait for every required check and unresolved review thread.

- [ ] **Step 4: Merge normally and watch the exact deployment**

After approval, merge without admin bypass. Match the Pages run to the resulting merge SHA and require successful build and deploy jobs.

- [ ] **Step 5: Verify the live fake-stay transition**

In a fresh browser context, first establish Montana browser coordinates and consent, then navigate to the Howard fake-stay URL in the same running app. Verify the active label and map origin change to `1620 Howard St, San Francisco`, and verify no second browser geolocation call occurs.
