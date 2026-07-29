# PR Review Follow-up Design

## Goal

Address every still-valid follow-up comment on pull request #1 without changing the approved HERE expiration policy, 511 stale-cache windows, or guest-facing itinerary behavior.

## Saved destination integrity

Pre-hydration actions will be recorded as explicit mutations shaped like `{ candidate, saved }`, where `saved` is the end state the guest selected in the currently visible UI. Hydration will normalize the stored collection and apply queued mutations as idempotent set operations in order. A save retains or adds the candidate; an unsave removes it. This prevents a visible “Save” action from becoming a toggle that removes an already-persisted destination.

If the initial IndexedDB read fails, the hook will retain its current in-memory collection and stop writing saved destinations for the rest of that hook instance. This degraded mode favors preservation of unknown persisted data over persisting a partial collection. Reloading the application creates a new hook instance and retries storage normally.

Regression tests will cover:

- saving an already-persisted destination before hydration completes;
- multiple pre-hydration actions preserving their intended final state;
- a failed initial read performing no write;
- later toggles after a failed read remaining in memory without writing a partial collection.

## Shared itinerary formatting

A new nearby formatting module will own `formatDuration`, `formatTime`, and `RouteTime`. `RouteTime` will accept an optional fallback node. Itinerary steps will use the default `null` fallback, while trip cards will pass the existing “Time pending” fallback. This removes duplicated parsing/formatting logic while preserving the two intentional invalid-time presentations.

Existing itinerary and trip-card tests will remain the behavioral contract. Focused shared-module tests will cover valid times, invalid times with and without a fallback, whole-hour duration formatting, and non-finite duration formatting.

## Shared provider request lifecycle

`sharedProviderRequest` remains the single owner of request deduplication, provider deadlines, caller cancellation, and unexpected-loader failure normalization. It will return `{ ok: false, reason: 'aborted' }` before starting or joining provider work when the caller signal is already aborted.

The 511 adapter will use `sharedProviderRequest` for its network refresh while retaining all 511-specific behavior locally:

- five-minute departure freshness and 30-minute stale retention;
- ten-minute alert freshness and 60-minute stale retention;
- payload validation and normalization;
- IndexedDB reads, writes, expiry deletion, and stale fallback;
- caller cancellation never returning stale data.

The 511 network loader will receive the shared provider signal and deadline-state callback. Deadline aborts remain `timeout`; other thrown abort errors use the common provider failure classification. HTTP 401/403, 429, and generic non-success responses use the shared HTTP classifier.

Existing HERE behavior remains unchanged, including deletion of expired entries and never displaying HERE data stale.

## Documentation

The malformed HERE trip-shape example will become a valid JavaScript object literal with the same fields and ordering.

## Verification and PR handling

Each behavior change will follow a red-green test cycle. The completion gate is:

```bash
cd app
npm test
npm run lint
npm run build
npm audit --omit=dev
```

The final pass will also verify the generated service worker contains no HERE, 511, or OpenStreetMap runtime route; confirm configured keys are absent from tracked files and branch history; and require a clean worktree. After the verified commits are pushed, each new inline thread will receive a concise evidence-based reply and be resolved. The outside-diff documentation comment will receive a top-level acknowledgement only if GitHub provides no inline thread to reply to.
