import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ItinerarySteps.jsx', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: ({ trip }) => (
      <div data-testid="itinerary-steps-stub">{trip.id}</div>
    ),
  };
});

vi.mock('../TransitAlerts.jsx', () => ({
  default: ({ lineIds, alerts }) => (
    <div data-testid="transit-alerts-stub">
      {(lineIds ?? []).join(',')}|{(alerts ?? []).length}
    </div>
  ),
}));

import TripCard from '../TripCard.jsx';

const transitTrip = {
  id: 'trip-transit',
  departureTime: '2026-07-28T18:00:00.000Z',
  arrivalTime: '2026-07-28T18:30:00.000Z',
  durationSeconds: 1_800,
  walkingDurationSeconds: 300,
  transferCount: 1,
  lines: [{ name: 'K Ingleside' }, { name: '38R Geary Rapid' }],
  sections: [
    { id: 's1', type: 'pedestrian' },
    {
      id: 's2',
      type: 'transit',
      transport: { shortName: 'K', name: 'K Ingleside', headsign: 'Embarcadero' },
    },
    {
      id: 's3',
      type: 'transit',
      // no shortName — line id must derive from the first word of `name`
      transport: { name: '38R Geary Rapid', headsign: 'Transit Center' },
    },
  ],
};

const walkingOnlyTrip = {
  id: 'trip-walk',
  departureTime: '2026-07-28T18:00:00.000Z',
  arrivalTime: '2026-07-28T18:20:00.000Z',
  durationSeconds: 1_200,
  walkingDurationSeconds: 1_200,
  transferCount: 0,
  lines: [],
  sections: [{ type: 'pedestrian', label: 'Walking directions' }],
};

function renderCard(overrides = {}) {
  const props = {
    trip: transitTrip,
    index: 0,
    expanded: false,
    onToggle: vi.fn(),
    alerts: [],
    externalUrl: undefined,
    ...overrides,
  };
  render(<TripCard {...props} />);
  return props;
}

afterEach(cleanup);

describe('TripCard', () => {
  it('shows the departure/arrival range, duration, and Recommended only for the first trip', () => {
    renderCard({ index: 0 });
    expect(screen.getByText('Recommended')).toBeVisible();
    expect(screen.getByText('30 min')).toBeVisible();
    expect(
      document.querySelector('time[datetime="2026-07-28T18:00:00.000Z"]'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('time[datetime="2026-07-28T18:30:00.000Z"]'),
    ).toBeInTheDocument();

    cleanup();
    renderCard({ index: 1 });
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument();
  });

  it('renders a line badge and label for every transit section', () => {
    renderCard();
    expect(screen.getByText('K Ingleside toward Embarcadero')).toBeVisible();
    expect(
      screen.getByText('38R Geary Rapid toward Transit Center'),
    ).toBeVisible();
  });

  it('falls back to the first section label when a trip has no transit sections', () => {
    renderCard({ trip: walkingOnlyTrip });
    expect(screen.getByText('Walking directions')).toBeVisible();
  });

  it('falls back to "Transit option" when a trip has neither transit sections nor labeled sections', () => {
    renderCard({ trip: { ...walkingOnlyTrip, sections: [] } });
    expect(screen.getByText('Transit option')).toBeVisible();
  });

  it.each([
    [300, 'Walk 5 min'],
    [0, 'No walking'],
    [undefined, 'No walking'],
  ])('summarizes walking time %s as %s', (walkingDurationSeconds, text) => {
    renderCard({ trip: { ...transitTrip, walkingDurationSeconds } });
    expect(screen.getByText(text)).toBeVisible();
  });

  it.each([
    [0, 'No transfers'],
    [1, '1 transfer'],
    [3, '3 transfers'],
    [Number.NaN, 'No transfers'],
  ])('summarizes %s transfers as %s', (transferCount, text) => {
    renderCard({ trip: { ...transitTrip, transferCount } });
    expect(screen.getByText(text)).toBeVisible();
  });

  it('shows "Time pending" when departure or arrival times are missing or invalid', () => {
    renderCard({
      trip: { ...transitTrip, departureTime: null, arrivalTime: 'garbage' },
    });
    expect(screen.getAllByText('Time pending')).toHaveLength(2);
  });

  it('toggles with deduplicated line ids derived from transit sections', () => {
    const props = renderCard();
    const toggle = screen.getByRole('button', {
      name: 'View full itinerary for K Ingleside and 38R Geary Rapid',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(props.onToggle).toHaveBeenCalledWith(['K', '38R']);
  });

  it('hides the itinerary panel and its contents until expanded', () => {
    const { rerender } = render(
      <TripCard
        trip={transitTrip}
        index={0}
        expanded={false}
        onToggle={vi.fn()}
        alerts={[]}
      />,
    );

    expect(screen.queryByTestId('itinerary-steps-stub')).not.toBeInTheDocument();
    expect(screen.queryByTestId('transit-alerts-stub')).not.toBeInTheDocument();
    const panel = screen.getByRole('button', {
      name: /view full itinerary/i,
    }).nextElementSibling;
    expect(panel).toHaveAttribute('hidden');

    rerender(
      <TripCard
        trip={transitTrip}
        index={0}
        expanded
        onToggle={vi.fn()}
        alerts={[]}
      />,
    );

    expect(screen.getByRole('button', { name: /hide full itinerary/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByTestId('itinerary-steps-stub')).toHaveTextContent(
      'trip-transit',
    );
    expect(screen.getByTestId('transit-alerts-stub')).toBeInTheDocument();
    expect(panel).not.toHaveAttribute('hidden');
  });

  it('renders the external maps link only when a URL is supplied', () => {
    const { rerender } = render(
      <TripCard
        trip={transitTrip}
        index={0}
        expanded
        onToggle={vi.fn()}
        alerts={[]}
      />,
    );
    expect(
      screen.queryByRole('link', { name: /open in maps/i }),
    ).not.toBeInTheDocument();

    rerender(
      <TripCard
        trip={transitTrip}
        index={0}
        expanded
        onToggle={vi.fn()}
        alerts={[]}
        externalUrl="https://example.test/directions"
      />,
    );
    expect(screen.getByRole('link', { name: /open in maps/i })).toHaveAttribute(
      'href',
      'https://example.test/directions',
    );
  });

  it('passes the trip alerts and active line ids through to TransitAlerts', () => {
    const alerts = [{ id: 'k-alert' }];
    renderCard({ expanded: true, alerts });
    expect(screen.getByTestId('transit-alerts-stub')).toHaveTextContent(
      'K,38R',
    );
  });
});