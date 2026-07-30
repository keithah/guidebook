# Journey Modes and Route-Relevant Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a selected destination Transit, Walk, and Rideshare views with an accessible journey timeline, complete in-app walking directions, correct Muni/BART identities, and warnings only on transit options affected by a matching alert.

**Architecture:** Keep HERE Public Transit, HERE pedestrian routing, 511 alerts, and property rideshare estimates behind separate adapters. Normalize them into small stable view models consumed by shared identity, icon, timeline, and mode-selector components. Match 511 entities against each trip by agency, route, time, direction, and stop; remove every standalone alert surface.

**Tech Stack:** React 19, Vite 8, Vitest 4, Testing Library, HERE Public Transit API v8, HERE Routing API v8, 511 GTFS-realtime JSON, IndexedDB response store, inline accessible SVG icons.

## Global Constraints

- Do not integrate, alter, or expand online or curated POI behavior.
- Do not add live Uber, Lyft, or Waymo APIs in this release.
- Keep affected transit options visible; warnings never silently remove a route.
- Never render general, unmatched, or alert-provider status messages.
- Transit and Walk both keep correctly parameterized Google Maps fallbacks.
- Rideshare waits are explicitly approximate property data.
- Preserve nearby 511 departure boards, offline maps, location overrides, and complete itinerary expansion.
- Do not add a new UI or icon dependency; use the existing Muni asset and focused inline SVG components.
- Follow strict RED → GREEN TDD for every task and commit only after its focused tests pass.

---

## File and Responsibility Map

**Create**

- `app/src/lib/transitIdentity.js` — classify normalized transit sections and validate/fallback line colors.
- `app/src/lib/__tests__/transitIdentity.test.js` — classification and color contracts.
- `app/src/components/nearby/JourneyIcon.jsx` — accessible-hidden bus, train, walk, and car SVGs.
- `app/src/components/nearby/TransitIdentity.jsx` — combined operator, vehicle, and route mark.
- `app/src/components/nearby/JourneyTimeline.jsx` — ordered, scrollable summary of every route section.
- `app/src/components/nearby/__tests__/JourneyTimeline.test.jsx` — timeline and accessibility rendering.
- `app/src/lib/tripWarnings.js` — match 511 informed entities to trips and deduplicate route warnings.
- `app/src/lib/__tests__/tripWarnings.test.js` — route/time/stop/direction matching and deduplication.
- `app/src/components/nearby/TripWarnings.jsx` — route-card warning summary/details; never standalone.
- `app/src/components/nearby/__tests__/TripWarnings.test.jsx` — compact and expanded route warnings.
- `app/src/test/fixtures/here-walking.json` — representative pedestrian route with multiple actions and a notice.
- `app/src/lib/hereWalking.js` — HERE Routing v8 pedestrian URL, normalization, cache, and failures.
- `app/src/lib/__tests__/hereWalking.test.js` — walking adapter contract.
- `app/src/hooks/useWalkingRoute.js` — lazy, abortable per-journey walking state.
- `app/src/hooks/__tests__/useWalkingRoute.test.jsx` — lazy load, stale suppression, retry, reset.
- `app/src/lib/mapsDirections.js` — Google Maps transit/walking URL builder.
- `app/src/lib/__tests__/mapsDirections.test.js` — mode-specific URL encoding.
- `app/src/lib/rideshareOptions.js` — normalize static property rides into a future-live-compatible shape.
- `app/src/lib/__tests__/rideshareOptions.test.js` — approximate-state and launch-link normalization.
- `app/src/components/nearby/RideshareOptions.jsx` — Uber/Lyft/Waymo approximate pickup cards.
- `app/src/components/nearby/__tests__/RideshareOptions.test.jsx` — labels, links, and unavailable actions.
- `app/src/components/nearby/TripModeSelector.jsx` — accessible Transit / Walk / Rideshare selector.
- `app/src/components/nearby/WalkingJourney.jsx` — full in-app walking summary/actions/error/retry.
- `app/src/components/nearby/__tests__/TripModeSelector.test.jsx` — selection semantics and icon labels.
- `app/src/components/nearby/__tests__/WalkingJourney.test.jsx` — complete steps, failures, links.

**Modify**

- `app/src/components/MuniLogo.jsx` — support decorative use inside a combined accessible transit identity.
- `app/src/components/nearby/TripCard.jsx` — use journey timeline and per-trip warnings.
- `app/src/components/nearby/TripOptions.jsx` — pass matched warning models; remove expanded-line alert ownership.
- `app/src/components/nearby/ItinerarySteps.jsx` — use shared transit identity in expanded legs.
- `app/src/components/nearby/__tests__/TripCard.test.jsx` — timeline and collapsed-warning expectations.
- `app/src/components/nearby/__tests__/TripOptions.test.jsx` — affected/unaffected route behavior.
- `app/src/components/nearby/__tests__/ItinerarySteps.test.jsx` — shared operator/vehicle identity.
- `app/src/lib/transit511.js` — preserve alert periods and informed-entity relationships.
- `app/src/lib/__tests__/transit511.test.js` — new normalized alert shape.
- `app/src/test/fixtures/511-alerts.json` — representative route, stop, direction, future, and unrelated entities.
- `app/src/hooks/useTransitAlerts.js` — accept an `enabled` option and cancel/pause work when false.
- `app/src/hooks/__tests__/useTransitAlerts.test.jsx` — disabled/no-fetch and disable-abort behavior.
- `app/src/components/screens/Nearby.jsx` — mode ownership and conditional provider panels; remove global alerts/rideshare block.
- `app/src/components/screens/Nearby.test.jsx` — destination-to-mode integration and no-global-alert contract.
- `app/src/data/properties/sfcottage.json` — replace `#` rideshare actions with verified provider pages and explicit approximate waits.

**Delete after replacements are green**

- `app/src/components/nearby/TransitAlerts.jsx`
- `app/src/components/nearby/__tests__/TransitAlerts.test.jsx`

---

### Task 1: Transit Identity Classification

