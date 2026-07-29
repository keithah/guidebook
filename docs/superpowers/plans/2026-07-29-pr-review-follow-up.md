# PR Review Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every still-valid follow-up comment on pull request #1 without changing approved HERE expiration behavior, 511 cache windows, or guest-facing itinerary presentation.

**Architecture:** Saved destinations will replay explicit end-state mutations and enter a no-write degraded mode after a failed initial read. Itinerary formatting will move into one shared nearby module with configurable invalid-time fallback. HERE and 511 will share request deduplication, deadlines, caller cancellation, and HTTP/error classification while 511 retains its provider-specific cache and stale-fallback logic.

**Tech Stack:** React 19, Vitest 4, Testing Library, IndexedDB/fake-indexeddb, Vite 8, vite-plugin-pwa, GitHub CLI.

## Global Constraints

- Preserve the approved rule that expired HERE entries are deleted and never displayed stale.
- Preserve 511 departure freshness/stale windows of five/30 minutes and alert freshness/stale windows of ten/60 minutes.
- Preserve ItinerarySteps invalid-time behavior (`null`) and TripCard invalid-time behavior (`Time pending`).
- Never persist a partial saved-destination collection after the initial IndexedDB read fails.
- Do not expose configured HERE or 511 keys in output, source, commits, tests, or service-worker caches.
- Follow red-green-refactor for every production behavior change.

---

### Task 1: Make saved-destination hydration intent-safe

**Files:**
- Modify: `app/src/hooks/__tests__/useSavedDestinations.test.jsx`
- Modify: `app/src/hooks/useSavedDestinations.js`

**Interfaces:**
- Consumes: `savedStateStore.get(key)` and `.put(key, value)`.
- Produces: queued mutations shaped as `{ candidate: NormalizedCandidate, saved: boolean }`; `useSavedDestinations()` keeps its existing public return shape.

- [ ] **Step 1: Extend the deferred helper and write the failing intent-replay tests**

Update `deferred()` so it returns both `resolve` and `reject`. Add tests equivalent to:

```jsx
it('keeps an already-stored destination when Save is tapped before hydration', async () => {
  const pendingLoad = deferred();
  vi.spyOn(savedStateStore, 'get').mockReturnValueOnce(pendingLoad.promise);
  const hook = renderHook(() => useSavedDestinations());

  await act(async () => hook.result.current.toggleSaved(unionSquare));
  pendingLoad.resolve([unionSquare, ferryBuilding]);
  await waitUntilLoaded(hook.result);

  expect(hook.result.current.savedDestinations.map(({ id }) => id)).toEqual([
    unionSquare.id,
    ferryBuilding.id,
  ]);
});

it('replays multiple pre-hydration actions as their intended final states', async () => {
  const pendingLoad = deferred();
  vi.spyOn(savedStateStore, 'get').mockReturnValueOnce(pendingLoad.promise);
  const hook = renderHook(() => useSavedDestinations());

  await act(async () => hook.result.current.toggleSaved(unionSquare));
  await act(async () => hook.result.current.toggleSaved(unionSquare));
  await act(async () => hook.result.current.toggleSaved(ferryBuilding));
  pendingLoad.resolve([unionSquare]);
  await waitUntilLoaded(hook.result);

  expect(hook.result.current.savedDestinations.map(({ id }) => id)).toEqual([
    ferryBuilding.id,
  ]);
});
```

- [ ] **Step 2: Run the intent tests and verify RED**

Run:

```bash
cd app
npm test -- src/hooks/__tests__/useSavedDestinations.test.jsx
```

Expected: the already-stored destination test fails because replaying `toggleCandidate` removes it; the multi-action test fails because toggles are reinterpreted against stored state.

- [ ] **Step 3: Write the failing read-failure tests**

Add tests equivalent to:

