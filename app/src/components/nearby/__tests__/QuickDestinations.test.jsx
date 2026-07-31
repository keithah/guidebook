import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import property from '../../../data/properties/sfcottage.json';
import QuickDestinations from '../QuickDestinations.jsx';

const expected = [
  ['cottage', '⌂ Take me back to the cottage', 'The SF Cottage', '251 Harold Ave, San Francisco, CA', 37.72260, -122.45470, 'property'],
  ['union-square', 'Downtown / Union Square', 'Union Square', 'Union Square, San Francisco, CA', 37.78782, -122.40748, 'locality'],
  ['sfo', 'SFO', 'San Francisco International Airport', 'San Francisco International Airport, CA', 37.62131, -122.37896, 'airport'],
  ['golden-gate-park', 'Golden Gate Park', 'Golden Gate Park', 'Golden Gate Park, San Francisco, CA', 37.77181, -122.48088, 'locality'],
  ['mission-district', 'The Mission', 'Mission District', 'Mission District, San Francisco, CA', 37.75993, -122.41808, 'locality'],
  ['ocean-beach', 'Ocean Beach', 'Ocean Beach', 'Ocean Beach, San Francisco, CA', 37.75975, -122.51016, 'locality'],
];

afterEach(cleanup);

describe('QuickDestinations', () => {
  it('renders the canonical structured destinations in permanent display order', () => {
    expect(
      property.transit.quickDestinations.map((destination) => [
        destination.id,
        destination.buttonLabel,
        destination.title,
        destination.address,
        destination.position.lat,
        destination.position.lng,
        destination.resultType,
      ]),
    ).toEqual(expected);

    render(
      <QuickDestinations
        destinations={property.transit.quickDestinations}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(
      expected.map(([, buttonLabel]) => buttonLabel),
    );
  });

  it('selects the exact structured destination without owning search UI', () => {
    const onSelect = vi.fn();
    const mission = property.transit.quickDestinations[4];
    render(
      <QuickDestinations
        destinations={property.transit.quickDestinations}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'The Mission' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(mission);
    expect(document.querySelector('form')).toBeNull();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
