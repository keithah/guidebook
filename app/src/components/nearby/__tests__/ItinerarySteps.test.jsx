import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import fixture from '../../../test/fixtures/here-transit.json';
import { normalizeHereRoutes } from '../../../lib/hereTransit.js';
import ItinerarySteps from '../ItinerarySteps.jsx';
import { formatDuration } from '../itineraryFormat.jsx';

const plannedAt = '2026-07-28T18:00:00.000Z';

afterEach(cleanup);

describe('ItinerarySteps', () => {
  it('renders every section and keeps walking maneuvers in their own sections', () => {
    const [trip] = normalizeHereRoutes(fixture, plannedAt);

    render(<ItinerarySteps trip={trip} />);

    expect(screen.getByRole('list', { name: /full itinerary/i })).toBeVisible();
    expect(screen.getAllByTestId('itinerary-section')).toHaveLength(
      trip.sections.length,
    );
    expect(
      screen.getByRole('heading', { name: /walk to west portal station/i }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', {
        name: /k ingleside toward embarcadero/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: /walk to union square/i }),
    ).toBeVisible();

    const walkingGroups = screen.getAllByTestId('walking-maneuvers');
    expect(walkingGroups).toHaveLength(2);
    expect(
      within(walkingGroups[0]).getByText('Turn right onto West Portal Avenue.'),
    ).toBeVisible();
    expect(
      within(walkingGroups[1]).getByText('Continue toward Union Square.'),
    ).toBeVisible();
    expect(
      within(walkingGroups[0]).queryByText('Continue toward Union Square.'),
    ).not.toBeInTheDocument();
  });

  it('renders platforms, stops, transit details, intermediate stops, and arrival', () => {
    const [trip] = normalizeHereRoutes(fixture, plannedAt);

    const { container } = render(<ItinerarySteps trip={trip} />);

    expect(screen.getAllByText(/platform 2/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/stop 17217/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/board the k ingleside toward embarcadero/i),
    ).toBeVisible();
    expect(screen.getByText('Forest Hill Station')).toBeVisible();
    expect(screen.getByText('Castro Station')).toBeVisible();
    expect(
      screen.getByText(/leave the train at montgomery street/i),
    ).toBeVisible();
    expect(screen.getByText(/arrive at union square/i)).toBeVisible();
    expect(
      container.querySelector('time[datetime="2026-07-28T18:07:00-07:00"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('time[datetime="2026-07-28T18:11:00-07:00"]'),
    ).toBeInTheDocument();
  });

  it('keeps transfer instructions and all transfer sections visible', () => {
    const [, trip] = normalizeHereRoutes(fixture, plannedAt);

    render(<ItinerarySteps trip={trip} />);

    expect(screen.getAllByTestId('itinerary-section')).toHaveLength(5);
    expect(screen.getByText('Wait for a safe crossing.')).toBeVisible();
    expect(screen.getByText('Cross Market Street to Stop B.')).toBeVisible();
    expect(
      screen.getByText('Board the 38R toward Transit Center.'),
    ).toBeVisible();
    expect(screen.getByText('Leave the bus at Powell Street.')).toBeVisible();
  });

  it('renders generic rows for unknown sections and actions', () => {
    const payload = structuredClone(fixture);
    payload.routes[0].sections[0].actions.splice(1, 0, {
      action: 'moonwalk',
      duration: 5,
      instruction: 'Moonwalk across the plaza.',
    });
    const trips = normalizeHereRoutes(payload, plannedAt);
    const unknownActionTrip = trips[0];
    const unknownSectionTrip = trips[2];

    const { rerender } = render(<ItinerarySteps trip={unknownActionTrip} />);
    expect(screen.getByText('Moonwalk across the plaza.')).toBeVisible();

    rerender(<ItinerarySteps trip={unknownSectionTrip} />);
    expect(screen.getAllByTestId('itinerary-section')).toHaveLength(1);
    expect(
      screen.getByRole('heading', { name: /gondola portal/i }),
    ).toBeVisible();
    expect(screen.getByText('Step into the transfer portal.')).toBeVisible();
  });

  it('formats route durations for guest-facing summaries', () => {
    expect(formatDuration(0)).toBe('1 min');
    expect(formatDuration(660)).toBe('11 min');
    expect(formatDuration(3_600)).toBe('1 hr');
    expect(formatDuration(3_900)).toBe('1 hr 5 min');
    expect(formatDuration(Number.NaN)).toBe('0 min');
  });
});
