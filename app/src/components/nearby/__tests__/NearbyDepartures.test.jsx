import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import NearbyDepartures from '../NearbyDepartures.jsx';

const result = {
  ok: true,
  source: 'network',
  fetchedAt: Date.parse('2026-07-30T10:00:00-07:00'),
  expiresAt: null,
  stations: [
    {
      id: 'mission',
      memberIds: ['mission-platform'],
      name: 'Mission Street Station',
      position: { lat: 37.77, lng: -122.42 },
      distanceMeters: 321.8688,
      services: [
        {
          key: 'muni-14-ferry-plaza',
          agency: { id: 'SFMTA', name: 'Muni' },
          transport: {
            mode: 'bus',
            shortName: '14',
            name: '14 Mission',
            color: '#C9413D',
          },
          headsign: 'Ferry Plaza',
          departures: [
            {
              scheduledTime: '2026-07-30T10:03:00-07:00',
              delaySeconds: 0,
              isRealtime: true,
            },
            {
              scheduledTime: '2026-07-30T10:08:00-07:00',
              delaySeconds: 120,
              isRealtime: true,
            },
            {
              scheduledTime: '2026-07-30T10:20:00-07:00',
              delaySeconds: null,
              isRealtime: false,
            },
          ],
        },
        {
          key: 'bart-yellow-antioch',
          agency: { id: 'BART', name: 'Bay Area Rapid Transit' },
          transport: {
            mode: 'subway',
            shortName: 'Yellow',
            name: 'Yellow Line',
          },
          headsign: 'Antioch',
          departures: [
            {
              scheduledTime: '2026-07-30T10:13:00-07:00',
              delaySeconds: null,
              isRealtime: false,
            },
          ],
        },
      ],
    },
  ],
};

afterEach(cleanup);

describe('NearbyDepartures', () => {
  it('renders a quiet loading state for a result that has not arrived', () => {
    render(<NearbyDepartures result={null} onRetry={() => {}} />);

    const board = screen.getByRole('region', { name: 'Nearby departures' });
    expect(within(board).getByText('Finding nearby departures…')).toBeVisible();
    expect(within(board).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(board).queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders an explicit failure and retries on request', () => {
    const onRetry = vi.fn();
    render(
      <NearbyDepartures
        result={{ ok: false, reason: 'network' }}
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Nearby departures' }),
    ).toBeVisible();
    expect(screen.getByText('Nearby departures unavailable')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders an honest empty state for a successful empty result', () => {
    render(
      <NearbyDepartures result={{ ...result, stations: [] }} onRetry={() => {}} />,
    );

    expect(screen.getByText('No nearby transit found')).toBeVisible();
  });

  it('renders station distance, shared identities, headsigns, and at most two effective times', () => {
    render(<NearbyDepartures result={result} onRetry={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Mission Street Station' })).toBeVisible();
    expect(screen.getByText('0.2 mi away')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Muni 14 bus' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'BART Yellow train' })).toBeVisible();
    expect(screen.getByText('Ferry Plaza')).toBeVisible();
    expect(screen.getByText('Antioch')).toBeVisible();

    const missionService = screen.getByTestId('service-muni-14-ferry-plaza');
    expect(within(missionService).getByText('10:03 AM')).toBeVisible();
    expect(within(missionService).getByText('10:10 AM')).toBeVisible();
    expect(within(missionService).queryByText('10:20 AM')).not.toBeInTheDocument();
    expect(within(missionService).getAllByText('Live')).toHaveLength(2);

    const bartService = screen.getByTestId('service-bart-yellow-antioch');
    expect(within(bartService).getByText('10:13 AM')).toBeVisible();
    expect(within(bartService).getByText('Scheduled')).toBeVisible();
  });

  it.each([null, Number.NaN, Number.POSITIVE_INFINITY])(
    'omits an unavailable station distance for %s',
    (distanceMeters) => {
      render(
        <NearbyDepartures
          result={{
            ...result,
            stations: [{ ...result.stations[0], distanceMeters }],
          }}
          onRetry={() => {}}
        />,
      );

      expect(
        screen.getByRole('heading', { name: 'Mission Street Station' }),
      ).toBeVisible();
      expect(screen.queryByText(/mi away$/)).not.toBeInTheDocument();
    },
  );

  it('labels a zero-second delay Live and a missing delay Scheduled', () => {
    render(<NearbyDepartures result={result} onRetry={() => {}} />);

    expect(screen.getAllByText('Live')).toHaveLength(2);
    expect(screen.getByText('Scheduled')).toBeVisible();
  });

  it('explains when a service has no departures in the next hour', () => {
    const emptyServiceResult = {
      ...result,
      stations: [
        {
          ...result.stations[0],
          services: [
            {
              ...result.stations[0].services[0],
              departures: [],
            },
          ],
        },
      ],
    };
    render(<NearbyDepartures result={emptyServiceResult} onRetry={() => {}} />);

    expect(screen.getByText('No departures in the next hour')).toBeVisible();
  });

  it('caps station rows at five and never renders curated fallback language', () => {
    const stations = Array.from({ length: 6 }, (_, index) => ({
      ...result.stations[0],
      id: `station-${index + 1}`,
      name: `Station ${index + 1}`,
    }));
    const { container } = render(
      <NearbyDepartures result={{ ...result, stations }} onRetry={() => {}} />,
    );

    expect(screen.getAllByTestId('nearby-station')).toHaveLength(5);
    expect(screen.queryByText('Station 6')).not.toBeInTheDocument();
    const copy = container.textContent;
    expect(copy).not.toMatch(/min walk/i);
    expect(copy).not.toMatch(/Curated schedule/i);
    expect(copy).not.toMatch(/Ocean Avenue/i);
    expect(copy).not.toMatch(/Plymouth Avenue/i);
    expect(copy).not.toMatch(/Balboa Park/i);
  });
});
