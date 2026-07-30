import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import WalkingJourney from '../WalkingJourney.jsx';

const externalUrl = 'https://example.test/walk';
const fetchedAt = Date.parse('2026-07-30T18:00:00.000Z');
const walkingRoute = {
  id: 'walking-route',
  durationSeconds: 1_320,
  lengthMeters: 1_931.2128,
  actions: [
    { type: 'depart', instruction: 'Head west on Howard Street.' },
    {
      type: 'turn',
      instruction: 'Turn left onto South Van Ness Avenue.',
      lengthMeters: 0,
      durationSeconds: 0,
    },
    { type: 'arrive', instruction: 'Your destination is on the right.' },
  ],
  notices: [{ code: 'private-road', title: 'Part of this route may be private.' }],
};

afterEach(cleanup);

describe('WalkingJourney', () => {
  it('renders the whole walking route with status, notices, and an external fallback', () => {
    render(
      <WalkingJourney
        result={{
          ok: true,
          route: walkingRoute,
          source: 'network',
          fetchedAt,
        }}
        externalUrl={externalUrl}
      />,
    );

    const region = screen.getByRole('region', { name: 'Walking directions' });
    expect(within(region).getAllByRole('listitem')).toHaveLength(
      walkingRoute.actions.length,
    );
    expect(within(region).getByText(/walk 1\.2 mi/i)).toBeVisible();
    expect(
      within(region).getByText('Turn left onto South Van Ness Avenue.'),
    ).toBeVisible();
    expect(
      within(region).getByText('Part of this route may be private.'),
    ).toBeVisible();
    expect(within(region).getByRole('status', { name: /live/i })).toBeVisible();
    expect(
      within(region).getByRole('link', {
        name: /open walking directions in google maps/i,
      }),
    ).toHaveAttribute('href', externalUrl);
  });

  it('shows a loading state while the walking route is requested', () => {
    render(<WalkingJourney result={null} externalUrl={externalUrl} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading walking directions',
    );
    expect(
      screen.getByRole('link', {
        name: /open walking directions in google maps/i,
      }),
    ).toHaveAttribute('href', externalUrl);
  });

  it.each([
    ['missing-api-key', 'Walking directions are not configured yet.'],
    ['unauthorized', 'Walking directions are unavailable right now.'],
    ['rate-limited', 'Walking directions are busy. Try again in a moment.'],
    ['no-route', 'No walking route was found for this destination.'],
    ['invalid-request', 'Walking directions are unavailable for this trip.'],
    ['timeout', 'Walking directions need a connection.'],
    ['invalid-response', 'Walking directions need a connection.'],
    ['network', 'Walking directions need a connection.'],
  ])('shows a useful %s failure with retry and the external fallback', (reason, message) => {
    const onRetry = vi.fn();
    render(
      <WalkingJourney
        result={{ ok: false, reason }}
        onRetry={onRetry}
        externalUrl={externalUrl}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(message);
    fireEvent.click(screen.getByRole('button', { name: 'Retry walking directions' }));
    expect(onRetry).toHaveBeenCalledWith();
    expect(
      screen.getByRole('link', {
        name: /open walking directions in google maps/i,
      }),
    ).toHaveAttribute('href', externalUrl);
  });

  it('renders an explicit empty-actions message instead of inventing directions', () => {
    render(
      <WalkingJourney
        result={{
          ok: true,
          route: { ...walkingRoute, actions: [] },
          source: 'cache',
          fetchedAt,
        }}
        externalUrl={externalUrl}
      />,
    );

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.getByText('Turn-by-turn steps are unavailable.')).toBeVisible();
    expect(screen.getByRole('status', { name: /cached/i })).toBeVisible();
  });
});