**Files:**
- Create: `app/src/lib/transitIdentity.js`
- Create: `app/src/lib/__tests__/transitIdentity.test.js`

**Interfaces:**
- Consumes: a normalized HERE transit section with `agency` and `transport`.
- Produces: `classifyTransitLeg(section) -> { operator, operatorLabel, vehicle, vehicleLabel, lineLabel, color, accessibleLabel }`.
- Produces: `safeTransitColor(value, fallback) -> string`.

- [ ] **Step 1: Write the failing classifier tests**

```js
import { describe, expect, it } from 'vitest';
import { classifyTransitLeg, safeTransitColor } from '../transitIdentity.js';

const section = (agency, transport) => ({ type: 'transit', agency, transport });

describe('classifyTransitLeg', () => {
  it.each(['lightRail', 'metro', 'subway', 'tram', 'train'])(
    'classifies Muni %s as rail',
    (mode) => {
      expect(classifyTransitLeg(section(
        { id: 'SFMTA', name: 'San Francisco Municipal Transportation Agency' },
        { mode, shortName: 'K', name: 'K Ingleside', color: '#005B95' },
      ))).toMatchObject({
        operator: 'muni', operatorLabel: 'Muni', vehicle: 'train',
        vehicleLabel: 'train', lineLabel: 'K', color: '#005B95',
        accessibleLabel: 'Muni K train',
      });
    },
  );

  it('classifies a numbered Muni rapid route as a bus', () => {
    expect(classifyTransitLeg(section(
      { id: 'SF', name: 'Muni' },
      { mode: 'busRapid', shortName: '38R', name: '38R Geary Rapid' },
    ))).toMatchObject({
      operator: 'muni', vehicle: 'bus', lineLabel: '38R',
      accessibleLabel: 'Muni 38R bus',
    });
  });

  it('classifies every BART color line as a train and keeps its name', () => {
    for (const line of ['Blue', 'Yellow', 'Red', 'Green', 'Orange']) {
      expect(classifyTransitLeg(section(
        { id: 'BART', name: 'Bay Area Rapid Transit' },
        { mode: 'subway', shortName: line, name: `${line} Line` },
      ))).toMatchObject({
        operator: 'bart', operatorLabel: 'BART', vehicle: 'train',
        lineLabel: line, accessibleLabel: `BART ${line} train`,
      });
    }
  });

  it('uses the explicit rail mode before the digit-leading fallback', () => {
    expect(classifyTransitLeg(section(
      { id: 'SFMTA' }, { mode: 'lightRail', shortName: '1' },
    )).vehicle).toBe('train');
  });

  it('keeps an unknown operator leg visible with a generic identity', () => {
    expect(classifyTransitLeg(section(
      { name: 'Golden Gate Transit' }, { shortName: '101' },
    ))).toMatchObject({
      operator: 'other', operatorLabel: 'Golden Gate Transit',
      vehicle: 'transit', lineLabel: '101',
    });
  });
});

describe('safeTransitColor', () => {
  it('accepts six-digit hex and rejects unsafe or unreadable values', () => {
    expect(safeTransitColor('#009BDA', '#5A6B65')).toBe('#009BDA');
    expect(safeTransitColor('url(javascript:bad)', '#5A6B65')).toBe('#5A6B65');
    expect(safeTransitColor('#fff', '#5A6B65')).toBe('#5A6B65');
  });
});
```

- [ ] **Step 2: Run the classifier test to prove RED**

Run: `cd app && npm test -- src/lib/__tests__/transitIdentity.test.js`

Expected: FAIL because `transitIdentity.js` does not exist.

- [ ] **Step 3: Implement conservative agency/mode classification**

```js
const MUNI_AGENCY = /\b(SF|SFMTA|MUNI|SAN FRANCISCO MUNICIPAL)\b/i;
const BART_AGENCY = /\b(BART|BAY AREA RAPID TRANSIT)\b/i;
const RAIL_MODES = new Set(['lightrail', 'metro', 'subway', 'tram', 'train', 'rail']);
const BUS_MODES = new Set(['bus', 'busrapid', 'privatebus']);
const BART_COLORS = {
  BLUE: '#009BDA', YELLOW: '#F9DF3A', RED: '#ED1C24',
  GREEN: '#4DB848', ORANGE: '#F7931D',
};

const token = (value) => String(value ?? '').trim();
const modeToken = (value) => token(value).replace(/[-_\s]/g, '').toLowerCase();

export function safeTransitColor(value, fallback = '#5A6B65') {
  return /^#[0-9a-f]{6}$/i.test(token(value)) ? token(value) : fallback;
}

export function classifyTransitLeg(section) {
  const agencyText = [section?.agency?.id, section?.agency?.name].filter(Boolean).join(' ');
  const transport = section?.transport ?? {};
  const lineLabel = token(transport.shortName || transport.name || '?');
  const mode = modeToken(transport.mode);
  const isMuni = MUNI_AGENCY.test(agencyText);
  const isBart = BART_AGENCY.test(agencyText);
  const fallbackBus = isMuni && /^\d/.test(lineLabel);
  const vehicle = isBart || RAIL_MODES.has(mode)
    ? 'train'
    : BUS_MODES.has(mode) || fallbackBus
      ? 'bus'
      : 'transit';
  const operator = isMuni ? 'muni' : isBart ? 'bart' : 'other';
  const operatorLabel = isMuni ? 'Muni' : isBart ? 'BART' : token(section?.agency?.name || section?.agency?.id || 'Transit');
  const fallback = isBart ? BART_COLORS[lineLabel.toUpperCase()] || '#0077C0' : '#5A6B65';
  const color = safeTransitColor(transport.color, fallback);
  const vehicleLabel = vehicle === 'train' ? 'train' : vehicle === 'bus' ? 'bus' : 'transit';
  return {
    operator, operatorLabel, vehicle, vehicleLabel, lineLabel, color,
    accessibleLabel: `${operatorLabel} ${lineLabel} ${vehicleLabel}`,
  };
}
```

