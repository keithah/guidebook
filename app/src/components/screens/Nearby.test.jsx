import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import transitFixture from '../../test/fixtures/here-transit.json';
import {
  fetchHereTransitRoutes,
  normalizeHereRoutes,
} from '../../lib/hereTransit.js';
import { searchHereDestinations } from '../../lib/hereSearch.js';
import { useTransitAlerts } from '../../hooks/useTransitAlerts.js';
import { useSavedDestinations } from '../../hooks/useSavedDestinations.js';
import { useNearbyTransit } from '../../hooks/useNearbyTransit.js';
import { useWalkingRoute } from '../../hooks/useWalkingRoute.js';
import { AppProvider } from '../../context/AppContext.jsx';
import { encodeStay } from '../../lib/stayHash.js';
import Nearby from './Nearby.jsx';

vi.mock('../nearby/NeighborhoodMap.jsx', () => ({
  default: ({ center, stops, showMe, ...props }) => (
    <div
      aria-label="Neighborhood map"
      data-center={JSON.stringify(center)}
      data-location-label={props.locationLabel ?? ''}
      data-show-me={showMe}
      data-stops={JSON.stringify(stops)}
    />
  ),
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

vi.mock('../../hooks/useSavedDestinations.js', () => ({
  useSavedDestinations: vi.fn(),
}));

vi.mock('../../hooks/useNearbyTransit.js', () => ({
  useNearbyTransit: vi.fn(),
}));

vi.mock('../../hooks/useWalkingRoute.js', () => ({
  useWalkingRoute: vi.fn(),
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
const walkingResult = {
  ok: true,
  route: {
    id: 'walking-route',
    durationSeconds: 1_320,
    lengthMeters: 1_931.2128,
    actions: [
      { type: 'depart', instruction: 'Head west on Harold Avenue.' },
      { type: 'arrive', instruction: 'Your destination is on the right.' },
    ],
    notices: [],
  },
  source: 'network',
  fetchedAt: Date.parse('2026-07-28T19:00:00.000Z'),
};
const howardNearbyResult = {
  ok: true,
  source: 'network',
  fetchedAt: Date.parse('2026-07-30T10:00:00-07:00'),
  expiresAt: null,
  stations: [
    {
      id: 'mission-south-van-ness',
      memberIds: ['mission-south-van-ness-platform'],
      name: 'Mission St & South Van Ness Ave',
      position: { lat: 37.77315, lng: -122.41859 },
      distanceMeters: 190,
      services: [
        {
          key: 'sf-14-downtown',
          agency: { id: 'SF', name: 'Muni' },
          transport: {
            mode: 'bus',
            shortName: '14',
            name: '14 Mission',
            color: '#C9413D',
          },
          headsign: 'Downtown',
          departures: [
            {
              scheduledTime: '2026-07-30T10:03:00-07:00',
              delaySeconds: 0,
              isRealtime: true,
            },
          ],
        },
      ],
    },
    {
      id: 'sixteenth-street-bart',
      memberIds: ['sixteenth-street-bart-platform'],
      name: '16th St Mission',
      position: { lat: 37.76487, lng: -122.41948 },
      distanceMeters: 920,
      services: [
        {
          key: 'bart-yellow-antioch',
          agency: { id: 'BART', name: 'Bay Area Rapid Transit' },
          transport: {
            mode: 'subway',
            shortName: 'Yellow',
            name: 'Yellow Line',
          },
          headsign: 'Antioch',
          departures: [],
        },
      ],
    },
  ],
};
const refreshNearby = vi.fn();

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
    useWalkingRoute.mockReturnValue({
      routeResult: walkingResult,
      retryWalking: vi.fn(),
    });
    useSavedDestinations.mockReturnValue({
      savedDestinations: [],
      loading: false,
      isSaved: vi.fn().mockReturnValue(false),
      toggleSaved: vi.fn(),
    });
    useNearbyTransit.mockReturnValue({
      result: howardNearbyResult,
      refresh: refreshNearby,
    });
    useTransitAlerts.mockReturnValue({
      alerts: [
        {
          id: 'k-alert',
          agency: 'SF',
          activePeriods: [],
          informedEntities: [
            {
              agencyId: 'SF',
              routeId: 'K',
              stopId: '17217',
              directionId: '',
            },
          ],
          header: 'K service delay',
          description: 'Allow extra travel time.',
          severity: 'SIGNIFICANT_DELAYS',
          url: '',
        },
        {
          id: 'general-alert',
          agency: 'SF',
          activePeriods: [],
          informedEntities: [],
          header: 'Systemwide service notice',
          description: 'Leave a little extra time.',
          severity: 'OTHER_EFFECT',
          url: '',
        },
        {
          id: 'route-43-alert',
          agency: 'SF',
          activePeriods: [],
          informedEntities: [
            {
              agencyId: 'SF',
              routeId: '43',
              stopId: '',
              directionId: '',
            },
          ],
          header: '43 Masonic reroute',
          description: 'Use a temporary stop.',
          severity: 'DETOUR',
          url: '',
        },
      ],
      status: 'live',
      updatedAt: Date.parse('2026-07-28T18:58:00.000Z'),
      error: null,
    });
  });

  it('keeps the active stay label outside the map and maps current stations', async () => {
    window.location.hash = encodeStay({
      guestName: 'Jamie',
      checkin: '2026-07-30',
      checkout: '2026-08-03',
      fakeLocation: {
        label: '1620 Howard St, San Francisco',
        lat: 37.77154,
        lng: -122.41761,
      },
    });
    render(
      <AppProvider>
        <Nearby />
      </AppProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Allow location' }));

    expect(
      await screen.findByText(
        'Using location: 1620 Howard St, San Francisco',
      ),
    ).toBeVisible();
    const map = screen.getByLabelText('Neighborhood map');
    expect(map).toHaveAttribute(
      'data-center',
      JSON.stringify({
        label: '1620 Howard St, San Francisco',
        lat: 37.77154,
        lng: -122.41761,
        source: 'stay-override',
      }),
    );
    expect(map).toHaveAttribute('data-show-me', 'true');
    expect(map).toHaveAttribute('data-location-label', '');
    expect(JSON.parse(map.getAttribute('data-stops'))).toEqual([
      {
        name: 'Mission St & South Van Ness Ave',
        sub: '14',
        line: '14',
        lat: 37.77315,
        lng: -122.41859,
      },
      {
        name: '16th St Mission',
        sub: 'Yellow',
        line: 'BART',
        lat: 37.76487,
        lng: -122.41948,
      },
    ]);
  });

  it('shows the labeled user marker when a stay override matches the cottage coordinates', async () => {
    window.location.hash = encodeStay({
      guestName: 'Jamie',
      checkin: '2026-07-30',
      checkout: '2026-08-03',
      fakeLocation: {
        label: '251 Harold Ave, San Francisco',
        lat: 37.7226,
        lng: -122.4547,
      },
    });
    render(
      <AppProvider>
        <Nearby />
      </AppProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Allow location' }));

    expect(
      await screen.findByText(
        'Using location: 251 Harold Ave, San Francisco',
      ),
    ).toBeVisible();
    expect(screen.getByLabelText('Neighborhood map')).toHaveAttribute(
      'data-location-label',
      '',
    );
    expect(screen.getByLabelText('Neighborhood map')).toHaveAttribute(
      'data-show-me',
      'true',
    );
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

    await act(async () => {});
    fireEvent.click(toggles[0]);
    expect(await screen.findAllByTestId('itinerary-section')).toHaveLength(
      trips[0].sections.length,
    );
    const mapsLink = screen.getByRole('link', {
      name: /open transit directions in google maps/i,
    });
    expect(mapsLink).toHaveAttribute(
      'href',
      expect.stringContaining('google.com/maps/dir/'),
    );
    expect(new URL(mapsLink.href).searchParams.get('travelmode')).toBe(
      'transit',
    );
  });

  it('renders the approved destination, journey, map, and departures hierarchy', async () => {
    renderNearby();

    fireEvent.click(
      screen.getByRole('button', { name: /take me back to the cottage/i }),
    );
    await screen.findByRole('region', { name: 'Transit options' });

    const destinationForm = screen.getByRole('region', {
      name: 'Destination search',
    });
    const shortcuts = screen
      .getByRole('button', { name: /take me back to the cottage/i })
      .parentElement;
    const backHome = screen.getByText(/Suggestions · back to 251 Harold Ave/i);
    const selectedSummary = screen.getByRole('region', {
      name: 'Selected destination',
    });
    expect(
      within(selectedSummary).getByRole('button', { name: 'Clear destination' }),
    ).toBeVisible();
    const modeSelector = screen.getByRole('group', { name: 'Travel mode' });
    const routes = screen.getByRole('region', { name: 'Transit options' });
    const map = screen.getByLabelText('Neighborhood map');
    const departures = screen.getByRole('region', { name: 'Nearby departures' });

    const expectBefore = (earlier, later) => {
      expect(
        earlier.compareDocumentPosition(later) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    };
    expectBefore(destinationForm, shortcuts);
    expectBefore(shortcuts, backHome);
    expectBefore(backHome, selectedSummary);
    expectBefore(selectedSummary, modeSelector);
    expectBefore(modeSelector, routes);
    expectBefore(routes, map);
    expectBefore(map, departures);

    expect(
      within(shortcuts).getAllByRole('button').map((button) => button.textContent),
    ).toEqual([
      '⌂ Take me back to the cottage',
      'Downtown / Union Square',
      'SFO',
      'Golden Gate Park',
      'The Mission',
      'Ocean Beach',
    ]);
  });

  it('never renders the static cottage stop board or curated fallback copy', () => {
    renderNearby();

    expect(screen.getByText('Mission St & South Van Ness Ave')).toBeVisible();
    for (const staleCopy of [
      'Ocean Ave & Lee St',
      'Plymouth Ave & Ocean',
      'Balboa Park',
      'Curated schedule',
    ]) {
      expect(document.body.textContent).not.toContain(staleCopy);
      expect(
        screen.getByLabelText('Neighborhood map').getAttribute('data-stops'),
      ).not.toContain(staleCopy);
    }
  });

  it('passes no map stops and renders only an unavailable board on provider failure', () => {
    useNearbyTransit.mockReturnValue({
      result: { ok: false, reason: 'network' },
      refresh: refreshNearby,
    });
    renderNearby();

    expect(screen.getByLabelText('Neighborhood map')).toHaveAttribute(
      'data-stops',
      '[]',
    );
    const board = screen.getByRole('region', { name: 'Nearby departures' });
    expect(
      within(board).getByText('Nearby departures unavailable'),
    ).toBeVisible();
    expect(within(board).queryByTestId('nearby-station')).not.toBeInTheDocument();
    expect(
      within(board).queryByText(/Ocean|Plymouth|Balboa|Curated/i),
    ).not.toBeInTheDocument();
  });

  it('does not expose the earlier location result after active coordinates change', async () => {
    window.location.hash = encodeStay({
      guestName: 'Jamie',
      checkin: '2026-07-30',
      checkout: '2026-08-03',
      fakeLocation: {
        label: '1620 Howard St, San Francisco',
        lat: 37.77154,
        lng: -122.41761,
      },
    });
    useNearbyTransit.mockImplementation(({ origin }) => ({
      result:
        origin?.lat === 37.77154 && origin?.lng === -122.41761
          ? howardNearbyResult
          : null,
      refresh: refreshNearby,
    }));
    render(
      <AppProvider>
        <Nearby />
      </AppProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Allow location' }));
    expect(
      await screen.findByText('Mission St & South Van Ness Ave'),
    ).toBeVisible();

    await act(async () => {
      window.location.hash = encodeStay({
        guestName: 'Jamie',
        checkin: '2026-07-30',
        checkout: '2026-08-03',
        fakeLocation: {
          label: 'Ferry Building, San Francisco',
          lat: 37.7955,
          lng: -122.3937,
        },
      });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(
      await screen.findByText('Using location: Ferry Building, San Francisco'),
    ).toBeVisible();
    expect(
      screen.queryByText('Mission St & South Van Ness Ave'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Neighborhood map')).toHaveAttribute(
      'data-stops',
      '[]',
    );
  });

  it('keeps dynamic nearby, walking, and rideshare guidance usable when route lookup is unavailable', async () => {
    searchHereDestinations.mockResolvedValue({ ok: false, reason: 'network' });
    fetchHereTransitRoutes.mockResolvedValue({ ok: false, reason: 'network' });
    renderNearby();

    const input = screen.getByRole('searchbox', { name: /destination/i });
    fireEvent.change(input, { target: { value: 'Union Square' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(
      await screen.findByText(/address search needs a connection/i),
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
    expect(screen.getByText('Mission St & South Van Ness Ave')).toBeVisible();
    expect(screen.queryByText('Ocean Ave & Lee St')).not.toBeInTheDocument();
    expect(screen.queryByText('Curated schedule')).not.toBeInTheDocument();
    expect(screen.queryByText('Uber')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rideshare' }));
    expect(screen.getByText('Uber')).toBeVisible();
    expect(screen.getByText('First time on Muni or BART?')).toBeVisible();
  });

  it('marks only route-relevant collapsed lines and never shows a global alert surface', async () => {
    renderNearby();
    expect(useTransitAlerts).toHaveBeenCalledWith('SF', { enabled: false });
    const input = screen.getByRole('searchbox', { name: /destination/i });
    fireEvent.change(input, { target: { value: 'Union Square' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /choose union square/i }),
    );

    await screen.findAllByRole('button', { name: /view full itinerary/i });
    expect(useTransitAlerts).toHaveBeenLastCalledWith('SF', { enabled: true });
    expect(screen.queryByText('K service delay')).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('Service advisory in full itinerary'),
    ).toBeVisible();
    expect(screen.queryByText('Systemwide service notice')).not.toBeInTheDocument();
    expect(screen.queryByText('43 Masonic reroute')).not.toBeInTheDocument();
    expect(screen.queryByText('Current SF service alerts')).not.toBeInTheDocument();
    expect(screen.queryByText(/curated schedule/i)).not.toBeInTheDocument();

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
    expect(screen.queryByText('K service delay')).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('Service advisory in full itinerary'),
    ).toBeVisible();
  });

  it('retries a failed route lookup and clears the failure once it succeeds', async () => {
    fetchHereTransitRoutes.mockResolvedValueOnce({ ok: false, reason: 'network' });
    renderNearby();

    fireEvent.click(
      screen.getByRole('button', { name: /take me back to the cottage/i }),
    );
    expect(
      await screen.findByText(/transit directions need a connection/i),
    ).toBeVisible();
    const retryButton = screen.getByRole('button', {
      name: 'Retry transit directions',
    });
    expect(retryButton).toHaveClass('journey-text-button');

    fireEvent.click(retryButton);
    expect(fetchHereTransitRoutes).toHaveBeenCalledTimes(2);
    await screen.findAllByRole('button', { name: /view full itinerary/i });
    expect(
      screen.queryByText(/transit directions need a connection/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry transit directions' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the journey UI readable when a selected result has invalid coordinates', async () => {
    searchHereDestinations.mockResolvedValueOnce({
      ok: true,
      candidates: [
        {
          ...unionSquare,
          id: 'here:invalid-position',
          position: { lat: Number.NaN, lng: Number.POSITIVE_INFINITY },
        },
      ],
      source: 'network',
    });
    renderNearby();

    fireEvent.change(screen.getByRole('searchbox', { name: /destination/i }), {
      target: { value: 'Invalid destination' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /choose union square/i }),
    );

    expect(screen.getByRole('group', { name: 'Travel mode' })).toBeVisible();
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', {
        name: /open transit directions in google maps/i,
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Walk' }));
    expect(screen.getByRole('region', { name: 'Walking directions' })).toBeVisible();
    expect(
      screen.queryByRole('link', {
        name: /open walking directions in google maps/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('routes The Mission shortcut directly without search candidates', async () => {
    renderNearby();

    fireEvent.click(screen.getByRole('button', { name: 'The Mission' }));

    expect(searchHereDestinations).not.toHaveBeenCalled();
    expect(fetchHereTransitRoutes).toHaveBeenCalledWith(
      { lat: 37.7226, lng: -122.4547, source: 'cottage' },
      { lat: 37.75993, lng: -122.41808 },
      expect.objectContaining({ signal: expect.anything() }),
    );
    expect(
      screen.getByRole('searchbox', { name: /destination/i }),
    ).toHaveValue('Mission District');
    const summary = screen.getByRole('region', {
      name: 'Selected destination',
    });
    expect(
      within(summary).getByText('Mission District, San Francisco, CA'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /choose union square/i }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('region', { name: 'Transit options' }),
    ).toBeVisible();
  });

  it('shows saved addresses while leaving saved POIs hidden', () => {
    const savedAddress = {
      ...unionSquare,
      id: 'here:saved-address',
      title: 'Saved address',
      resultType: 'address',
      categories: [],
    };
    const savedPoi = {
      ...unionSquare,
      id: 'here:saved-poi',
      title: 'Saved coffee shop',
      resultType: 'place',
      categories: ['Coffee/Tea'],
    };
    useSavedDestinations.mockReturnValue({
      savedDestinations: [savedAddress, savedPoi],
      loading: false,
      isSaved: vi.fn().mockReturnValue(true),
      toggleSaved: vi.fn(),
    });

    renderNearby();

    expect(
      screen.getByRole('button', { name: /choose saved address/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /choose saved coffee shop/i }),
    ).not.toBeInTheDocument();
  });

  it('disables route-alert fetching and renders no alert status when routing fails', async () => {
    fetchHereTransitRoutes.mockResolvedValue({ ok: false, reason: 'network' });
    useTransitAlerts.mockReturnValue({
      alerts: [
        {
          id: 'k-alert',
          agency: 'SF',
          activePeriods: [],
          informedEntities: [
            {
              agencyId: 'SF',
              routeId: 'K',
              stopId: '',
              directionId: '',
            },
          ],
          header: 'K service delay',
          description: 'Allow extra travel time.',
          severity: 'SIGNIFICANT_DELAYS',
          url: '',
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
    expect(useTransitAlerts).toHaveBeenLastCalledWith('SF', { enabled: false });
    expect(screen.queryByText('K service delay')).not.toBeInTheDocument();
    expect(screen.queryByText('Current SF service alerts')).not.toBeInTheDocument();
    expect(screen.queryByText(/live alert update is unavailable/i)).not.toBeInTheDocument();
  });

  it('shows one selected journey mode at a time and pauses alerts outside Transit', async () => {
    renderNearby();
    const input = screen.getByRole('searchbox', { name: /destination/i });
    fireEvent.change(input, { target: { value: 'Union Square' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /choose union square/i }),
    );

    const selector = screen.getByRole('group', { name: 'Travel mode' });
    expect(
      within(selector).getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Transit', 'Walk', 'Rideshare']);
    expect(within(selector).getByRole('button', { name: 'Transit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await screen.findByRole('region', { name: 'Transit options' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Walking directions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Rideshare options' })).not.toBeInTheDocument();

    fireEvent.click(within(selector).getByRole('button', { name: 'Walk' }));
    expect(useWalkingRoute).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true }),
    );
    expect(screen.getByRole('region', { name: 'Walking directions' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Transit options' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Rideshare options' })).not.toBeInTheDocument();
    expect(useTransitAlerts).toHaveBeenLastCalledWith('SF', { enabled: false });
    const walkingMapsLink = screen.getByRole('link', {
      name: /open walking directions in google maps/i,
    });
    const walkingMapsUrl = new URL(walkingMapsLink.href);
    expect(walkingMapsUrl.searchParams.get('api')).toBe('1');
    expect(walkingMapsUrl.searchParams.get('origin')).toBe(
      '37.7226,-122.4547',
    );
    expect(walkingMapsUrl.searchParams.get('destination')).toBe(
      '37.7879,-122.4075',
    );
    expect(walkingMapsUrl.searchParams.get('travelmode')).toBe('walking');

    fireEvent.click(within(selector).getByRole('button', { name: 'Rideshare' }));
    expect(screen.getByRole('region', { name: 'Rideshare options' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Walking directions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Transit options' })).not.toBeInTheDocument();
  });

  it('reuses the successful walking result when returning to Walk for the same journey', async () => {
    renderNearby();
    fireEvent.click(
      screen.getByRole('button', { name: /take me back to the cottage/i }),
    );
    await screen.findByRole('region', { name: 'Transit options' });

    const selector = screen.getByRole('group', { name: 'Travel mode' });
    fireEvent.click(within(selector).getByRole('button', { name: 'Walk' }));
    expect(screen.getByText('Head west on Harold Avenue.')).toBeVisible();

    fireEvent.click(within(selector).getByRole('button', { name: 'Transit' }));
    fireEvent.click(within(selector).getByRole('button', { name: 'Walk' }));

    expect(screen.getByText('Head west on Harold Avenue.')).toBeVisible();
    expect(screen.queryByText('Loading walking directions…')).not.toBeInTheDocument();
  });

  it('couples Walk selection to the destination journey before requesting another route', async () => {
    useWalkingRoute.mockImplementation(({ destination }) => ({
      routeResult: {
        ...walkingResult,
        route: {
          ...walkingResult.route,
          actions: [
            {
              type: 'arrive',
              instruction:
                destination?.lng === -122.3937
                  ? 'Walk to Ferry Building.'
                  : 'Walk to Union Square.',
            },
          ],
        },
      },
      retryWalking: vi.fn(),
    }));
    renderNearby();
    const input = screen.getByRole('searchbox', { name: /destination/i });
    fireEvent.change(input, { target: { value: 'Union Square' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /choose union square/i }),
    );
    const selector = screen.getByRole('group', { name: 'Travel mode' });
    fireEvent.click(within(selector).getByRole('button', { name: 'Walk' }));
    expect(screen.getByText('Walk to Union Square.')).toBeVisible();
    useWalkingRoute.mockClear();

    const ferryBuilding = {
      ...unionSquare,
      id: 'here:ferry-building-mode-reset',
      title: 'Ferry Building',
      address: '1 Ferry Building, San Francisco, CA',
      position: { lat: 37.7955, lng: -122.3937 },
    };
    searchHereDestinations.mockResolvedValueOnce({
      ok: true,
      candidates: [ferryBuilding],
      source: 'network',
    });
    fireEvent.change(input, { target: { value: 'Ferry Building' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /choose ferry building/i }),
    );

    expect(screen.getByRole('button', { name: 'Transit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.queryByRole('region', { name: 'Walking directions' }),
    ).not.toBeInTheDocument();
    expect(
      useWalkingRoute.mock.calls.filter(
        ([options]) =>
          options.destination?.lng === -122.3937 && options.enabled,
      ),
    ).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Walk' }));
    expect(screen.getByText('Walk to Ferry Building.')).toBeVisible();
    expect(useWalkingRoute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        destination: ferryBuilding.position,
        enabled: true,
      }),
    );
  });

  it('requires a fresh Walk selection after returning from another destination', async () => {
    const ferryBuilding = {
      ...unionSquare,
      id: 'here:ferry-building-return-reset',
      title: 'Ferry Building',
      address: '1 Ferry Building, San Francisco, CA',
      position: { lat: 37.7955, lng: -122.3937 },
    };
    searchHereDestinations.mockImplementation((query) =>
      Promise.resolve({
        ok: true,
        candidates: [query === 'Ferry Building' ? ferryBuilding : unionSquare],
        source: 'network',
      }),
    );
    renderNearby();
    const input = screen.getByRole('searchbox', { name: /destination/i });

    fireEvent.change(input, { target: { value: 'Union Square' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /choose union square/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Walk' }));
    expect(screen.getByText('Head west on Harold Avenue.')).toBeVisible();

    fireEvent.change(input, { target: { value: 'Ferry Building' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /choose ferry building/i }),
    );
    expect(screen.getByRole('button', { name: 'Transit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    useWalkingRoute.mockClear();

    fireEvent.change(input, { target: { value: 'Union Square' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /choose union square/i }),
    );

    expect(screen.getByRole('button', { name: 'Transit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.queryByRole('region', { name: 'Walking directions' }),
    ).not.toBeInTheDocument();
    expect(
      useWalkingRoute.mock.calls.filter(
        ([options]) =>
          options.destination?.lng === unionSquare.position.lng &&
          options.enabled,
      ),
    ).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Walk' }));
    expect(screen.getByRole('region', { name: 'Walking directions' })).toBeVisible();
    expect(useWalkingRoute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        destination: unionSquare.position,
        enabled: true,
      }),
    );
  });

  it('couples Walk selection to the origin journey before requesting another route', async () => {
    useWalkingRoute.mockImplementation(({ origin: currentOrigin }) => ({
      routeResult: {
        ...walkingResult,
        route: {
          ...walkingResult.route,
          actions: [
            {
              type: 'depart',
              instruction:
                currentOrigin?.lng === -122.3937
                  ? 'Leave from Ferry Building.'
                  : 'Leave from Howard Street.',
            },
          ],
        },
      },
      retryWalking: vi.fn(),
    }));
    window.location.hash = encodeStay({
      guestName: 'Jamie',
      checkin: '2026-07-30',
      checkout: '2026-08-03',
      fakeLocation: {
        label: '1620 Howard St, San Francisco',
        lat: 37.77154,
        lng: -122.41761,
      },
    });
    render(
      <AppProvider>
        <Nearby />
      </AppProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Allow location' }));
    await screen.findByText('Using location: 1620 Howard St, San Francisco');
    fireEvent.click(
      screen.getByRole('button', { name: /take me back to the cottage/i }),
    );
    await screen.findByRole('region', { name: 'Transit options' });
    fireEvent.click(screen.getByRole('button', { name: 'Walk' }));
    expect(screen.getByText('Leave from Howard Street.')).toBeVisible();
    useWalkingRoute.mockClear();

    window.location.hash = encodeStay({
      guestName: 'Jamie',
      checkin: '2026-07-30',
      checkout: '2026-08-03',
      fakeLocation: {
        label: 'Ferry Building, San Francisco',
        lat: 37.7955,
        lng: -122.3937,
      },
    });
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    await screen.findByText('Using location: Ferry Building, San Francisco');
    expect(screen.getByRole('button', { name: 'Transit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.queryByRole('region', { name: 'Walking directions' }),
    ).not.toBeInTheDocument();
    expect(
      useWalkingRoute.mock.calls.filter(
        ([options]) => options.origin?.lng === -122.3937 && options.enabled,
      ),
    ).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Walk' }));
    expect(screen.getByText('Leave from Ferry Building.')).toBeVisible();
    expect(useWalkingRoute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        origin: expect.objectContaining({
          lat: 37.7955,
          lng: -122.3937,
        }),
        enabled: true,
      }),
    );
  });

  it('keeps Walk and Rideshare available when transit directions fail', async () => {
    fetchHereTransitRoutes.mockResolvedValue({ ok: false, reason: 'network' });
    renderNearby();
    fireEvent.click(
      screen.getByRole('button', { name: /take me back to the cottage/i }),
    );
    expect(
      await screen.findByText(/transit directions need a connection/i),
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Walk' }));
    expect(screen.getByRole('region', { name: 'Walking directions' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Rideshare' }));
    expect(screen.getByRole('region', { name: 'Rideshare options' })).toBeVisible();
  });
});
