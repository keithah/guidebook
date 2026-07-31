import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import RideshareOptions from '../RideshareOptions.jsx';

const rides = [
  {
    name: 'Uber',
    note: 'Usually 3–6 min away',
    color: '#14201D',
    launchUrl: 'https://m.uber.com/',
  },
  {
    name: 'Lyft',
    note: 'Usually 4–8 min away',
    color: '#7A2E8E',
    launchUrl: 'https://ride.lyft.com/',
  },
  {
    name: 'Waymo',
    note: 'Usually 5–12 min away',
    color: '#0B7A5A',
    launchUrl: 'https://waymo.com/waymo-one/',
  },
];

afterEach(cleanup);

describe('RideshareOptions', () => {
  it('renders clearly approximate estimates and safe provider launch links', () => {
    render(<RideshareOptions rides={rides} />);

    const section = screen.getByRole('region', { name: 'Rideshare options' });
    expect(within(section).getByText('Approximate pickup waits')).toBeVisible();
    expect(within(section).getByText('Approximate—not live')).toBeVisible();
    expect(
      within(section).getByText(
        'Opening a provider may require a connection and its app or website.',
      ),
    ).toBeVisible();

    for (const ride of rides) {
      expect(within(section).getByText(ride.name)).toBeVisible();
      expect(within(section).getByText(ride.note)).toBeVisible();
      const link = within(section).getByRole('link', {
        name: `Open ${ride.name}`,
      });
      expect(link).toHaveAttribute('href', ride.launchUrl);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    }
  });

  it('renders an unavailable action without an anchor for an unsafe URL', () => {
    render(
      <RideshareOptions
        rides={[
          {
            name: 'Uber',
            note: 'Usually 3–6 min away',
            color: '#14201D',
            launchUrl: 'javascript:alert(1)',
          },
        ]}
      />,
    );

    expect(screen.getByText('Launch unavailable')).toBeVisible();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