```jsx
it('does not write when the initial saved-state read fails', async () => {
  vi.spyOn(savedStateStore, 'get').mockRejectedValueOnce(
    new Error('temporary IndexedDB read failure'),
  );
  const put = vi.spyOn(savedStateStore, 'put');
  const hook = renderHook(() => useSavedDestinations());

  await waitUntilLoaded(hook.result);
  expect(put).not.toHaveBeenCalled();
});

it('keeps later toggles in memory without writing after a failed read', async () => {
  vi.spyOn(savedStateStore, 'get').mockRejectedValueOnce(
    new Error('temporary IndexedDB read failure'),
  );
  const put = vi.spyOn(savedStateStore, 'put');
  const hook = renderHook(() => useSavedDestinations());
  await waitUntilLoaded(hook.result);

  await act(async () => hook.result.current.toggleSaved(unionSquare));

  expect(hook.result.current.isSaved(unionSquare.id)).toBe(true);
  expect(put).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Run the read-failure tests and verify RED**

Run the same focused test command. Expected: the first test observes the catch-path empty write; the second observes the later partial-collection write.

- [ ] **Step 5: Implement explicit saved-state mutations and degraded persistence**

Replace toggle replay with an idempotent helper:

```js
function applySavedMutation(collection, { candidate, saved }) {
  const withoutCandidate = collection.filter(
    (place) => place.id !== candidate.id,
  );
  return saved
    ? [candidate, ...withoutCandidate].slice(0, MAX_SAVED_DESTINATIONS)
    : withoutCandidate;
}
```

Add `persistenceReadyRef = useRef(false)`. On a successful read, reduce queued mutations with `applySavedMutation`, set `persistenceReadyRef.current = true`, and persist the merged collection only when normalization or queued work changed it. On read failure, mark hydration complete for UI purposes, clear the mutation queue, leave `persistenceReadyRef.current = false`, and perform no write.

In `toggleSaved`, compute the visible intent before changing state:

```js
const saved = !savedRef.current.some((place) => place.id === normalized.id);
const mutation = { candidate: normalized, saved };
if (!hydratedRef.current) pendingMutationsRef.current.push(mutation);
const next = applySavedMutation(savedRef.current, mutation);
savedRef.current = next;
setSavedDestinations(next);
if (!hydratedRef.current || !persistenceReadyRef.current) return;
```

- [ ] **Step 6: Run the saved-destination suite and verify GREEN**

Run the focused test command. Expected: every saved-destination test passes with no unhandled rejection or React act warning.

- [ ] **Step 7: Commit the saved-state fix**

```bash
git add app/src/hooks/useSavedDestinations.js app/src/hooks/__tests__/useSavedDestinations.test.jsx
git commit -m "fix: preserve saved destinations across hydration failures"
```

---

### Task 2: Share itinerary formatting without changing fallbacks

**Files:**
- Create: `app/src/components/nearby/itineraryFormat.jsx`
- Create: `app/src/components/nearby/__tests__/itineraryFormat.test.jsx`
- Modify: `app/src/components/nearby/ItinerarySteps.jsx`
- Modify: `app/src/components/nearby/TripCard.jsx`
- Modify: `app/src/components/nearby/__tests__/ItinerarySteps.test.jsx`

**Interfaces:**
- Produces: `formatDuration(seconds) -> string`, `formatTime(value) -> string|null`, and `RouteTime({ value, fallback = null }) -> JSX.Element|null`.
- Consumers: `ItinerarySteps.jsx` uses the default fallback; `TripCard.jsx` supplies `<span>Time pending</span>`.

- [ ] **Step 1: Write failing shared-format tests**

Create `itineraryFormat.test.jsx`:

```jsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatDuration, formatTime, RouteTime } from '../itineraryFormat.jsx';

afterEach(cleanup);