- [ ] **Step 4: Run focused GREEN and the existing HERE normalizer tests**

Run: `cd app && npm test -- src/lib/__tests__/transitIdentity.test.js src/lib/__tests__/hereTransit.test.js`

Expected: both files PASS.

- [ ] **Step 5: Commit the classifier**

```bash
git add app/src/lib/transitIdentity.js app/src/lib/__tests__/transitIdentity.test.js
git commit -m "feat: classify transit operator and vehicle identity"
```

---

### Task 2: Accessible Journey Timeline and Shared Transit Marks

**Files:**
- Create: `app/src/components/nearby/JourneyIcon.jsx`
- Create: `app/src/components/nearby/TransitIdentity.jsx`
- Create: `app/src/components/nearby/JourneyTimeline.jsx`
- Create: `app/src/components/nearby/__tests__/JourneyTimeline.test.jsx`
- Modify: `app/src/components/MuniLogo.jsx`
- Modify: `app/src/components/nearby/TripCard.jsx`
- Modify: `app/src/components/nearby/ItinerarySteps.jsx`
- Modify: `app/src/components/nearby/__tests__/TripCard.test.jsx`
- Modify: `app/src/components/nearby/__tests__/ItinerarySteps.test.jsx`

**Interfaces:**
- Consumes: `classifyTransitLeg(section)` from Task 1.
- Produces: `JourneyIcon({ type })`, where `type` is `bus|train|walk|car|transit`.
- Produces: `TransitIdentity({ section, compact = false })`.
- Produces: `JourneyTimeline({ sections })` with semantic ordered legs.

- [ ] **Step 1: Write failing timeline and shared-mark tests**

```jsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import JourneyTimeline from '../JourneyTimeline.jsx';

it('renders every section in order with operator and vehicle labels', () => {
  const sections = [
    { id: 'walk-1', type: 'pedestrian', durationSeconds: 300 },
    {
      id: 'rail-1', type: 'transit', durationSeconds: 900,
      agency: { id: 'SFMTA', name: 'Muni' },
      transport: { mode: 'lightRail', shortName: 'K', color: '#005B95' },
    },
    { id: 'walk-2', type: 'pedestrian', durationSeconds: 240 },
    {
      id: 'bus-1', type: 'transit', durationSeconds: 360,
      agency: { id: 'SF', name: 'Muni' },
      transport: { mode: 'bus', shortName: '29' },
    },
  ];
  render(<JourneyTimeline sections={sections} />);
  const list = screen.getByRole('list', { name: 'Journey timeline' });
  expect(within(list).getAllByRole('listitem')).toHaveLength(4);
  expect(within(list).getByLabelText('Muni K train')).toBeVisible();
  expect(within(list).getByLabelText('Muni 29 bus')).toBeVisible();
  expect(within(list).getAllByText(/walk/i)).toHaveLength(2);
});

it('keeps unknown sections instead of truncating the journey', () => {
  render(<JourneyTimeline sections={[{ type: 'unknown', label: 'Ferry transfer', durationSeconds: 120 }]} />);
  expect(screen.getByText('Ferry transfer')).toBeVisible();
});
```

Extend `TripCard.test.jsx` to assert the summary contains `role="list"` named “Journey timeline,” and extend `ItinerarySteps.test.jsx` to assert Muni K is labeled “Muni K train” inside the expanded itinerary.

- [ ] **Step 2: Run the component tests to prove RED**

Run: `cd app && npm test -- src/components/nearby/__tests__/JourneyTimeline.test.jsx src/components/nearby/__tests__/TripCard.test.jsx src/components/nearby/__tests__/ItinerarySteps.test.jsx`

Expected: FAIL because the timeline and shared identity components do not exist.

- [ ] **Step 3: Implement the icon, identity, and timeline components**

Use one `24×24` inline SVG component with `aria-hidden="true"`, `focusable="false"`, and explicit paths for each icon. The surrounding identity supplies the accessible name.

```jsx
export default function TransitIdentity({ section, compact = false }) {
  const identity = classifyTransitLeg(section);
  return (
    <span aria-label={identity.accessibleLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {identity.operator === 'muni' ? <MuniLogo height={compact ? 10 : 12} decorative /> : null}
      {identity.operator === 'bart' ? <span aria-hidden="true" style={lineBadgeStyle('BART', { size: 20, fontSize: '8px' })}>ba</span> : null}
      {identity.operator === 'other' ? <span aria-hidden="true">{identity.operatorLabel}</span> : null}
      <JourneyIcon type={identity.vehicle} />
      <span aria-hidden="true" style={{ background: identity.color, color: '#fff', borderRadius: 999, padding: '2px 6px', fontWeight: 700 }}>
        {identity.lineLabel}
      </span>
    </span>
  );
}
```

`JourneyTimeline` must map every section to one `<li>`, preserve input order, use `overflowX: 'auto'`, and give the list `aria-label="Journey timeline"`. Pedestrian legs render `JourneyIcon type="walk"`; transit legs render `TransitIdentity`; unknown legs render their label or “Route step.” Use `formatDuration` for leg durations.

Change `MuniLogo` to `MuniLogo({ height = 14, decorative = false })`. Decorative instances render `alt="" aria-hidden="true"`; standalone instances retain `alt="Muni"`.

Replace `TripLines` in `TripCard.jsx` with `<JourneyTimeline sections={trip.sections ?? []} />`. In `ItinerarySteps.jsx`, replace transit `LineBadge` usage with `<TransitIdentity section={section} />`; retain the existing vertical content and every itinerary section.

- [ ] **Step 4: Run focused GREEN and inspect narrow overflow semantics**

Run: `cd app && npm test -- src/components/nearby/__tests__/JourneyTimeline.test.jsx src/components/nearby/__tests__/TripCard.test.jsx src/components/nearby/__tests__/ItinerarySteps.test.jsx`

Expected: all tests PASS; no route section is omitted.

- [ ] **Step 5: Commit the journey timeline**

