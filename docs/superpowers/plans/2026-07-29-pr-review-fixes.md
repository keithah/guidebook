# PR Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address every technically valid unresolved review thread on PR #1, preserve approved cache policy, and leave traceable replies for findings that are already satisfied or conflict with the approved plan.

**Architecture:** Keep provider parsing and cache policy in `src/lib`, keep polling/hydration lifecycle ownership in hooks, and keep accessibility state local to the relevant components. Behavioral fixes are test-first; refactors follow only after their adapter suites are green.

**Tech Stack:** React 19, Vite 8, Vitest 4, Testing Library, IndexedDB, Workbox/Vite PWA, GitHub review threads.

## Global Constraints

- Never expose or commit HERE or 511 credential values.
- Do not add service-worker runtime caching for OSM, HERE, or 511.
- Preserve the approved rule: expired HERE entries are deleted and never displayed stale.
- Preserve independent caller cancellation for shared provider requests.
- Keep the packaged OSM attribution and exact map bounds/query intact.

---

### Task 1: Saved-state and alert lifecycle races

**Files:**

- Modify: `app/src/hooks/useSavedDestinations.js`
- Modify: `app/src/hooks/useTransitAlerts.js`
- Test: `app/src/hooks/__tests__/useSavedDestinations.test.jsx`
- Test: `app/src/hooks/__tests__/useTransitAlerts.test.jsx`

**Interfaces:**

- Consumes: `savedStateStore`, `fetchServiceAlerts`, existing hook result shapes.
- Produces: mutation-safe hydration and liveness-safe refresh/poll scheduling.

- [ ] **Step 1: Write failing hydration-race coverage**

Use a deferred `savedStateStore.get`, toggle before it resolves, then assert the normalized toggle survives hydration and is the final persisted value.

```jsx
const pendingLoad = deferred();
vi.spyOn(savedStateStore, 'get').mockReturnValueOnce(pendingLoad.promise);
const hook = renderHook(() => useSavedDestinations());
await act(() => hook.result.current.toggleSaved(unionSquare));
pendingLoad.resolve(existingSavedPlaces);
await waitUntilLoaded(hook.result);
expect(hook.result.current.isSaved(unionSquare.id)).toBe(true);
```

- [ ] **Step 2: Run the saved-state test and verify RED**

Run: `npm test -- src/hooks/__tests__/useSavedDestinations.test.jsx`

Expected: the pre-hydration toggle is overwritten by the delayed store read.

- [ ] **Step 3: Preserve mutations made during hydration**

Track a mutation generation/ref. Apply and normalize the loaded collection only when no mutation occurred after the read began; always finish loading without writing the obsolete snapshot.

```js
const mutationVersion = useRef(0);
const versionAtLoadStart = mutationVersion.current;
const stored = await savedStateStore.get(STORE_KEY);
if (cancelled || mutationVersion.current !== versionAtLoadStart) return;
```

- [ ] **Step 4: Write failing manual-refresh lifecycle coverage**

Cover a manual refresh updating state/rescheduling the poller and a pending refresh resolving after unmount without a state update.

- [ ] **Step 5: Run the alert-hook test and verify RED**

Run: `npm test -- src/hooks/__tests__/useTransitAlerts.test.jsx`

Expected: refresh does not reset the timer and can write after unmount.

- [ ] **Step 6: Share hook liveness and scheduling**

Use mounted and timer refs shared by automatic loads and `refresh`; clear/reschedule from the most recently applied result.

- [ ] **Step 7: Verify GREEN**

Run: `npm test -- src/hooks/__tests__/useSavedDestinations.test.jsx src/hooks/__tests__/useTransitAlerts.test.jsx`

---

### Task 2: Provider validation, request sharing, and cache lifecycle

**Files:**

- Create: `app/src/lib/providerFetch.js`
- Modify: `app/src/lib/hereSearch.js`
- Modify: `app/src/lib/hereTransit.js`
- Modify: `app/src/lib/transit511.js`
- Modify: `app/src/lib/responseStore.js`
- Test: `app/src/lib/__tests__/hereSearch.test.js`
- Test: `app/src/lib/__tests__/hereTransit.test.js`
- Test: `app/src/lib/__tests__/transit511.test.js`
- Test: `app/src/lib/__tests__/responseStore.test.js`
- Test: `app/src/lib/__tests__/requestCoordinator.test.js`

**Interfaces:**

