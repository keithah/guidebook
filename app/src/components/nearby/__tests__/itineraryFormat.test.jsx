import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatDuration, formatTime, RouteTime } from '../itineraryFormat.jsx';

afterEach(cleanup);

describe('itinerary formatting', () => {
  it.each([
    [0, '1 min'],
    [3_600, '1 hr'],
    [3_900, '1 hr 5 min'],
    [Number.NaN, '0 min'],
  ])('formats %s seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it('formats valid times in San Francisco regardless of the process time zone', () => {
    const previousTimeZone = process.env.TZ;
    process.env.TZ = 'UTC';
    try {
      expect(formatTime('2026-07-28T10:00:00-07:00')).toBe('10:00 AM');
    } finally {
      if (previousTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimeZone;
    }
    expect(formatTime('garbage')).toBeNull();
  });

  it('uses the supplied fallback only for an invalid time', () => {
    const { container, rerender } = render(<RouteTime value="garbage" />);
    expect(container).toBeEmptyDOMElement();
    rerender(
      <RouteTime value="garbage" fallback={<span>Time pending</span>} />,
    );
    expect(screen.getByText('Time pending')).toBeVisible();
  });

  it('renders a valid value as a semantic time element', () => {
    const value = '2026-07-28T18:00:00.000Z';
    render(<RouteTime value={value} />);
    expect(document.querySelector(`time[datetime="${value}"]`)).toBeVisible();
  });
});
