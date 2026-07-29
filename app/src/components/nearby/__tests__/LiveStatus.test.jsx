import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LiveStatus from '../LiveStatus.jsx';

const now = Date.parse('2026-07-28T19:00:00.000Z');

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LiveStatus', () => {
  it('shows a live indicator dot and label for the "live" source alias', () => {
    const { container } = render(<LiveStatus source="live" />);
    expect(screen.getByRole('status', { name: 'Live' })).toBeVisible();
    expect(container.querySelector('span[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('omits the live indicator dot for non-live sources', () => {
    const { container } = render(<LiveStatus source="cache" />);
    expect(screen.getByRole('status', { name: 'Cached' })).toBeVisible();
    expect(
      container.querySelector('span[aria-hidden="true"]'),
    ).not.toBeInTheDocument();
  });

  it('falls back to "Updated" for an unrecognized source', () => {
    render(<LiveStatus source="mystery" />);
    expect(screen.getByRole('status', { name: 'Updated' })).toBeVisible();
  });

  it('lets an explicit label override the source-derived label', () => {
    render(<LiveStatus source="network" label="Custom status" />);
    expect(screen.getByRole('status', { name: 'Custom status' })).toBeVisible();
  });

  it('renders no timestamp when none is provided or the value cannot be parsed', () => {
    const { container, rerender } = render(<LiveStatus source="cache" />);
    expect(container.querySelector('time')).not.toBeInTheDocument();

    rerender(<LiveStatus source="cache" timestamp="not-a-real-date" />);
    expect(container.querySelector('time')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cached' })).toBeVisible();
  });

  it('accepts a Date instance and an ISO string, formatting a "just now" age within the first minute', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { rerender } = render(
      <LiveStatus source="network" timestamp={new Date(now - 5_000)} />,
    );
    expect(
      screen.getByRole('status', { name: 'Live · updated just now' }),
    ).toBeVisible();

    rerender(
      <LiveStatus
        source="network"
        timestamp={new Date(now - 5_000).toISOString()}
      />,
    );
    expect(
      screen.getByRole('status', { name: 'Live · updated just now' }),
    ).toBeVisible();
  });

  it('formats hour- and day-scale ages', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { rerender } = render(
      <LiveStatus source="stale" timestamp={now - 60 * 60 * 1_000} />,
    );
    expect(
      screen.getByRole('status', { name: 'Last known · updated 1 hr ago' }),
    ).toBeVisible();

    rerender(
      <LiveStatus source="stale" timestamp={now - 24 * 60 * 60 * 1_000} />,
    );
    expect(
      screen.getByRole('status', { name: 'Last known · updated 1 day ago' }),
    ).toBeVisible();

    rerender(
      <LiveStatus source="stale" timestamp={now - 48 * 60 * 60 * 1_000} />,
    );
    expect(
      screen.getByRole('status', { name: 'Last known · updated 2 days ago' }),
    ).toBeVisible();
  });

  it('never reports a negative age for a timestamp in the future', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    render(<LiveStatus source="network" timestamp={now + 60_000} />);
    expect(
      screen.getByRole('status', { name: 'Live · updated just now' }),
    ).toBeVisible();
  });
});