```bash
git add app/src/components/MuniLogo.jsx app/src/components/nearby/JourneyIcon.jsx app/src/components/nearby/TransitIdentity.jsx app/src/components/nearby/JourneyTimeline.jsx app/src/components/nearby/TripCard.jsx app/src/components/nearby/ItinerarySteps.jsx app/src/components/nearby/__tests__/JourneyTimeline.test.jsx app/src/components/nearby/__tests__/TripCard.test.jsx app/src/components/nearby/__tests__/ItinerarySteps.test.jsx
git commit -m "feat: render operator-aware journey timelines"
```

---

### Task 3: Route-Relevant Warnings and Removal of Global Alerts

**Files:**
- Modify: `app/src/test/fixtures/511-alerts.json`
- Modify: `app/src/lib/transit511.js`
- Modify: `app/src/lib/__tests__/transit511.test.js`
- Create: `app/src/lib/tripWarnings.js`
- Create: `app/src/lib/__tests__/tripWarnings.test.js`
- Modify: `app/src/hooks/useTransitAlerts.js`
- Modify: `app/src/hooks/__tests__/useTransitAlerts.test.jsx`
- Create: `app/src/components/nearby/TripWarnings.jsx`
- Create: `app/src/components/nearby/__tests__/TripWarnings.test.jsx`
- Modify: `app/src/components/nearby/TripCard.jsx`
- Modify: `app/src/components/nearby/TripOptions.jsx`
- Modify: `app/src/components/nearby/__tests__/TripCard.test.jsx`
- Modify: `app/src/components/nearby/__tests__/TripOptions.test.jsx`
- Modify: `app/src/components/screens/Nearby.jsx`
- Modify: `app/src/components/screens/Nearby.test.jsx`
- Delete: `app/src/components/nearby/TransitAlerts.jsx`
- Delete: `app/src/components/nearby/__tests__/TransitAlerts.test.jsx`

**Interfaces:**
- Consumes: normalized HERE trip sections plus 511 GTFS-realtime JSON.
- Produces: normalized alert `{ id, agency, severity, header, description, activePeriods, informedEntities, url, updatedAt }`.
- Produces: `warningsForTrip(trip, alerts) -> Array<{ id, header, description, severity, source, url }>`.
- Produces: `useTransitAlerts(agency = 'SF', { enabled = true } = {})` with pause/cancel behavior.
- Produces: `TripCard({ warnings, onToggle })`; removes line-ID arguments from `onToggle`.

- [ ] **Step 1: Expand the fixture and write failing normalization/matcher tests**

Add `StopId` and `DirectionId` to the K alert informed entity. Add a second informed entity for the same alert with a nonmatching stop, retain the unrelated 43 alert, and add a future K period. Then assert the new shape:

```js
expect(normalizeServiceAlerts(alertFixture, alertNow, 'SF')[0]).toMatchObject({
  id: 'sf-k-delay',
  activePeriods: [
    { start: '2026-07-28T18:00:00.000Z', end: '2026-07-28T21:00:00.000Z' },
    expect.objectContaining({ start: expect.any(String) }),
  ],
  informedEntities: expect.arrayContaining([
    { agencyId: 'SF', routeId: 'K', stopId: '17217', directionId: '1' },
  ]),
});
```

Create `tripWarnings.test.js` with a K trip whose agency is SFMTA, route is K, direction is `1`, travel window overlaps the alert, and stops include `17217`. Assert:

```js
expect(warningsForTrip(kTrip, alerts).map((warning) => warning.header)).toContain('K Ingleside delay');
expect(warningsForTrip(route43Trip, alerts).map((warning) => warning.header)).toContain('43 Masonic reroute');
expect(warningsForTrip(unrelatedTrip, alerts)).toEqual([]);
expect(warningsForTrip(kTripOutsidePeriod, alerts)).toEqual([]);
expect(warningsForTrip(kTripWrongDirection, alerts)).toEqual([]);
expect(warningsForTrip(kTripWrongStop, alerts)).toEqual([]);
```

Also add a HERE incident with the same summary as a 511 header and prove `warningsForTrip` returns it once.

- [ ] **Step 2: Write failing UI/hook tests for no global alerts**

Add to `useTransitAlerts.test.jsx`:

```jsx
it('does not fetch or poll while disabled and aborts when disabled', async () => {
  globalThis.fetch = vi.fn(() => new Promise(() => {}));
  const hook = renderHook(({ enabled }) => useTransitAlerts('SF', { enabled }), {
    initialProps: { enabled: false },
  });
  expect(globalThis.fetch).not.toHaveBeenCalled();
  hook.rerender({ enabled: true });
  await waitForHook(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
  hook.rerender({ enabled: false });
  expect(hook.result.current).toMatchObject({ alerts: [], status: 'idle' });
});
```

Update `Nearby.test.jsx` so a collapsed K route shows “K service delay,” a systemwide alert and 43 alert remain absent, and `queryByText('Current SF service alerts')` is absent. Assert `useTransitAlerts` receives `{ enabled: true }` only after successful transit options exist.

- [ ] **Step 3: Run all alert-focused tests to prove RED**

Run: `cd app && npm test -- src/lib/__tests__/transit511.test.js src/lib/__tests__/tripWarnings.test.js src/hooks/__tests__/useTransitAlerts.test.jsx src/components/nearby/__tests__/TripWarnings.test.jsx src/components/nearby/__tests__/TripOptions.test.jsx src/components/screens/Nearby.test.jsx`

Expected: FAIL on the old flattened alert shape, missing matcher/component, and unconditional hook.

- [ ] **Step 4: Preserve entity relationships and implement conservative matching**

Normalize every valid provider period and entity:

```js
const activePeriods = (Array.isArray(alert.ActivePeriods) ? alert.ActivePeriods : [])
  .map((period) => ({ start: isoGtfsTime(period?.Start), end: isoGtfsTime(period?.End) }))
  .filter((period) => period.start || period.end);
const informedEntities = (Array.isArray(alert.InformedEntities) ? alert.InformedEntities : [])
  .map((entity) => ({
    agencyId: String(entity?.AgencyId ?? agency ?? '').trim(),
    routeId: String(entity?.RouteId ?? '').trim(),
    stopId: String(entity?.StopId ?? '').trim(),
    directionId: String(entity?.DirectionId ?? '').trim(),
  }));
```

