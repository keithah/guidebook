import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LiveStatus from '../LiveStatus.jsx';

const now = Date.parse('2026-07-28T19:00:00.000Z');

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LiveStatus', () => {
  it('falls back to a generic label for unrecognized sources without a timestamp', () => {
    render(<LiveStatus source="mystery" />);
    expect(screen.getByRole('status', { name: 'Updated' })).toBeVisible();
  });

  it('lets a custom label override the source-derived label', () => {
    render(<LiveStatus source="network" label="Just synced" timestamp={now} />);
    expect(screen.getByRole('status')).toHaveAccessibleName(/just synced/i);
    expect(screen.getByText('Just synced')).toBeVisible();
  });

  it.each([
    ['network', true],
    ['live', true],
    ['cache', false],
    ['cached', false],
    ['stale', false],
    ['unavailable', false],
  ])('only shows the live indicator dot for %s sources', (source, hasDot) => {
    const { container } = render(<LiveStatus source={source} />);
    const dot = container.querySelector('span[aria-hidden="true"]');
    if (hasDot) {
      expect(dot).toBeInTheDocument();
    } else {
      expect(dot).not.toBeInTheDocument();
    }
  });

  it('describes recency in human terms across minutes, hours, and days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { rerender, container } = render(
      <LiveStatus source="network" timestamp={now - 30_000} />,
    );
    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Live · updated just now',
    );

    rerender(<LiveStatus source="network" timestamp={now - 5 * 60_000} />);
    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Live · updated 5 min ago',
    );

    rerender(<LiveStatus source="network" timestamp={now - 125 * 60_000} />);
    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Live · updated 2 hr ago',
    );

    rerender(
      <LiveStatus source="network" timestamp={now - 25 * 60 * 60_000} />,
    );
    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Live · updated 1 day ago',
    );

    rerender(
      <LiveStatus source="network" timestamp={now - 50 * 60 * 60_000} />,
    );
    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Live · updated 2 days ago',
    );
    expect(container.querySelector('time')).toHaveAttribute(
      'dateTime',
      new Date(now - 50 * 60 * 60_000).toISOString(),
    );
  });

  it('accepts Date instances and ISO strings as timestamps', () => {
    const { container: dateContainer } = render(
      <LiveStatus source="cache" timestamp={new Date(now)} />,
    );
    expect(dateContainer.querySelector('time')).toBeInTheDocument();

    cleanup();
    const { container: stringContainer } = render(
      <LiveStatus source="cache" timestamp={new Date(now).toISOString()} />,
    );
    expect(stringContainer.querySelector('time')).toBeInTheDocument();
  });

  it('omits the timestamp when it is missing, empty, or invalid', () => {
    const { container: nullContainer } = render(
      <LiveStatus source="unavailable" timestamp={null} />,
    );
    expect(screen.getByRole('status')).toHaveAccessibleName('Unavailable');
    expect(nullContainer.querySelector('time')).not.toBeInTheDocument();

    cleanup();
    render(<LiveStatus source="unavailable" timestamp="" />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Unavailable');

    cleanup();
    render(<LiveStatus source="unavailable" timestamp="not-a-date" />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Unavailable');
  });
});