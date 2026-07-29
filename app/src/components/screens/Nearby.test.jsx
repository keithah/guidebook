import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import transitFixture from '../../test/fixtures/here-transit.json';
import {
  fetchHereTransitRoutes,
  normalizeHereRoutes,
} from '../../lib/hereTransit.js';
import { searchHereDestinations } from '../../lib/hereSearch.js';
import { useTransitAlerts } from '../../hooks/useTransitAlerts.js';
import { AppProvider } from '../../context/AppContext.jsx';
import Nearby from './Nearby.jsx';

vi.mock('../nearby/NeighborhoodMap.jsx', () => ({
  default: () => <div aria-label="Neighborhood map" />,
}));

vi.mock('../../lib/hereSearch.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, searchHereDestinations: vi.fn() };
});

vi.mock('../../lib/hereTransit.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchHereTransitRoutes: vi.fn() };
});

vi.mock('../../hooks/useLiveDepartures.js', () => ({
  useLiveDepartures: () => ({
    times: { 0: '3, 12′', 1: '5, 18′' },
    meta: {
      0: { status: 'live', updatedAt: Date.parse('2026-07-28T18:58:00.000Z') },
      1: {
        status: 'cached',
        updatedAt: Date.parse('2026-07-28T18:55:00.000Z'),
      },
    },
  }),
}));

vi.mock('../../hooks/useTransitAlerts.js', () => ({
  useTransitAlerts: vi.fn(),
}));

vi.mock('../../lib/weather.js', () => ({
  fetchCurrentWeather: vi.fn().mockResolvedValue({ ok: false }),
  fetchWeatherForDate: vi.fn().mockResolvedValue({ ok: false }),
  fetchForecastDays: vi.fn().mockResolvedValue({ ok: false }),
}));

vi.mock('../../lib/geo.js', () => ({
  getCurrentPosition: vi.fn(),
}));

const unionSquare = {
  id: 'here:union-square',
  title: 'Union Square',
  address: '333 Post St, San Francisco, CA',
  position: { lat: 37.7879, lng: -122.4075 },
  resultType: 'place',
  categories: ['Landmark'],
  distanceMeters: 8_100,
};
const plannedAt = '2026-07-28T19:00:00.000Z';
const trips = normalizeHereRoutes(transitFixture, plannedAt);

afterEach(cleanup);

function renderNearby() {
  render(
    <AppProvider>
      <Nearby />
    </AppProvider>,
  );
  fireEvent.click(screen.getByText('Not now — use the cottage as my location'));
}