In `tripWarnings.js`, canonicalize `SF`, `SFMTA`, and Muni agency names to `MUNI`; canonicalize BART names to `BART`; compare route IDs case-insensitively but do not perform substring matches. Period overlap is `alertStart < legEnd && legStart < alertEnd`, with missing bounds treated as unbounded; an empty period list is also unbounded. Only enforce stop/direction when both sides have comparable data. Require a non-empty alert route ID.

Gather trip stop identifiers from transit section departure, intermediate stops, and arrival using both `id` and `stopCode`. Gather HERE incidents/notices into the same warning model and deduplicate first by stable ID, then by normalized `header + description`.

- [ ] **Step 5: Implement route-only UI and pauseable fetching**

`TripWarnings` must return `null` for an empty list. In compact mode, render a visible warning block on the collapsed card; in expanded mode, provide details and links. It never accepts provider status and has no standalone mode.

`TripOptions` computes `warningsForTrip(trip, alerts)` per card. `TripCard` renders compact warnings before its expansion button and expanded warnings above `ItinerarySteps`. Remove line-ID callbacks and expansion alert ownership.

Update `useTransitAlerts` so `enabled: false` aborts the controller, clears its timer, increments request version, and returns `{ alerts: [], status: 'idle', updatedAt: null, error: null, refresh }` without fetching.

In `Nearby.jsx`, temporarily enable alerts with:

```js
const alertsEnabled = Boolean(planner.routeResult?.ok && planner.routeResult.trips?.length);
const { alerts } = useTransitAlerts('SF', { enabled: alertsEnabled });
```

Delete the standalone `<TransitAlerts>` block, its state/effect/import, the component, and its old standalone tests.

- [ ] **Step 6: Run alert-focused GREEN**

Run: `cd app && npm test -- src/lib/__tests__/transit511.test.js src/lib/__tests__/tripWarnings.test.js src/hooks/__tests__/useTransitAlerts.test.jsx src/components/nearby/__tests__/TripWarnings.test.jsx src/components/nearby/__tests__/TripCard.test.jsx src/components/nearby/__tests__/TripOptions.test.jsx src/components/screens/Nearby.test.jsx`

Expected: all files PASS; no unmatched/global alert or alert status is rendered.

- [ ] **Step 7: Commit route-relevant warnings**

```bash
git add app/src/test/fixtures/511-alerts.json app/src/lib/transit511.js app/src/lib/__tests__/transit511.test.js app/src/lib/tripWarnings.js app/src/lib/__tests__/tripWarnings.test.js app/src/hooks/useTransitAlerts.js app/src/hooks/__tests__/useTransitAlerts.test.jsx app/src/components/nearby/TripWarnings.jsx app/src/components/nearby/__tests__/TripWarnings.test.jsx app/src/components/nearby/TripCard.jsx app/src/components/nearby/TripOptions.jsx app/src/components/nearby/__tests__/TripCard.test.jsx app/src/components/nearby/__tests__/TripOptions.test.jsx app/src/components/screens/Nearby.jsx app/src/components/screens/Nearby.test.jsx
git add -u app/src/components/nearby/TransitAlerts.jsx app/src/components/nearby/__tests__/TransitAlerts.test.jsx
git commit -m "feat: scope service warnings to affected trips"
```

---

### Task 4: HERE Pedestrian Adapter and Lazy Hook

**Files:**
- Create: `app/src/test/fixtures/here-walking.json`
- Create: `app/src/lib/hereWalking.js`
- Create: `app/src/lib/__tests__/hereWalking.test.js`
- Create: `app/src/hooks/useWalkingRoute.js`
- Create: `app/src/hooks/__tests__/useWalkingRoute.test.jsx`

**Interfaces:**
- Produces: `buildHereWalkingUrl(origin, destination, apiKey) -> URL`.
- Produces: `normalizeHereWalking(payload) -> { id, durationSeconds, lengthMeters, sections, actions, notices } | null`.
- Produces: `fetchHereWalkingRoute(origin, destination, options) -> { ok, route?, reason?, source?, fetchedAt?, expiresAt? }`.
- Produces: `useWalkingRoute({ origin, destination, enabled }) -> { routeResult, retryWalking }`.

- [ ] **Step 1: Create the walking fixture and failing adapter tests**

The fixture contains one pedestrian route with two sections, section summaries, departure/arrival places, at least four actions with instructions, and one notice. Test the exact URL contract:

```js
const url = buildHereWalkingUrl(
  { lat: 37.77154, lng: -122.41761 },
  { lat: 37.7596, lng: -122.4269 },
  'test-key-not-a-credential',
);
expect(url.origin + url.pathname).toBe('https://router.hereapi.com/v8/routes');
expect(url.searchParams.get('routingMode')).toBe('fast');
expect(url.searchParams.get('transportMode')).toBe('pedestrian');
expect(url.searchParams.get('return')).toBe('polyline,summary,actions,instructions');
expect(url.searchParams.get('units')).toBe('imperial');
expect(url.searchParams.get('lang')).toBe('en-US');

const route = normalizeHereWalking(walkingFixture);
expect(route).toMatchObject({
  id: expect.any(String),
  durationSeconds: expect.any(Number),
  lengthMeters: expect.any(Number),
  sections: expect.any(Array),
  actions: expect.any(Array),
  notices: expect.any(Array),
});
expect(route.actions).toHaveLength(4);
```

Assert normalization preserves every section/action, sums duration/length, and maps unknown action types to `{ type: 'unknown', label, instruction }`. Copy the existing provider failure table from `hereTransit.test.js`: missing key, invalid coordinates, unauthorized, rate-limited, timeout, abort, network, invalid JSON, empty route, cache hit, and cache write failure.

- [ ] **Step 2: Write failing hook tests**

