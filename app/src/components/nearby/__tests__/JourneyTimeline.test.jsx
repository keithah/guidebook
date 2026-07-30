import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import JourneyTimeline from '../JourneyTimeline.jsx';

describe('JourneyTimeline', () => {
  it('renders every section in order with operator and vehicle labels', () => {
    const sections = [
      { id: 'walk-1', type: 'pedestrian', durationSeconds: 300 },
      {
        id: 'rail-1',
        type: 'transit',
        durationSeconds: 900,
        agency: { id: 'SFMTA', name: 'Muni' },
        transport: { mode: 'lightRail', shortName: 'K', color: '#005B95' },
      },
      { id: 'walk-2', type: 'pedestrian', durationSeconds: 240 },
      {
        id: 'bus-1',
        type: 'transit',
        durationSeconds: 360,
        agency: { id: 'SF', name: 'Muni' },
        transport: { mode: 'bus', shortName: '29' },
      },
    ];

    render(<JourneyTimeline sections={sections} />);

    const list = screen.getByRole('list', { name: 'Journey timeline' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(within(list).getByLabelText('Muni K train')).toBeVisible();
    expect(within(list).getByLabelText('Muni 29 bus')).toBeVisible();
    expect(within(list).getAllByText(/walk/i)).toHaveLength(2);
  });

  it('keeps unknown sections instead of truncating the journey', () => {
    render(
      <JourneyTimeline
        sections={[
          {
            type: 'unknown',
            label: 'Ferry transfer',
            durationSeconds: 120,
          },
        ]}
      />,
    );

    expect(screen.getByText('Ferry transfer')).toBeVisible();
  });
});
