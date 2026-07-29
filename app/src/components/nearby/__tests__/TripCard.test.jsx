import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import fixture from '../../../test/fixtures/here-transit.json';
import { normalizeHereRoutes } from '../../../lib/hereTransit.js';
import TripCard from '../TripCard.jsx';

const plannedAt = '2026-07-28T18:00:00.000Z';
const trips = normalizeHereRoutes(fixture, plannedAt);

afterEach(cleanup);

describe('TripCard', () => {
  it('renders the recommended trip with its time range, duration, and lines', () => {
    const { container } = render(
      <TripCard trip={trips[0]} index={0} expanded={false} onToggle={vi.fn()} />,
    );

    expect(screen.getByText('Recommended')).toBeVisible();
    expect(screen.getByText('30 min')).toBeVisible();
    expect(
      container.querySelector('time[datetime="2026-07-28T18:00:00-07:00"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('time[datetime="2026-07-28T18:30:00-07:00"]'),
    ).toBeInTheDocument();
    expect(screen.getByText(/k ingleside toward embarcadero/i)).toBeVisible();
    expect(screen.getByText(/walk 11 min/i)).toBeVisible();
    expect(screen.getByText('No transfers')).toBeVisible();

    const toggle = screen.getByRole('button', {
      name: 'View full itinerary for K Ingleside',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('omits the Recommended label and shows multiple lines with transfer count for later trips', () => {
    render(<TripCard trip={trips[1]} index={1} expanded={false} onToggle={vi.fn()} />);

    expect(screen.queryByText('Recommended')).not.toBeInTheDocument();
    expect(screen.getByText('27 min')).toBeVisible();
    expect(screen.getByText(/n judah toward caltrain/i)).toBeVisible();
    expect(
      screen.getByText(/38r geary rapid toward transit center/i),
    ).toBeVisible();
    expect(screen.getByText(/walk 7 min/i)).toBeVisible();
    expect(screen.getByText('1 transfer')).toBeVisible();
  });

  it('falls back to a generic label and "No walking" for a trip with no transit sections', () => {
    render(<TripCard trip={trips[2]} index={2} expanded={false} onToggle={vi.fn()} />);

    expect(screen.getByText('Gondola portal')).toBeVisible();
    expect(screen.getByText('No walking')).toBeVisible();
    expect(screen.getByText('No transfers')).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: 'View full itinerary for Gondola portal',
      }),
    ).toBeInTheDocument();
  });

  it('expands to reveal alerts and the full itinerary, and reports line ids on toggle', () => {
    const onToggle = vi.fn();
    const alerts = [
      {
        id: 'k-alert',
        agency: 'SF',
        affectedLines: ['K'],
        header: 'K service delay',
        description: 'Allow extra travel time.',
      },
    ];

    render(
      <TripCard
        trip={trips[0]}
        index={0}
        expanded
        onToggle={onToggle}
        alerts={alerts}
      />,
    );

    const toggle = screen.getByRole('button', {
      name: 'Hide full itinerary for K Ingleside',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('K service delay')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: /walk to west portal station/i }),
    ).toBeVisible();

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(['K']);
  });

  it('renders an external maps link only when externalUrl is provided', () => {
    const { rerender } = render(
      <TripCard trip={trips[0]} index={0} expanded onToggle={vi.fn()} alerts={[]} />,
    );
    expect(
      screen.queryByRole('link', { name: /open in maps/i }),
    ).not.toBeInTheDocument();

    rerender(
      <TripCard
        trip={trips[0]}
        index={0}
        expanded
        onToggle={vi.fn()}
        alerts={[]}
        externalUrl="https://example.test/directions/route-k"
      />,
    );
    expect(
      screen.getByRole('link', { name: /open in maps/i }),
    ).toHaveAttribute('href', 'https://example.test/directions/route-k');
  });

  it('hides itinerary content entirely while collapsed', () => {
    render(
      <TripCard
        trip={trips[0]}
        index={0}
        expanded={false}
        onToggle={vi.fn()}
        alerts={[{ id: 'k-alert', affectedLines: ['K'], header: 'K service delay' }]}
      />,
    );

    expect(screen.queryByText('K service delay')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: /full itinerary/i }),
    ).not.toBeInTheDocument();
  });

  it('shows "Time pending" and safe fallbacks for a trip missing times and transit data', () => {
    const pendingTrip = {
      id: 'trip-pending',
      departureTime: null,
      arrivalTime: undefined,
      durationSeconds: Number.NaN,
      walkingDurationSeconds: 0,
      transferCount: 0,
      lines: [],
      sections: [],
    };

    render(
      <TripCard trip={pendingTrip} index={1} expanded={false} onToggle={vi.fn()} />,
    );

    expect(screen.getAllByText('Time pending')).toHaveLength(2);
    expect(screen.getByText('0 min')).toBeVisible();
    expect(screen.getByText('Transit option')).toBeVisible();
    expect(screen.getByText('No walking')).toBeVisible();
    expect(screen.getByText('No transfers')).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: 'View full itinerary for transit option',
      }),
    ).toBeInTheDocument();
  });
});