describe('Nearby', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
    searchHereDestinations.mockResolvedValue({
      ok: true,
      candidates: [unionSquare],
      source: 'network',
    });
    fetchHereTransitRoutes.mockResolvedValue({
      ok: true,
      trips,
      source: 'network',
      fetchedAt: Date.parse('2026-07-28T19:00:00.000Z'),
    });
    useTransitAlerts.mockReturnValue({
      alerts: [
        {
          id: 'k-alert',
          agency: 'SF',
          affectedLines: ['K'],
          header: 'K service delay',
          description: 'Allow extra travel time.',
        },
        {
          id: 'general-alert',
          agency: 'SF',
          affectedLines: [],
          header: 'Systemwide service notice',
          description: 'Leave a little extra time.',
        },
      ],
      status: 'live',
      updatedAt: Date.parse('2026-07-28T18:58:00.000Z'),
      error: null,
    });
  });

  it('searches explicitly, routes only after selection, and expands every route section', async () => {
    renderNearby();
    const input = screen.getByRole('searchbox', { name: /destination/i });
    fireEvent.change(input, { target: { value: 'Union Square' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    const candidate = await screen.findByRole('button', {
      name: /choose union square/i,
    });
    expect(
      screen.queryByRole('region', { name: /transit options/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(candidate);

    const toggles = await screen.findAllByRole('button', {
      name: /view full itinerary/i,
    });
    expect(toggles).toHaveLength(3);
    toggles.forEach((toggle) =>
      expect(toggle).toHaveAttribute('aria-expanded', 'false'),
    );

    fireEvent.click(toggles[0]);
    expect(screen.getAllByTestId('itinerary-section')).toHaveLength(
      trips[0].sections.length,
    );
    expect(screen.getByRole('link', { name: /open in maps/i })).toHaveAttribute(
      'href',
      expect.stringContaining('google.com/maps/dir/'),
    );
  });

  it('promotes stops that head toward the selected destination', async () => {
    const balboaPark = {
      ...unionSquare,
      id: 'here:balboa-park',
      title: 'Balboa Park Station',
      address: '401 Geneva Ave, San Francisco, CA',
      position: { lat: 37.7216, lng: -122.443 },
    };
    searchHereDestinations.mockResolvedValue({
      ok: true,
      candidates: [balboaPark],
      source: 'network',
    });
    renderNearby();

    fireEvent.change(screen.getByRole('searchbox', { name: /destination/i }), {
      target: { value: 'Balboa Park' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: /choose balboa park station/i,
      }),
    );
    await screen.findAllByRole('button', { name: /view full itinerary/i });

    const departures = screen.getByRole('region', {
      name: 'Nearby departures',
    });
    expect(departures.children[1]).toHaveTextContent('outbound to Balboa Park');
  });

  it('keeps local and 511 guidance usable when HERE is unavailable', async () => {
    searchHereDestinations.mockResolvedValue({ ok: false, reason: 'network' });
    fetchHereTransitRoutes.mockResolvedValue({ ok: false, reason: 'network' });
    renderNearby();

    const input = screen.getByRole('searchbox', { name: /destination/i });
    fireEvent.change(input, { target: { value: 'Union Square' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(
      await screen.findByText(/place search needs a connection/i),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: /take me back to the cottage/i }),
    );
    expect(
      await screen.findByText(/transit directions need a connection/i),
    ).toBeVisible();
    expect(screen.getByText('Walking')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Downtown / Union Square' }),
    ).toBeVisible();
    expect(screen.getAllByText('Ocean Ave & Lee St')).toHaveLength(2);
    expect(
      screen.getAllByRole('status', { name: /live/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Data provided by 511.org')).toBeVisible();
    expect(screen.getByText('Uber')).toBeVisible();
    expect(screen.getByText('First time on Muni or BART?')).toBeVisible();
  });

  it('keeps route alerts visible with collapsed trips and labels curated departure fallbacks', async () => {
    renderNearby();
    const input = screen.getByRole('searchbox', { name: /destination/i });
    fireEvent.change(input, { target: { value: 'Union Square' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /choose union square/i }),
    );

    await screen.findAllByRole('button', { name: /view full itinerary/i });
    expect(screen.getByText('K service delay')).toBeVisible();
    expect(screen.getByText('Systemwide service notice')).toBeVisible();
    expect(
      screen.getAllByRole('status', { name: /live/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/curated schedule/i).length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getAllByRole('button', { name: /view full itinerary/i })[0],
    );
    expect(screen.getAllByText('K service delay')).toHaveLength(1);

    const ferryBuilding = {
      ...unionSquare,
      id: 'here:ferry-building',
      title: 'Ferry Building',
      address: '1 Ferry Building, San Francisco, CA',
    };
    searchHereDestinations.mockResolvedValueOnce({
      ok: true,
      candidates: [ferryBuilding],
      source: 'network',
    });
    fetchHereTransitRoutes.mockResolvedValueOnce({
      ok: true,
      trips: trips.map((trip) => ({
        ...trip,
        plannedAt: '2026-07-28T19:15:00.000Z',
      })),
      source: 'network',
      fetchedAt: Date.parse('2026-07-28T19:15:00.000Z'),
    });
    fireEvent.change(input, { target: { value: 'Ferry Building' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /choose ferry building/i }),
    );

    const replacementToggles = await screen.findAllByRole('button', {
      name: /view full itinerary/i,
    });
    replacementToggles.forEach((toggle) =>
      expect(toggle).toHaveAttribute('aria-expanded', 'false'),
    );
    expect(screen.getByText('K service delay')).toBeVisible();
  });

  it('shows last-known route alerts even when HERE routing fails', async () => {
    fetchHereTransitRoutes.mockResolvedValue({ ok: false, reason: 'network' });
    useTransitAlerts.mockReturnValue({
      alerts: [
        {
          id: 'k-alert',
          agency: 'SF',
          affectedLines: ['K'],
          header: 'K service delay',
          description: 'Allow extra travel time.',
        },
      ],
      status: 'stale',
      updatedAt: Date.parse('2026-07-28T18:30:00.000Z'),
      error: 'network',
    });
    renderNearby();

    fireEvent.click(
      screen.getByRole('button', { name: /take me back to the cottage/i }),
    );

    expect(
      await screen.findByText(/transit directions need a connection/i),
    ).toBeVisible();
    expect(screen.getByText('K service delay')).toBeVisible();
    expect(screen.getByRole('status', { name: /last known/i })).toBeVisible();
    expect(screen.getByText(/live alert update is unavailable/i)).toBeVisible();
  });
});