describe('itinerary formatting', () => {
  it.each([
    [0, '1 min'],
    [3_600, '1 hr'],
    [3_900, '1 hr 5 min'],
    [Number.NaN, '0 min'],
  ])('formats %s seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it('formats valid times and returns null for invalid values', () => {
    expect(formatTime('2026-07-28T18:00:00.000Z')).toEqual(expect.any(String));
    expect(formatTime('garbage')).toBeNull();
  });

  it('uses the supplied fallback only for an invalid time', () => {
    const { container, rerender } = render(<RouteTime value="garbage" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<RouteTime value="garbage" fallback={<span>Time pending</span>} />);
    expect(screen.getByText('Time pending')).toBeVisible();
  });

  it('renders a valid value as a semantic time element', () => {
    const value = '2026-07-28T18:00:00.000Z';
    render(<RouteTime value={value} />);
    expect(document.querySelector(`time[datetime="${value}"]`)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
cd app
npm test -- src/components/nearby/__tests__/itineraryFormat.test.jsx
```

Expected: FAIL because `itineraryFormat.jsx` does not exist.

- [ ] **Step 3: Implement the shared module**

Move the existing duration and time logic into `itineraryFormat.jsx`. Implement:

```jsx
export function RouteTime({ value, fallback = null }) {
  const text = formatTime(value);
  return text ? <time dateTime={value}>{text}</time> : fallback;
}
```

- [ ] **Step 4: Replace both component-local implementations**

In `ItinerarySteps.jsx`, import `formatDuration` and `RouteTime` from `./itineraryFormat.jsx`; remove its local `formatDuration`, `formatTime`, and `RouteTime`.

In `TripCard.jsx`, import the same exports and render invalid values with:

```jsx
<RouteTime value={trip.departureTime} fallback={<span>Time pending</span>} />
```

Apply the same fallback to arrival time. Update `ItinerarySteps.test.jsx` to import `formatDuration` from `../itineraryFormat.jsx`.

- [ ] **Step 5: Run shared and component suites and verify GREEN**

```bash
cd app
npm test -- src/components/nearby/__tests__/itineraryFormat.test.jsx src/components/nearby/__tests__/ItinerarySteps.test.jsx src/components/nearby/__tests__/TripCard.test.jsx
```

Expected: all formatting, itinerary, and trip-card tests pass, including the intentional difference between a missing itinerary-step time and a trip-card “Time pending” placeholder.

- [ ] **Step 6: Commit the formatting extraction**

```bash
git add app/src/components/nearby/itineraryFormat.jsx app/src/components/nearby/ItinerarySteps.jsx app/src/components/nearby/TripCard.jsx app/src/components/nearby/__tests__/itineraryFormat.test.jsx app/src/components/nearby/__tests__/ItinerarySteps.test.jsx
git commit -m "refactor: share itinerary time formatting"
```

---

### Task 3: Route 511 through the shared provider lifecycle

**Files:**
- Create: `app/src/lib/__tests__/providerFetch.test.js`
- Modify: `app/src/lib/providerFetch.js`
- Modify: `app/src/lib/transit511.js`
- Modify: `app/src/lib/__tests__/transit511.test.js`

**Interfaces:**
- Consumes: `sharedProviderRequest({ key, signal, timeoutMs, loader })`, where `loader({ signal, didTimeout })` performs provider work.
- Produces: no new public 511 API; `fetchStopDepartures` and `fetchServiceAlerts` retain their existing signatures and cache metadata.

- [ ] **Step 1: Write the failing already-aborted helper test**

Create `providerFetch.test.js`:

```js
import { describe, expect, it, vi } from 'vitest';
import { sharedProviderRequest } from '../providerFetch.js';

describe('sharedProviderRequest', () => {
  it('does not start provider work for an already-aborted caller', async () => {
    const controller = new AbortController();
    controller.abort();
    const loader = vi.fn();

    await expect(
      sharedProviderRequest({
        key: 'provider:aborted',
        signal: controller.signal,
        timeoutMs: 10_000,
        loader,
      }),
    ).resolves.toEqual({ ok: false, reason: 'aborted' });
    expect(loader).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the helper test and verify RED**

```bash
cd app
npm test -- src/lib/__tests__/providerFetch.test.js
```

Expected: result is aborted but `loader` has already been scheduled and the final assertion fails.

- [ ] **Step 3: Add the shared-helper early return**

At the start of `sharedProviderRequest`:

```js
if (signal?.aborted) {
  return Promise.resolve({ ok: false, reason: 'aborted' });
}
```

- [ ] **Step 4: Run the helper test and verify GREEN**

Run the focused helper test. Expected: PASS and `loader` remains untouched.

- [ ] **Step 5: Update the 511 failure test before refactoring**

Change the table-driven expectation for an immediate loader-thrown `AbortError` from `timeout` to `aborted`, matching the approved common provider failure classifier. Keep the fake-timer deadline test expecting `timeout`. Run:

```bash
cd app
npm test -- src/lib/__tests__/transit511.test.js
```

Expected: the immediate `AbortError` case fails because the current local 511 classifier still maps every abort to `timeout`; real deadline tests remain green.

- [ ] **Step 6: Refactor 511 network work onto sharedProviderRequest**

Import:

```js
import {
  providerFailureReason,
  providerHttpFailure,
  sharedProviderRequest,
} from './providerFetch.js';
```

Remove the local `failureReason`, `responseFailure`, `settleForCaller`, and direct `dedupeRequest` import. Change `request511` to accept `signal` and `didTimeout`, remove its controller/timer/`Promise.race`, fetch with the supplied signal, and classify failures as:

```js
reason: didTimeout() ? 'timeout' : providerFailureReason(error)
```

Use `providerHttpFailure(response)` for status classification and retain `invalid-response` for parse/schema failures.

In `cached511Request`, obtain the refresh result with:

```js
const result = await sharedProviderRequest({
  key,
  signal,
  timeoutMs: REQUEST_TIMEOUT_MS,
  loader: ({ signal: providerSignal, didTimeout }) =>
    request511({
      url,
      fetchImpl,
      normalize,
      validate,
      dataField,
      key,
      freshMs,
      staleMs,
      now,
      signal: providerSignal,
      didTimeout,
    }),
});
```

Leave the existing post-result 511 stale fallback in `cached511Request`, including its exclusion for `reason === 'aborted'`.

- [ ] **Step 7: Run provider and 511 suites and verify GREEN**

```bash
cd app
npm test -- src/lib/__tests__/providerFetch.test.js src/lib/__tests__/transit511.test.js src/lib/__tests__/hereSearch.test.js src/lib/__tests__/hereTransit.test.js
```

Expected: all provider suites pass; 511 deadline aborts remain `timeout`, caller/immediate aborts are `aborted`, cache windows are unchanged, and stale fallback still occurs only for eligible refresh failures.

- [ ] **Step 8: Commit the provider consolidation**

```bash
git add app/src/lib/providerFetch.js app/src/lib/transit511.js app/src/lib/__tests__/providerFetch.test.js app/src/lib/__tests__/transit511.test.js
git commit -m "refactor: share provider request lifecycle with 511"
```

---

### Task 4: Correct the HERE trip contract example

**Files:**
- Modify: `docs/superpowers/specs/2026-07-28-live-transit-offline-map-design.md:63-78`

**Interfaces:**
- Produces: a valid JavaScript object-literal example using the existing normalized trip field names.

- [ ] **Step 1: Replace the malformed example**

Use exactly:

```js
{
  id,
  departureTime,
  arrivalTime,
  durationSeconds,
  transferCount,
  walkingDurationSeconds,
  lines,
  sections,
  notices,
  plannedAt
}
```

No automated test is required for human-facing prose; validate the fenced example by inspection and `git diff --check`.

- [ ] **Step 2: Commit the documentation correction**

```bash
git add docs/superpowers/specs/2026-07-28-live-transit-offline-map-design.md
git commit -m "docs: correct normalized trip example"
```

---

### Task 5: Verify, push, and close the review loop

**Files:**
- Review: every file changed in Tasks 1-4.
- Update remotely: pull request #1 inline threads and outside-diff review acknowledgement.

**Interfaces:**
- Produces: a clean verified PR head with zero unresolved actionable threads.

- [ ] **Step 1: Run the full automated gate**

```bash
cd app
npm test
npm run lint
npm run build
npm audit --omit=dev
```

Expected: 22 or more test files pass, lint exits zero (the three existing warnings may remain), the PWA build completes, and the production dependency audit reports zero vulnerabilities.

- [ ] **Step 2: Run security, service-worker, syntax, and worktree audits**

Without printing key values, confirm `.env` is ignored and both configured values are absent from tracked files and every feature-branch commit. Then run:

```bash
cd app
! rg -q "osm-tiles|511-transit|tile\\.openstreetmap|api\\.511\\.org|hereapi\\.com" dist/sw.js
node --check scripts/generate-offline-map.mjs
cd ..
git diff --check
git status --short
```

Expected: all checks exit zero and the status is clean after commits.

- [ ] **Step 3: Push the verified commits**

```bash
git push origin feature/live-transit-offline-map
```

- [ ] **Step 4: Re-fetch thread-aware review state**

```bash
python3 /home/keith/.codex/plugins/cache/openai-curated-remote/github/0.1.8-2841cf9749ae/skills/gh-address-comments/scripts/fetch_comments.py
```

Map each current unresolved thread to the pushed commit before replying. Treat the two itinerary-format threads as duplicates addressed by the same extraction, and the earlier outside-diff 511 note as addressed by the same provider lifecycle refactor.

- [ ] **Step 5: Reply and resolve**

Reply inside every inline thread with the specific fix and test evidence, then resolve the thread. Post one concise top-level PR comment for the malformed documentation example because GitHub did not create an inline thread for it. Do not resolve or claim anything before the pushed commit contains the stated fix.

- [ ] **Step 6: Recheck PR status**

Confirm:

- zero unresolved actionable review threads;
- the current head equals the locally verified commit;
- CodeRabbit has completed or its pending state is reported accurately;
- GitGuardian's known identifier-only false positive is reported separately from code/test status.
