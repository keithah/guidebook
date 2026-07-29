import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LiveStatus from '../LiveStatus.jsx';

const now = Date.parse('2026-07-28T19:00:00.000Z');

function getDot(container) {
  return Array.from(container.querySelectorAll('[aria-hidden="true"]')).find(
    (el) => el.style.borderRadius === '50%',
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LiveStatus', () => {
  it('falls back to "Updated" when the source has no known label and none is supplied', () => {
    render(<LiveStatus source="mystery" timestamp={undefined} />);
    expect(screen.getByRole('status', { name: 'Updated' })).toBeVisible();
  });

  it('lets an explicit label override the source-derived label', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    render(
      <LiveStatus source="network" timestamp={now} label="Custom label" />,
    );
    expect(
      screen.getByRole('status', { name: 'Custom label · updated just now' }),
    ).toBeVisible();
  });

  it('renders the pulsing dot only for network/live sources', () => {
    const { container, rerender } = render(
      <LiveStatus source="network" timestamp={undefined} />,
    );
    expect(getDot(container)).toBeTruthy();

    rerender(<LiveStatus source="live" timestamp={undefined} />);
    expect(getDot(container)).toBeTruthy();

    rerender(<LiveStatus source="cache" timestamp={undefined} />);
    expect(getDot(container)).toBeUndefined();

    rerender(<LiveStatus source="stale" timestamp={undefined} />);
    expect(getDot(container)).toBeUndefined();

    rerender(<LiveStatus source="unavailable" timestamp={undefined} />);
    expect(getDot(container)).toBeUndefined();
  });

  it('omits the timestamp element and "updated" wording when no valid timestamp is given', () => {
    const { container, rerender } = render(
      <LiveStatus source="cache" timestamp={undefined} />,
    );
    expect(container.querySelector('time')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cached' })).toBeVisible();

    rerender(<LiveStatus source="cache" timestamp="not-a-real-date" />);
    expect(container.querySelector('time')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cached' })).toBeVisible();

    rerender(<LiveStatus source="cache" timestamp="" />);
    expect(container.querySelector('time')).not.toBeInTheDocument();
  });

  it.each([
    [0, 'a Date instance'],
    [1, 'an ISO string'],
    [2, 'a numeric epoch'],
  ])('accepts %s timestamp representation (%s)', (variant) => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const iso = '2026-07-28T18:58:00.000Z';
    const timestamp =
      variant === 0 ? new Date(iso) : variant === 1 ? iso : Date.parse(iso);

    const { container } = render(
      <LiveStatus source="network" timestamp={timestamp} />,
    );
    expect(
      screen.getByRole('status', { name: 'Live · updated 2 min ago' }),
    ).toBeVisible();
    expect(container.querySelector('time')).toHaveAttribute(
      'datetime',
      iso,
    );
  });

  it.each([
    [59_000, 'just now'],
    [60_000, '1 min ago'],
    [59 * 60_000, '59 min ago'],
    [60 * 60_000, '1 hr ago'],
    [23 * 60 * 60_000, '23 hr ago'],
    [24 * 60 * 60_000, '1 day ago'],
    [2 * 24 * 60 * 60_000, '2 days ago'],
  ])(
    'formats an elapsed time of %sms as "%s"',
    (elapsedMs, expectedAge) => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
      render(
        <LiveStatus source="cache" timestamp={now - elapsedMs} />,
      );
      expect(
        screen.getByRole('status', { name: `Cached · updated ${expectedAge}` }),
      ).toBeVisible();
    },
  );
});