- Consumes: `dedupeRequest`, `providerResponseStore`, existing normalized results.
- Produces: `providerFailureReason`, `settleForCaller`, bounded shared loader helper, validated provider inputs, minute-bucketed transit keys, retryable IndexedDB initialization, and distinct 511 `aborted` results.

- [ ] **Step 1: Write failing validation and cache-key tests**

Assert non-finite HERE coordinates and invalid departure times return `invalid-request` without network/storage work. Assert two precise departure times inside one minute share a logical cache key while the outgoing HERE URLs retain each precise timestamp when network work occurs.

- [ ] **Step 2: Verify provider tests RED**

Run: `npm test -- src/lib/__tests__/hereSearch.test.js src/lib/__tests__/hereTransit.test.js`

- [ ] **Step 3: Add finite input guards and minute buckets**

```js
const ROUTE_KEY_BUCKET_MS = 60_000;
const bucket = Math.floor(Date.parse(plannedAt) / ROUTE_KEY_BUCKET_MS);
```

Return `invalid-request` before key construction or fetch for malformed inputs.

- [ ] **Step 4: Write failing 511 caller-abort coverage**

Assert already-aborted and in-flight caller cancellation return `aborted`, do not serve stale fallback, and do not cancel a joined caller's shared provider work.

- [ ] **Step 5: Verify 511 tests RED**

Run: `npm test -- src/lib/__tests__/transit511.test.js`

- [ ] **Step 6: Separate caller abort from provider timeout**

Return `aborted` only for the caller signal and keep loader-owned AbortError/deadline handling as `timeout`. Exclude `aborted` from stale fallback.

- [ ] **Step 7: Write failing IndexedDB-open retry coverage**

Use a fresh dynamic module instance and an `indexedDB.open` double that fails once then delegates to the real implementation; assert the second store call retries successfully.

- [ ] **Step 8: Verify response-store test RED, then clear rejected promise**

Run: `npm test -- src/lib/__tests__/responseStore.test.js`

```js
databasePromise = new Promise(/* existing open flow */).catch((error) => {
  databasePromise = undefined;
  throw error;
});
```

- [ ] **Step 9: Add request-coordinator rejection coverage**

Assert the first rejected loader propagates and a second call invokes a fresh resolving loader.

- [ ] **Step 10: Refactor shared provider scaffolding while green**

Move byte-identical failure classification, caller settlement, and loader deadline behavior to `providerFetch.js`; keep adapter-specific URL, payload normalization, and cache writes inside each adapter.

- [ ] **Step 11: Preserve approved HERE expiration behavior**

Do not implement stale HERE responses. Keep deletion after `expiresAt`; reply to the two conflicting review threads with the approved plan requirement.

- [ ] **Step 12: Verify GREEN**

Run: `npm test -- src/lib/__tests__/hereSearch.test.js src/lib/__tests__/hereTransit.test.js src/lib/__tests__/transit511.test.js src/lib/__tests__/responseStore.test.js src/lib/__tests__/requestCoordinator.test.js`

---

### Task 3: Planner and itinerary state/accessibility

**Files:**

- Modify: `app/src/components/nearby/DestinationSearch.jsx`
- Modify: `app/src/components/nearby/ItinerarySteps.jsx`
- Modify: `app/src/components/nearby/TransitAlerts.jsx`
- Modify: `app/src/components/nearby/TripCard.jsx`
- Modify: `app/src/components/nearby/TripOptions.jsx`
- Modify: `app/src/components/screens/Nearby.jsx`
- Test: component and Nearby test files named by the review.

**Interfaces:**

- Consumes: current candidate, trip, and alert result shapes.
- Produces: safe default collections, valid accessible names/relationships, reset expansion state, and null-safe external navigation.

- [ ] **Step 1: Write failing component regressions**

Cover missing candidate address/default collections, whole-hour/non-finite duration, collapsed `aria-controls` targets, two simultaneous TripCards with unique IDs, result replacement clearing expansion, and a stale result with no selected destination.

- [ ] **Step 2: Verify component tests RED**

Run: `npm test -- src/components/nearby/__tests__ src/components/screens/Nearby.test.jsx`

- [ ] **Step 3: Implement minimal accessibility and state fixes**

Use conditional address text, safe prop defaults, finite duration formatting, always-mounted hidden controlled regions, React `useId`, result-associated expansion state, and optional chaining before constructing `mapsUrl`.

- [ ] **Step 4: Correct existing tests**

