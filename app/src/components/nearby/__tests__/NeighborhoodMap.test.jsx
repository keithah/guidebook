import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NeighborhoodMap from '../NeighborhoodMap.jsx';

vi.mock('../OnlineNearbyMap.jsx', () => ({
  default: ({ onTileFailure }) => (
    <section aria-label="Live neighborhood map">
      <button type="button" onClick={onTileFailure}>
        Simulate tile failure
      </button>
    </section>
  ),
}));

const mapProps = {
  center: { lat: 37.7226, lng: -122.4547 },
  cottage: { lat: 37.7226, lng: -122.4547 },
  stops: [],
  showMe: false,
  dest: null,
};

function setOnline(value) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

afterEach(cleanup);

describe('NeighborhoodMap', () => {
  beforeEach(() => setOnline(true));

  it('uses the live map online and the packaged orientation map offline', () => {
    render(<NeighborhoodMap {...mapProps} />);
    expect(
      screen.getByRole('region', { name: 'Live neighborhood map' }),
    ).toBeVisible();

    setOnline(false);
    fireEvent(window, new Event('offline'));

    expect(
      screen.getByRole('img', {
        name: 'Offline neighborhood map around The SF Cottage in Ingleside',
      }),
    ).toHaveAttribute(
      'src',
      `${import.meta.env.BASE_URL}images/ingleside-neighborhood.svg`,
    );
    expect(screen.getByText(/offline orientation map/i)).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'OpenStreetMap contributors' }),
    ).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');

    setOnline(true);
    fireEvent(window, new Event('online'));
    expect(
      screen.getByRole('region', { name: 'Live neighborhood map' }),
    ).toBeVisible();
  });

  it('falls back after a tile failure without changing browser connectivity', () => {
    render(<NeighborhoodMap {...mapProps} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Simulate tile failure' }),
    );

    expect(window.navigator.onLine).toBe(true);
    expect(
      screen.getByRole('img', {
        name: 'Offline neighborhood map around The SF Cottage in Ingleside',
      }),
    ).toBeVisible();
  });

  it('starts with the packaged orientation map when already offline', () => {
    setOnline(false);
    render(<NeighborhoodMap {...mapProps} />);

    const mapImage =
      screen.getByRole('img', {
        name: 'Offline neighborhood map around The SF Cottage in Ingleside',
      });

    expect(mapImage).toBeVisible();
    expect(mapImage).toHaveStyle({ objectFit: 'contain' });
    expect(
      screen.getByRole('button', { name: 'View full offline map' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the complete offline map accessibly and closes it with Escape', () => {
    setOnline(false);
    render(<NeighborhoodMap {...mapProps} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'View full offline map' }),
    );

    expect(
      screen.getByRole('dialog', { name: 'Full offline neighborhood map' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Close full offline map' }),
    ).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('isolates the background and contains focus until the modal closes', async () => {
    setOnline(false);
    const { container } = render(<NeighborhoodMap {...mapProps} />);
    const trigger = screen.getByRole('button', {
      name: 'View full offline map',
    });
    trigger.focus();

    fireEvent.click(trigger);

    const closeButton = screen.getByRole('button', {
      name: 'Close full offline map',
    });
    const attributionLink = screen.getByRole('link', {
      name: 'OpenStreetMap contributors',
    });
    await waitFor(() => expect(closeButton).toHaveFocus());
    expect(container).toHaveAttribute('inert');
    expect(container).toHaveAttribute('aria-hidden', 'true');

    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });
    expect(attributionLink).toHaveFocus();
    fireEvent.keyDown(attributionLink, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(attributionLink, { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(container).not.toHaveAttribute('inert');
    expect(container).not.toHaveAttribute('aria-hidden');
  });
});
