import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

    expect(
      screen.getByRole('img', {
        name: 'Offline neighborhood map around The SF Cottage in Ingleside',
      }),
    ).toBeVisible();
  });
});