Split the double DestinationSearch render, scope the empty alert query to `Alerts for this trip`, merge duplicate imports, and use two distinct destination fixtures for plan replacement.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- src/components/nearby/__tests__ src/components/screens/Nearby.test.jsx`

---

### Task 4: Offline map resilience and generator safeguards

**Files:**

- Modify: `app/scripts/generate-offline-map.mjs`
- Modify: `app/src/components/nearby/NeighborhoodMap.jsx`
- Modify: `app/src/components/nearby/__tests__/NeighborhoodMap.test.jsx`
- Modify: `app/src/index.css`

**Interfaces:**

- Consumes: existing OSM extract/property fixture and `OnlineNearbyMap.onTileFailure`.
- Produces: validated generation input, predictable badges, three-error live-map fallback with retry, complete modal focus/scroll isolation, and a 44px toggle target.

- [ ] **Step 1: Write failing map behavior tests**

Assert one/two tile errors retain the live map, the third shows the offline map, Retry returns to live while online, modal body overflow is restored, and generic focusable controls remain trapped.

- [ ] **Step 2: Verify map tests RED**

Run: `npm test -- src/components/nearby/__tests__/NeighborhoodMap.test.jsx`

- [ ] **Step 3: Implement map behavior**

Use a three-error threshold, reset counter on retry/online, expose Retry only for tile failure while online, broaden the focus selector, lock/restore body overflow, remove inline `objectFit`, and make the toggle at least 44px high.

- [ ] **Step 4: Harden the generator without changing output contracts**

Validate finite `property.address.lat/lng` and an array `property.transit.nearbyStops` before download. Replace the badge ternary with `{ BUS: '29', BART: 'BA' }` plus a two-character fallback.

- [ ] **Step 5: Verify GREEN and generator syntax**

Run: `npm test -- src/components/nearby/__tests__/NeighborhoodMap.test.jsx`
Run: `node --check scripts/generate-offline-map.mjs`

---

### Task 5: Cache-boundary tests, cleanup, and accurate docs

**Files:**

- Modify: `app/src/lib/__tests__/pwaCaching.test.js`
- Modify: `app/src/lib/__tests__/transit511.test.js`
- Modify: `docs/superpowers/plans/2026-07-28-live-transit-offline-map.md`
- Modify: `docs/superpowers/specs/2026-07-28-live-transit-offline-map-design.md`

**Interfaces:**

- Consumes: exported `runtimeCaching` entries and request-coordinator implementation.
- Produces: exact runtime-cache allowlist enforcement, reliable env cleanup, and accurate in-flight-only documentation.

- [ ] **Step 1: Replace cache denylist with exact allowlist**

Assert exactly two runtime entries, both regex patterns, with the NWS/Google Fonts cache names and handlers; reject functions or added generic patterns.

- [ ] **Step 2: Move environment cleanup to suite `afterEach`**

Remove inline `vi.unstubAllEnvs()` and ensure it runs even after an assertion failure.

- [ ] **Step 3: Correct request-coordinator prose**

Change both documents from “in-flight and recently completed” to “overlapping in-flight” deduplication.

- [ ] **Step 4: Record verified review pushback**

Reply that `app/.gitignore` already covers `.env`, `.env.*`, and preserves `.env.example`; reply that stale HERE serving conflicts with the plan's explicit “never display them stale” rule.

- [ ] **Step 5: Verify focused cache tests**

Run: `npm test -- src/lib/__tests__/pwaCaching.test.js src/lib/__tests__/transit511.test.js`

---

### Task 6: Full verification and PR update

**Files:**

- Review: all files changed by Tasks 1-5.

**Interfaces:**

- Consumes: all fixed behavior and review-thread IDs.
- Produces: one review-fix commit, pushed branch, evidence-backed thread replies/resolution.

- [ ] **Step 1: Run the full gate**

```bash
npm test
npm run lint
npm run build
npm audit --omit=dev
```

- [ ] **Step 2: Run security/cache/worktree audits**

Confirm configured keys are absent from tracked files and feature-history blobs without printing values; confirm `dist/sw.js` has no OSM/HERE/511 runtime routes; run `git diff --check` and inspect `git status --short`.

- [ ] **Step 3: Commit and push**

```bash
git commit -m "fix: address pull request review feedback"
git push
```

- [ ] **Step 4: Reply and resolve threads**

Reply in each inline thread with the fix/evidence or technical reason for no code change. Resolve only after the pushed commit makes the statement true.

- [ ] **Step 5: Re-fetch PR state**

Confirm zero unresolved actionable threads and report remaining external check state separately.