Mock `fetchHereWalkingRoute` and prove:

```jsx
const hook = renderHook(({ enabled, destination }) => useWalkingRoute({
  origin: { lat: 37.77154, lng: -122.41761 }, destination, enabled,
}), { initialProps: { enabled: false, destination } });
expect(fetchHereWalkingRoute).not.toHaveBeenCalled();
hook.rerender({ enabled: true, destination });
await vi.waitFor(() => expect(hook.result.current.routeResult?.ok).toBe(true));
expect(fetchHereWalkingRoute).toHaveBeenCalledTimes(1);
```

Add deferred calls proving a superseded destination and an unmounted hook cannot apply stale results. Prove retry preserves the same origin/destination. After a successful result, disabling the hook must abort polling/work but preserve that result for the unchanged journey; changing or removing the destination clears it.

- [ ] **Step 3: Run walking tests to prove RED**

Run: `cd app && npm test -- src/lib/__tests__/hereWalking.test.js src/hooks/__tests__/useWalkingRoute.test.jsx`

Expected: FAIL because adapter and hook do not exist.

- [ ] **Step 4: Implement walking request normalization and caching**

Use `https://router.hereapi.com/v8/routes`, `routingMode=fast`, `transportMode=pedestrian`, `return=polyline,summary,actions,instructions`, `units=imperial`, and `lang=en-US`. Reuse `isFinitePosition`, provider failure helpers, `sharedProviderRequest`, `cacheUntilFromHeaders`, and `providerResponseStore`. The cache key is:

```js
`here-walking:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}:fast:imperial:en-US`
```

Never include the API key. Cache only when response headers permit. Return `no-route` when no valid route normalizes.

- [ ] **Step 5: Implement the lazy abortable hook**

The hook starts only when `enabled && destination` is true. It aborts an older controller before every request, uses controller identity to reject stale completion, preserves a successful result while disabled for the same origin/destination key, clears state when that key changes or the destination is removed, exposes retry, and aborts on unmount. On re-enable, skip the adapter call when the preserved result key still matches. Use the same stale-result guard pattern as `useHereTripPlanner`.

- [ ] **Step 6: Run focused GREEN**

Run: `cd app && npm test -- src/lib/__tests__/hereWalking.test.js src/hooks/__tests__/useWalkingRoute.test.jsx`

Expected: both files PASS.

- [ ] **Step 7: Commit walking data support**

```bash
git add app/src/test/fixtures/here-walking.json app/src/lib/hereWalking.js app/src/lib/__tests__/hereWalking.test.js app/src/hooks/useWalkingRoute.js app/src/hooks/__tests__/useWalkingRoute.test.jsx
git commit -m "feat: add lazy in-app pedestrian routing"
```

---

### Task 5: Maps Links and Future-Ready Static Rideshare Panel

**Files:**
- Create: `app/src/lib/mapsDirections.js`
- Create: `app/src/lib/__tests__/mapsDirections.test.js`
- Create: `app/src/lib/rideshareOptions.js`
- Create: `app/src/lib/__tests__/rideshareOptions.test.js`
- Create: `app/src/components/nearby/RideshareOptions.jsx`
- Create: `app/src/components/nearby/__tests__/RideshareOptions.test.jsx`
- Modify: `app/src/data/properties/sfcottage.json`

**Interfaces:**
- Produces: `googleMapsDirectionsUrl(origin, destination, mode) -> string`, mode restricted to `transit|walking`.
- Produces: `normalizeRideshareOptions(rides) -> Array<{ providerId, name, estimateKind, pickupWaitLabel, note, color, launchUrl|null }>`.
- Produces: `RideshareOptions({ rides })`.

- [ ] **Step 1: Write failing maps/rideshare tests**

```js
expect(googleMapsDirectionsUrl(origin, destination, 'transit')).toContain('travelmode=transit');
expect(googleMapsDirectionsUrl(origin, destination, 'walking')).toContain('travelmode=walking');
expect(() => googleMapsDirectionsUrl(origin, destination, 'driving')).toThrow(TypeError);
expect(new URL(googleMapsDirectionsUrl(origin, destination, 'walking')).searchParams.get('origin')).toBe('37.77154,-122.41761');
```

```js
expect(normalizeRideshareOptions([
  { name: 'Uber', note: 'Usually 3–6 min away', color: '#14201D', launchUrl: 'https://m.uber.com/' },
])).toEqual([{
  providerId: 'uber', name: 'Uber', estimateKind: 'approximate',
  pickupWaitLabel: 'Usually 3–6 min away', note: 'Approximate pickup wait',
  color: '#14201D', launchUrl: 'https://m.uber.com/',
}]);
```

Test that `#`, `javascript:`, malformed, and non-HTTPS URLs become `null`.

In `RideshareOptions.test.jsx`, assert “Approximate pickup waits,” all three providers, all estimate labels, and provider-specific “Open Uber/Lyft/Waymo” links. Assert an invalid launch URL renders “Launch unavailable” without an anchor.

- [ ] **Step 2: Run focused tests to prove RED**

Run: `cd app && npm test -- src/lib/__tests__/mapsDirections.test.js src/lib/__tests__/rideshareOptions.test.js src/components/nearby/__tests__/RideshareOptions.test.jsx`

Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement URLs, normalization, and cards**

The Google Maps base is `https://www.google.com/maps/dir/` with `api=1`, encoded coordinate origin/destination, and the exact allowed travel mode.

Rideshare normalization derives `providerId` from lowercase alphanumeric provider name, forces `estimateKind: 'approximate'`, preserves the property wait label, validates six-digit colors, and accepts only HTTPS launch URLs.

Update property rides:

```json
[
  { "name": "Uber", "note": "Usually 3–6 min away", "color": "#14201D", "launchUrl": "https://m.uber.com/" },
  { "name": "Lyft", "note": "Usually 4–8 min away", "color": "#7A2E8E", "launchUrl": "https://ride.lyft.com/" },
  { "name": "Waymo", "note": "Usually 5–12 min away", "color": "#0B7A5A", "launchUrl": "https://waymo.com/waymo-one/" }
]
```

