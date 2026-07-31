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
      agency: { id: 'SFMTA', name: 'Muni' },
      transport: {
        mode: 'lightRail',
        shortName: 'K',
        name: 'K Ingleside',
        headsign: 'Embarcadero',
      },
    },
    {
      id: 's3',
      type: 'transit',
      agency: { id: 'SFMTA', name: 'Muni' },
      // no shortName — line id must derive from the first word of `name`
      transport: {
        mode: 'bus',
        name: '38R Geary Rapid',
        headsign: 'Transit Center',
      },
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

const bartTrip = {
  ...transitTrip,
  id: 'trip-bart',
  lines: [{ name: 'BART Yellow' }],
  sections: [
    {
      id: 'bart-yellow',
      type: 'transit',
      agency: { id: 'BART', name: 'Bay Area Rapid Transit' },
      transport: { mode: 'train', shortName: 'Yellow' },
    },
  ],
};

function renderCard(overrides = {}) {
  const props = {
    trip: transitTrip,
    index: 0,
    expanded: false,
    onToggle: vi.fn(),
    warnings: [],
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

  it('renders every route section in a journey timeline', () => {
    renderCard();
    const timeline = screen.getByRole('list', { name: 'Journey timeline' });
    expect(timeline).toBeVisible();
    expect(timeline).toHaveAttribute('role', 'list');
    expect(timeline).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('K Ingleside toward Embarcadero')).toBeVisible();
    expect(
      screen.getByText('38R Geary Rapid toward Transit Center'),
    ).toBeVisible();
  });

  it('renders one accessible BART identity with a decorative bundled logo', () => {
    renderCard({ trip: bartTrip });

    const identities = screen.getAllByRole('img', {
      name: 'BART Yellow train',
    });
    expect(identities).toHaveLength(1);
    const logo = identities[0].querySelector('img[src$="bart-logo.svg"]');
    expect(logo).toHaveAttribute('alt', '');
    expect(logo).toHaveAttribute('aria-hidden', 'true');
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

  it('toggles without exposing transit line identifiers', () => {
    const props = renderCard();
    const toggle = screen.getByRole('button', {
      name: 'View full itinerary for K Ingleside and 38R Geary Rapid',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(props.onToggle).toHaveBeenCalledWith();
  });

  it('hides the itinerary panel and its contents until expanded', () => {
    const { rerender } = render(
      <TripCard
        trip={transitTrip}
        index={0}
        expanded={false}
        onToggle={vi.fn()}
        warnings={[]}
      />,
    );

    expect(screen.queryByTestId('itinerary-steps-stub')).not.toBeInTheDocument();
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
        warnings={[]}
      />,
    );

    expect(screen.getByRole('button', { name: /hide full itinerary/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByTestId('itinerary-steps-stub')).toHaveTextContent(
      'trip-transit',
    );
    expect(panel).not.toHaveAttribute('hidden');
  });

  it('renders the external maps link only when a URL is supplied', () => {
    const { rerender } = render(
      <TripCard
        trip={transitTrip}
        index={0}
        expanded
        onToggle={vi.fn()}
        warnings={[]}
      />,
    );
    expect(
      screen.queryByRole('link', {
        name: /open transit directions in google maps/i,
      }),
    ).not.toBeInTheDocument();

    rerender(
      <TripCard
        trip={transitTrip}
        index={0}
        expanded
        onToggle={vi.fn()}
        warnings={[]}
        externalUrl="https://example.test/directions"
      />,
    );
    expect(
      screen.getByRole('link', {
        name: /open transit directions in google maps/i,
      }),
    ).toHaveAttribute('href', 'https://example.test/directions');
  });

  it('marks only affected lines while collapsed and shows warning details once when expanded', () => {
    const warnings = [
      {
        id: 'k-alert',
        header: 'K service delay',
        description: 'Allow extra travel time.',
        severity: 'SIGNIFICANT_DELAYS',
        source: '511',
        url: 'https://example.test/k-alert',
        sectionIds: ['s2'],
      },
    ];
    const { rerender } = render(
      <TripCard
        trip={transitTrip}
        index={0}
        expanded={false}
        onToggle={vi.fn()}
        warnings={warnings}
      />,
    );
    expect(screen.queryByText('K service delay')).not.toBeInTheDocument();
    const advisory = screen.getByLabelText('Service advisory in full itinerary');
    expect(advisory).toHaveTextContent('!');
    expect(advisory).not.toHaveAttribute('aria-live');
    expect(advisory).not.toHaveAttribute('role', 'alert');
    expect(screen.getAllByLabelText(/Muni .* (train|bus)/)).toHaveLength(2);
    expect(
      screen.getByLabelText(/^Muni 38R.* bus$/).parentElement,
    ).not.toContainElement(advisory);
    expect(screen.queryByText('Allow extra travel time.')).not.toBeInTheDocument();
    expect(screen.queryByText('High impact')).not.toBeInTheDocument();
    expect(screen.queryByText('511')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Read K service delay warning' }),
    ).not.toBeInTheDocument();

    rerender(
      <TripCard
        trip={transitTrip}
        index={0}
        expanded
        onToggle={vi.fn()}
        warnings={warnings}
      />,
    );

    expect(screen.getAllByText('K service delay')).toHaveLength(1);
    expect(screen.getByText('Allow extra travel time.')).toBeVisible();
    expect(screen.getByText('High impact')).toBeVisible();
    expect(screen.getByText('511')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Read K service delay warning' }),
    ).toHaveAttribute('href', 'https://example.test/k-alert');
    const itinerary = screen.getByTestId('itinerary-steps-stub');
    expect(
      screen.getByRole('region', { name: 'Warnings for this trip' }),
    ).toBe(itinerary.previousElementSibling);
  });

  it('does not mark any line for an unscoped trip warning', () => {
    renderCard({
      warnings: [
        {
          id: 'trip-notice',
          header: 'Trip notice',
          description: 'Read the full itinerary.',
          severity: 'info',
          source: 'HERE',
          url: '',
          sectionIds: [],
        },
      ],
    });

    expect(
      screen.queryByLabelText('Service advisory in full itinerary'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Trip notice')).not.toBeInTheDocument();
  });
});
