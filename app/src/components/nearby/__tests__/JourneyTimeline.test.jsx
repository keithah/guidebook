import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import JourneyTimeline from '../JourneyTimeline.jsx';

afterEach(cleanup);

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
      {
        id: 'bart-1',
        type: 'transit',
        durationSeconds: 600,
        agency: { id: 'BART', name: 'Bay Area Rapid Transit' },
        transport: { mode: 'train', shortName: 'Blue' },
      },
    ];

    render(<JourneyTimeline sections={sections} />);

    const list = screen.getByRole('list', { name: 'Journey timeline' });
    const legs = within(list).getAllByRole('listitem');
    expect(legs).toHaveLength(5);
    expect(within(legs[0]).getByText('Walk')).toBeVisible();
    expect(
      within(legs[1]).getByRole('img', { name: 'Muni K train' }),
    ).toBeVisible();
    expect(within(legs[2]).getByText('Walk')).toBeVisible();
    expect(
      within(legs[3]).getByRole('img', { name: 'Muni 29 bus' }),
    ).toBeVisible();

    const bartIdentity = within(legs[4]).getByRole('img', {
      name: 'BART Blue train',
    });
    expect(bartIdentity).toBeVisible();
    const logo = bartIdentity.querySelector('img[src$="bart-logo.svg"]');
    expect(logo).toHaveAttribute('alt', '');
    expect(logo).toHaveAttribute('aria-hidden', 'true');
  });

  it('exposes robust list semantics and a visible keyboard focus indicator', () => {
    render(<JourneyTimeline sections={[]} />);

    const list = screen.getByRole('list', { name: 'Journey timeline' });
    expect(list).toHaveAttribute('role', 'list');
    expect(list).toHaveAttribute('tabindex', '0');

    list.focus();
    fireEvent.focus(list);

    expect(list).toHaveFocus();
    expect(list).toHaveStyle({ outline: '2px solid #2c6d61' });
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

  it('applies the classified contrast-safe foreground to line labels', () => {
    render(
      <JourneyTimeline
        sections={[
          {
            id: 'bart-yellow',
            type: 'transit',
            agency: { id: 'BART' },
            transport: {
              mode: 'train',
              shortName: 'Yellow',
              textColor: '#FFFFFF',
            },
          },
          {
            id: 'muni-k',
            type: 'transit',
            agency: { id: 'SFMTA' },
            transport: {
              mode: 'lightRail',
              shortName: 'K',
              color: '#005B95',
              textColor: '#000000',
            },
          },
        ]}
      />,
    );

    const yellowIdentity = screen.getByRole('img', {
      name: 'BART Yellow train',
    });
    const muniIdentity = screen.getByRole('img', { name: 'Muni K train' });
    expect(within(yellowIdentity).getByText('Yellow')).toHaveStyle({
      background: '#F9DF3A',
      color: '#000000',
    });
    expect(within(muniIdentity).getByText('K')).toHaveStyle({
      background: '#005B95',
      color: '#FFFFFF',
    });
  });

  it('marks only the affected transit identity with a non-live advisory', () => {
    render(
      <JourneyTimeline
        sections={[
          {
            id: 'muni-k',
            type: 'transit',
            agency: { id: 'SFMTA' },
            transport: { mode: 'lightRail', shortName: 'K' },
          },
          {
            id: 'muni-38r',
            type: 'transit',
            agency: { id: 'SFMTA' },
            transport: { mode: 'bus', shortName: '38R' },
          },
        ]}
        advisorySectionIds={new Set(['muni-k'])}
      />,
    );

    expect(screen.getAllByRole('img', { name: /Muni .* (train|bus)/ })).toHaveLength(2);
    const advisory = screen.getByRole('img', {
      name: 'Service advisory in full itinerary',
    });
    expect(advisory).toHaveTextContent('!');
    expect(advisory).toHaveStyle({ background: '#F4C84A' });
    expect(advisory).not.toHaveAttribute('aria-live');
    expect(advisory).not.toHaveAttribute('role', 'alert');
    expect(screen.getByRole('img', { name: 'Muni 38R bus' }).parentElement).not.toContainElement(
      advisory,
    );
  });
});
