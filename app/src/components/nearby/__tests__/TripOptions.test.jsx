import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import fixture from '../../../test/fixtures/here-transit.json';
import alertFixture from '../../../test/fixtures/511-alerts.json';
import { normalizeHereRoutes } from '../../../lib/hereTransit.js';
import { normalizeServiceAlerts } from '../../../lib/transit511.js';
import LiveStatus from '../LiveStatus.jsx';
import TripOptions from '../TripOptions.jsx';

const plannedAt = '2026-07-28T18:00:00.000Z';
const trips = normalizeHereRoutes(fixture, plannedAt);
const fetchedAt = Date.parse('2026-07-28T18:58:00.000Z');
const now = Date.parse('2026-07-28T19:00:00.000Z');
const generalAlert = {
  id: 'sf-system-notice',
  agency: 'SF',
  severity: 'OTHER_EFFECT',
  header: 'Systemwide fare machines update',
  description: 'Some fare machines may take longer to respond.',
  activePeriods: [],
  informedEntities: [],
  url: 'https://example.test/system-notice',
  updatedAt: '2026-07-28T18:55:00.000Z',
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TripOptions', () => {
  it('renders ranked summaries with every trip collapsed initially', () => {
    render(
      <TripOptions
        result={{ ok: true, trips, source: 'network', fetchedAt }}
        alerts={[]}
        externalUrlForTrip={() => 'https://example.test/directions'}
      />,
    );

    const toggles = screen.getAllByRole('button', {
      name: /view full itinerary/i,
    });
    expect(toggles).toHaveLength(3);
    toggles.forEach((toggle) =>
      expect(toggle).toHaveAttribute('aria-expanded', 'false'),
    );
    expect(toggles[0]).toHaveAccessibleName(
      /view full itinerary for k ingleside/i,
    );
    expect(screen.getAllByText('Recommended')).toHaveLength(1);
    expect(screen.getByText('30 min')).toBeVisible();
    expect(screen.getByText(/walk 11 min/i)).toBeVisible();
    expect(screen.getAllByText(/no transfers/i)).toHaveLength(2);
    expect(screen.getByText(/1 transfer/i)).toBeVisible();
    expect(
      within(toggles[2].closest('article')).getByText('No walking'),
    ).toBeVisible();
    expect(screen.queryByTestId('itinerary-section')).not.toBeInTheDocument();
  });

  it('expands only one itinerary and exposes its external maps link', () => {
    render(
      <TripOptions
        result={{ ok: true, trips, source: 'network', fetchedAt }}
        alerts={[]}
        externalUrlForTrip={(trip) =>
          `https://example.test/directions/${trip.id}`
        }
      />,
    );

    const toggles = screen.getAllByRole('button', {
      name: /view full itinerary/i,
    });
    fireEvent.click(toggles[0]);
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByTestId('itinerary-section')).toHaveLength(3);
    expect(
      screen.getByRole('link', {
        name: /open transit directions in google maps/i,
      }),
    ).toHaveAttribute('href', 'https://example.test/directions/route-k');

    fireEvent.click(toggles[1]);
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'false');
    expect(toggles[1]).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByTestId('itinerary-section')).toHaveLength(5);
    expect(
      screen.getAllByRole('link', {
        name: /open transit directions in google maps/i,
      }),
    ).toHaveLength(1);
  });

  it('marks affected trip lines while collapsed and shows warning copy only when expanded', () => {
    const alerts = normalizeServiceAlerts(alertFixture, now, 'SF').map(
      (alert) => ({ ...alert, activePeriods: [] }),
    );

    render(
      <TripOptions
        result={{ ok: true, trips, source: 'network', fetchedAt }}
        alerts={alerts}
        externalUrlForTrip={() => 'https://example.test/directions'}
      />,
    );

    expect(screen.queryByText('K Ingleside delay')).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('Service advisory in full itinerary'),
    ).toBeVisible();
    expect(screen.queryByText('43 Masonic reroute')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole('button', { name: /view full itinerary/i })[0],
    );
    expect(screen.getAllByText('K Ingleside delay')).toHaveLength(1);
    expect(screen.queryByText('43 Masonic reroute')).not.toBeInTheDocument();
  });

  it('keeps a general alert out of an expanded trip with no transit lines', () => {
    render(
      <TripOptions
        result={{ ok: true, trips, source: 'network', fetchedAt }}
        alerts={[generalAlert]}
        externalUrlForTrip={() => 'https://example.test/directions'}
      />,
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: /view full itinerary/i })[2],
    );

    expect(screen.getByText('Step into the transfer portal.')).toBeVisible();
    expect(
      screen.queryByText('Systemwide fare machines update'),
    ).not.toBeInTheDocument();
  });

  it('keeps id-less route expansion isolated by ranked position', () => {
    const idlessTrips = trips.slice(0, 2).map((trip) => ({
      ...trip,
      id: undefined,
    }));

    render(
      <TripOptions
        result={{ ok: true, trips: idlessTrips, source: 'cache', fetchedAt }}
        alerts={[]}
        externalUrlForTrip={() => 'https://example.test/directions'}
      />,
    );

    const toggles = screen.getAllByRole('button', {
      name: /view full itinerary/i,
    });
    fireEvent.click(toggles[0]);
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'true');
    expect(toggles[1]).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByTestId('itinerary-section')).toHaveLength(3);
  });

  it('resets expansion when a new route result arrives', () => {
    const firstResult = { ok: true, trips, source: 'network', fetchedAt };
    const replacementResult = {
      ok: true,
      trips: trips.map((trip) => ({
        ...trip,
        plannedAt: '2026-07-28T19:00:00.000Z',
      })),
      source: 'network',
      fetchedAt: fetchedAt + 60_000,
    };
    const { rerender } = render(
      <TripOptions
        result={firstResult}
        alerts={[]}
      />,
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: /view full itinerary/i })[0],
    );
    expect(
      screen.getAllByRole('button', { name: /hide full itinerary/i })[0],
    ).toHaveAttribute('aria-expanded', 'true');

    rerender(
      <TripOptions
        result={replacementResult}
        alerts={[]}
      />,
    );

    screen
      .getAllByRole('button', { name: /view full itinerary/i })
      .forEach((toggle) =>
        expect(toggle).toHaveAttribute('aria-expanded', 'false'),
      );
  });

  it('uses unique controlled-region ids across multiple trip lists', () => {
    const result = {
      ok: true,
      trips: [trips[0]],
      source: 'network',
      fetchedAt,
    };
    render(
      <>
        <TripOptions result={result} />
        <TripOptions result={result} />
      </>,
    );

    const controls = screen
      .getAllByRole('button', { name: /view full itinerary/i })
      .map((toggle) => toggle.getAttribute('aria-controls'));
    expect(new Set(controls).size).toBe(2);
    controls.forEach((id) =>
      expect(document.getElementById(id)).toBeInTheDocument(),
    );
  });
});

describe('LiveStatus', () => {
  it('announces live, cached, and last-known states with semantic timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { container, rerender } = render(
      <LiveStatus source="network" timestamp={fetchedAt} />,
    );
    expect(
      screen.getByRole('status', { name: 'Live · updated 2 min ago' }),
    ).toBeVisible();
    expect(container.querySelector('time')).toHaveAttribute(
      'datetime',
      '2026-07-28T18:58:00.000Z',
    );

    rerender(<LiveStatus source="cache" />);
    expect(screen.getByRole('status', { name: 'Cached' })).toBeVisible();

    rerender(<LiveStatus source="stale" timestamp={fetchedAt} />);
    expect(
      screen.getByRole('status', {
        name: 'Last known · updated 2 min ago',
      }),
    ).toBeVisible();

    rerender(<LiveStatus source="unavailable" timestamp={null} />);
    expect(screen.getByRole('status', { name: 'Unavailable' })).toBeVisible();
    expect(container.querySelector('time')).not.toBeInTheDocument();
  });
});