Remove `referralUrl` and `_todo` fields for these entries. `RideshareOptions` renders a labeled section, “Approximate—not live” copy, and safe external anchors with `target="_blank" rel="noreferrer"`.

- [ ] **Step 4: Run focused GREEN and validate JSON**

Run: `cd app && npm test -- src/lib/__tests__/mapsDirections.test.js src/lib/__tests__/rideshareOptions.test.js src/components/nearby/__tests__/RideshareOptions.test.jsx && node -e "JSON.parse(require('fs').readFileSync('src/data/properties/sfcottage.json','utf8'))"`

Expected: tests PASS and JSON parse exits 0.

- [ ] **Step 5: Commit static rideshare support**

```bash
git add app/src/lib/mapsDirections.js app/src/lib/__tests__/mapsDirections.test.js app/src/lib/rideshareOptions.js app/src/lib/__tests__/rideshareOptions.test.js app/src/components/nearby/RideshareOptions.jsx app/src/components/nearby/__tests__/RideshareOptions.test.jsx app/src/data/properties/sfcottage.json
git commit -m "feat: add approximate rideshare choices"
```

---

### Task 6: Transit / Walk / Rideshare Mode Experience

**Files:**
- Create: `app/src/components/nearby/TripModeSelector.jsx`
- Create: `app/src/components/nearby/WalkingJourney.jsx`
- Create: `app/src/components/nearby/__tests__/TripModeSelector.test.jsx`
- Create: `app/src/components/nearby/__tests__/WalkingJourney.test.jsx`
- Modify: `app/src/components/screens/Nearby.jsx`
- Modify: `app/src/components/screens/Nearby.test.jsx`
- Modify: `app/src/components/nearby/TripCard.jsx`
- Modify: `app/src/components/nearby/__tests__/TripCard.test.jsx`

**Interfaces:**
- Consumes: `JourneyIcon`, `useWalkingRoute`, `googleMapsDirectionsUrl`, `RideshareOptions`, and pauseable `useTransitAlerts`.
- Produces: `TripModeSelector({ value, onChange })`, value restricted to `transit|walk|rideshare`.
- Produces: `WalkingJourney({ result, onRetry, externalUrl })`.

- [ ] **Step 1: Write failing selector and walking-panel tests**

```jsx
render(<TripModeSelector value="transit" onChange={onChange} />);
expect(screen.getByRole('button', { name: 'Transit' })).toHaveAttribute('aria-pressed', 'true');
expect(screen.getByRole('button', { name: 'Walk' })).toHaveAttribute('aria-pressed', 'false');
fireEvent.click(screen.getByRole('button', { name: 'Walk' }));
expect(onChange).toHaveBeenCalledWith('walk');
expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Transit', 'Walk', 'Rideshare']);
```

```jsx
render(<WalkingJourney result={{ ok: true, route: walkingRoute, source: 'network', fetchedAt }} externalUrl="https://example.test/walk" />);
expect(screen.getAllByRole('listitem')).toHaveLength(walkingRoute.actions.length);
expect(screen.getByText(/walk 1\.2 mi/i)).toBeVisible();
expect(screen.getByRole('link', { name: /open walking directions in google maps/i })).toHaveAttribute('href', 'https://example.test/walk');
```

Cover `result === null` loading, each walking failure message, retry button, zero omitted actions, and external-link presence even after provider failure.

- [ ] **Step 2: Write failing Nearby integration tests**

Mock `useWalkingRoute` and update the alert-hook mock signature. After destination selection, assert:

```jsx
expect(screen.getByRole('button', { name: 'Transit' })).toHaveAttribute('aria-pressed', 'true');
fireEvent.click(screen.getByRole('button', { name: 'Walk' }));
expect(useWalkingRoute).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
expect(screen.getByRole('region', { name: 'Walking directions' })).toBeVisible();
expect(screen.queryByRole('region', { name: 'Transit options' })).not.toBeInTheDocument();
expect(useTransitAlerts).toHaveBeenLastCalledWith('SF', { enabled: false });
fireEvent.click(screen.getByRole('button', { name: 'Rideshare' }));
expect(screen.getByRole('region', { name: 'Rideshare options' })).toBeVisible();
```

Change origin and destination in separate tests; both must reset mode to Transit. Prove returning to Walk for the same context reuses the hook result without a duplicate provider call. Prove transit failure does not remove Walk or Rideshare.

- [ ] **Step 3: Run mode tests to prove RED**

Run: `cd app && npm test -- src/components/nearby/__tests__/TripModeSelector.test.jsx src/components/nearby/__tests__/WalkingJourney.test.jsx src/components/screens/Nearby.test.jsx`

Expected: FAIL because selector/panel and mode integration do not exist.

- [ ] **Step 4: Implement selector and walking panel**

`TripModeSelector` renders three text buttons in the approved order using `JourneyIcon` types `bus`, `walk`, and `car`. Use `aria-pressed`, visible focus, 44px minimum touch height, and CSS transition disabled under `prefers-reduced-motion` via the app stylesheet or a static style block already used by the project.

`WalkingJourney` renders a region named “Walking directions,” total duration/distance, every action in one ordered list, notices, live/cache status, retry on failure, and the walking Google Maps link whenever origin/destination are valid.

- [ ] **Step 5: Integrate mode ownership in Nearby**

Add:

```jsx
const [activeMode, setActiveMode] = useState('transit');
const journeyKey = selectedPosition ? `${origin.lat},${origin.lng}:${selectedPosition.lat},${selectedPosition.lng}` : '';
const previousJourneyKey = useRef(journeyKey);
useEffect(() => {
  if (previousJourneyKey.current === journeyKey) return;
  previousJourneyKey.current = journeyKey;
  setActiveMode('transit');
}, [journeyKey]);
```

Call:

