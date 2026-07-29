import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import fixture from '../../../test/fixtures/here-transit.json';
import { normalizeHereRoutes } from '../../../lib/hereTransit.js';
import TripCard from '../TripCard.jsx';

const plannedAt = '2026-07-28T18:00:00.000Z';
const [directTrip, transferTrip, unknownTrip] = normalizeHereRoutes(
  fixture,
  plannedAt,
);

afterEach(cleanup);

describe('TripCard', () => {
  it('shows the recommended badge only for the first ranked trip', () => {
    const { rerender } = render(
      <TripCard
        trip={directTrip}
        index={0}
        expanded={false}
        onToggle={() => {}}
        alerts={[]}
      />,
    );
    expect(screen.getByText('Recommended')).toBeVisible();

    rerender(
      <TripCard
        trip={directTrip}
        index={1}
        expanded={false}
        onToggle={() => {}}
        alerts={[]}
      />,
    );
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument();
  });

  it('renders departure/arrival times, duration, walking time, and transfers for a direct trip', () => {
    const { container } = render(
      <TripCard
        trip={directTrip}
        index={0}
        expanded={false}
        onToggle={() => {}}
        alerts={[]}
      />,
    );

    expect(
      container.querySelector('time[datetime="2026-07-28T18:00:00-07:00"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('time[datetime="2026-07-28T18:30:00-07:00"]'),
    ).toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeVisible();
    expect(screen.getByText(/walk 11 min/i)).toBeVisible();
    expect(screen.getByText('No transfers')).toBeVisible();
    expect(screen.getByText(/K Ingleside toward Embarcadero/)).toBeVisible();
  });

  it('summarizes a multi-leg trip with its transfer count and combined walking time', () => {
    render(
      <TripCard
        trip={transferTrip}
        index={1}
        expanded={false}
        onToggle={() => {}}
        alerts={[]}
      />,
    );

    expect(screen.getByText('27 min')).toBeVisible();
    expect(screen.getByText(/walk 7 min/i)).toBeVisible();
    expect(screen.getByText(/1 transfer\b/i)).toBeVisible();
    expect(screen.getByText(/N Judah toward Caltrain/)).toBeVisible();
    expect(screen.getByText(/38R Geary Rapid toward Transit Center/)).toBeVisible();
  });

  it('falls back to the first section label and "No walking" for a trip with no transit sections', () => {
    render(
      <TripCard
        trip={unknownTrip}
        index={2}
        expanded={false}
        onToggle={() => {}}
        alerts={[]}
      />,
    );

    expect(screen.getByText('No walking')).toBeVisible();
    expect(screen.getByText('No transfers')).toBeVisible();
    expect(screen.getByText('Gondola portal')).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: /view full itinerary for gondola portal/i,
      }),
    ).toBeInTheDocument();
  });

  it('shows "Time pending", a generic option label, and a plural transfer count when trip data is sparse', () => {
    const sparseTrip = {
      id: 'trip-sparse',
      sections: [],
      lines: [],
      transferCount: 2,
      walkingDurationSeconds: 0,
      durationSeconds: undefined,
      departureTime: null,
      arrivalTime: 'not-a-real-date',
    };

    render(
      <TripCard
        trip={sparseTrip}
        index={0}
        expanded={false}
        onToggle={() => {}}
        alerts={[]}
      />,
    );

    expect(screen.getAllByText('Time pending')).toHaveLength(2);
    expect(screen.getByText('1 min')).toBeVisible();
    expect(screen.getByText('Transit option')).toBeVisible();
    expect(screen.getByText('2 transfers')).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: /view full itinerary for transit option/i,
      }),
    ).toBeInTheDocument();
  });

  it('toggles the itinerary, notifies the parent with the trip line ids, and links to external directions', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <TripCard
        trip={directTrip}
        index={0}
        expanded={false}
        onToggle={onToggle}
        alerts={[]}
        externalUrl="https://example.test/directions/route-k"
      />,
    );

    const toggle = screen.getByRole('button', {
      name: /view full itinerary for k ingleside/i,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const controlledRegion = document.getElementById(
      toggle.getAttribute('aria-controls'),
    );
    expect(controlledRegion).toHaveAttribute('hidden');
    expect(screen.queryByTestId('itinerary-section')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(['K']);

    rerender(
      <TripCard
        trip={directTrip}
        index={0}
        expanded
        onToggle={onToggle}
        alerts={[]}
        externalUrl="https://example.test/directions/route-k"
      />,
    );

    const hideToggle = screen.getByRole('button', {
      name: /hide full itinerary for k ingleside/i,
    });
    expect(hideToggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(hideToggle.getAttribute('aria-controls'))).not.toHaveAttribute(
      'hidden',
    );
    expect(screen.getAllByTestId('itinerary-section').length).toBeGreaterThan(0);
    const mapsLink = screen.getByRole('link', { name: /open in maps/i });
    expect(mapsLink).toHaveAttribute(
      'href',
      'https://example.test/directions/route-k',
    );
    expect(mapsLink).toHaveAttribute('target', '_blank');
    expect(mapsLink).toHaveAttribute('rel', 'noreferrer');

    fireEvent.click(hideToggle);
    expect(onToggle).toHaveBeenCalledWith(['K']);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('reports every distinct transit line id for a multi-leg trip when toggled', () => {
    const onToggle = vi.fn();
    render(
      <TripCard
        trip={transferTrip}
        index={1}
        expanded={false}
        onToggle={onToggle}
        alerts={[]}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /view full itinerary/i }),
    );
    expect(onToggle).toHaveBeenCalledWith(['N', '38R']);
  });

  it('omits the external maps link when no external URL is supplied', () => {
    render(
      <TripCard
        trip={directTrip}
        index={0}
        expanded
        onToggle={() => {}}
        alerts={[]}
      />,
    );

    expect(
      screen.queryByRole('link', { name: /open in maps/i }),
    ).not.toBeInTheDocument();
  });

  it('shows only the alert relevant to this trip when expanded', () => {
    const alerts = [
      {
        id: 'k-delay',
        affectedLines: ['K'],
        header: 'K Ingleside delay',
      },
      {
        id: 'n-delay',
        affectedLines: ['N'],
        header: 'N Judah delay',
      },
    ];

    render(
      <TripCard
        trip={directTrip}
        index={0}
        expanded
        onToggle={() => {}}
        alerts={alerts}
      />,
    );

    expect(screen.getByText('K Ingleside delay')).toBeVisible();
    expect(screen.queryByText('N Judah delay')).not.toBeInTheDocument();
  });

  it('renders a plural transfer label for exactly two transfers, and singular for exactly one', () => {
    const twoTransferTrip = { ...directTrip, transferCount: 2 };
    const { rerender } = render(
      <TripCard
        trip={twoTransferTrip}
        index={0}
        expanded={false}
        onToggle={() => {}}
        alerts={[]}
      />,
    );
    expect(screen.getByText('2 transfers')).toBeVisible();

    rerender(
      <TripCard
        trip={{ ...directTrip, transferCount: 1 }}
        index={0}
        expanded={false}
        onToggle={() => {}}
        alerts={[]}
      />,
    );
    expect(within(screen.getByRole('article')).getByText('1 transfer')).toBeVisible();
  });
});