```jsx
const walking = useWalkingRoute({ origin, destination: selectedPosition, enabled: activeMode === 'walk' });
const alertsEnabled = activeMode === 'transit' && Boolean(planner.routeResult?.ok && planner.routeResult.trips?.length);
const { alerts } = useTransitAlerts('SF', { enabled: alertsEnabled });
```

Render the selector only when a destination exists. Render exactly one mode panel. Transit receives a Google Maps transit URL, Walk receives the walking URL, and Rideshare receives normalized property entries. Remove the old always-visible rideshare section and local `mapsUrl` helper. Nearby departures, curated suggestions/back-home guidance, and “How to ride” remain below the selected mode panel.

Change the expanded transit link copy from “Open in maps” to “Open transit directions in Google Maps” and test its `travelmode=transit` parameter.

- [ ] **Step 6: Run integration GREEN**

Run: `cd app && npm test -- src/components/nearby/__tests__/TripModeSelector.test.jsx src/components/nearby/__tests__/WalkingJourney.test.jsx src/components/nearby/__tests__/TripCard.test.jsx src/components/screens/Nearby.test.jsx`

Expected: all files PASS; Transit is default, Walk is complete, Rideshare is approximate, and alert fetching pauses outside Transit.

- [ ] **Step 7: Commit the mode experience**

```bash
git add app/src/components/nearby/TripModeSelector.jsx app/src/components/nearby/WalkingJourney.jsx app/src/components/nearby/__tests__/TripModeSelector.test.jsx app/src/components/nearby/__tests__/WalkingJourney.test.jsx app/src/components/nearby/TripCard.jsx app/src/components/nearby/__tests__/TripCard.test.jsx app/src/components/screens/Nearby.jsx app/src/components/screens/Nearby.test.jsx
git commit -m "feat: add transit walk and rideshare modes"
```

---

### Task 7: Whole-Feature Verification, Review, and Publication

**Files:**
- None. If a verification or review failure occurs, stop and add a focused fix task naming its exact files before editing.

**Interfaces:**
- Consumes: the complete feature branch.
- Produces: a reviewed PR, exact-SHA Pages deployment, and mobile live-smoke evidence.

- [ ] **Step 1: Run the complete local gate fresh**

Run:

```bash
cd app
npm test
npm run lint
npm run build
git diff --check origin/main...HEAD
```

Expected: all tests PASS; lint exits 0; Vite/PWA build exits 0; diff check is clean. Existing warnings may be reported but no new warning may originate in changed files.

- [ ] **Step 2: Prove POI scope and legacy-alert removal**

Run from repository root:

```bash
git diff --name-only origin/main...HEAD
! git diff origin/main...HEAD -- app/src/components/screens/Explore.jsx | rg '.'
! git diff origin/main...HEAD -- app/src/data/properties/sfcottage.json | rg '"explore"|"food"|"poi"|"destSuggestions"'
! rg -n 'Current SF service alerts|excludeLineIds|expandedAlertLineIds|referralUrl|"#"' app/src/components app/src/data/properties/sfcottage.json
```

Expected: no POI/Explore diff, no legacy global-alert ownership, and no placeholder rideshare action.

- [ ] **Step 3: Run independent code review and fix only verified findings**

Use `superpowers:requesting-code-review` on `origin/main...HEAD`. If it reports a Critical or Important finding, stop this task, add a focused plan task with exact files and a falsifiable RED/GREEN test, execute that task, obtain scoped re-review, and then restart Task 7 at Step 1.

- [ ] **Step 4: Run the mobile browser acceptance smoke**

At a 430×900 viewport with a fresh context and service workers blocked:

1. open the app and use a controlled SF origin;
2. search/select a deterministic destination;
3. verify Transit is selected and every option has an ordered journey timeline;
4. verify injected Muni rail, Muni bus, and BART fixtures expose the exact accessible labels;
5. verify an unrelated SF alert is absent and a matching alert warns only its route card;
6. switch to Walk and verify all actions plus a `travelmode=walking` Google Maps link;
7. switch to Rideshare and verify Uber, Lyft, and Waymo approximate waits and safe launch links;
8. return to Transit and verify a `travelmode=transit` Google Maps link;
9. keyboard through the selector/timeline and verify a long timeline scrolls without omitted text;
10. verify zero page errors and no unexpected console errors.

- [ ] **Step 5: Push and open a PR**

Use `superpowers:finishing-a-development-branch` and present its integration choices. If the user chooses the PR path, push the named feature branch and open a PR whose description lists the mode UI, walking adapter, operator identities, route-only warnings, static rideshare seam, test count, and POI non-goal. Do not push or open a PR before that choice.

- [ ] **Step 6: Process PR review and checks**

Wait for every repository check on the exact head. Inspect review bodies and unresolved threads directly. Apply only valid feedback with focused tests and re-review; never dismiss or manually resolve a reviewer thread without explicit authorization. Re-run the complete local gate on the final head.

- [ ] **Step 7: Merge normally and verify exact deployment SHA**

After the user-authorized merge path and clean checks/reviews, merge without admin override. Record the merge SHA, locate the GitHub Pages run with that exact `headSha`, and wait for both build and deploy jobs to succeed.

- [ ] **Step 8: Run the production smoke and report evidence**

Repeat Step 4 against the deployed URL in a fresh browser context. Report the PR URL, merge SHA, exact Pages run, test count, route-specific alert proof, walking/rideshare proof, and POI non-change proof. Do not claim completion if any required assertion is unverified.

---

## Primary References

- Approved design: `docs/superpowers/specs/2026-07-30-journey-modes-and-relevant-alerts-design.md`
- HERE Routing API v8 transport modes: https://docs.here.com/routing/docs/routing-v8-transport-modes-overview
- HERE Routing API v8 route calculation: https://docs.here.com/routing/reference/routing-api-v8-calculateroutes
- HERE Routing API v8 display instructions: https://docs.here.com/routing/docs/routing-v8-instructions-display
- HERE Public Transit API v8 routes: https://docs.here.com/transit/reference/getroutes
- Provider launch pages: https://m.uber.com/ · https://ride.lyft.com/ · https://waymo.com/waymo-one/
