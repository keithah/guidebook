import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProvider, useApp } from '../AppContext.jsx';
import { getCurrentPosition } from '../../lib/geo.js';

vi.mock('../../lib/geo.js', () => ({
  getCurrentPosition: vi.fn(),
}));

vi.mock('../../lib/weather.js', () => ({
  fetchCurrentWeather: vi.fn().mockResolvedValue({ ok: false }),
  fetchWeatherForDate: vi.fn().mockResolvedValue({ ok: false }),
  fetchForecastDays: vi.fn().mockResolvedValue({ ok: false }),
}));

vi.mock('../../hooks/useLiveDepartures.js', () => ({
  useLiveDepartures: () => ({ times: {}, meta: {} }),
}));

// The cottage's fixed address, used as the fallback location.
const COTTAGE_LAT = 37.7226;
const COTTAGE_LNG = -122.4547;

function LocationProbe() {
  const {
    located,
    coords,
    locating,
    locateError,
    allowLocation,
    useCottageAsLocation,
    backOpen,
    setBackOpen,
  } = useApp();

  return (
    <div>
      <div data-testid="located">{String(located)}</div>
      <div data-testid="locating">{String(locating)}</div>
      <div data-testid="coords">
        {coords ? `${coords.lat},${coords.lng}` : 'none'}
      </div>
      <div data-testid="error">{locateError ?? 'none'}</div>
      <div data-testid="back-open">{String(backOpen)}</div>
      <button onClick={allowLocation}>Allow location</button>
      <button onClick={useCottageAsLocation}>Use cottage</button>
      <button onClick={() => setBackOpen(true)}>Open back panel</button>
      <button onClick={() => setBackOpen(false)}>Close back panel</button>
    </div>
  );
}

function renderProbe() {
  render(
    <AppProvider>
      <LocationProbe />
    </AppProvider>,
  );
}

beforeEach(() => {
  window.location.hash = '';
});

afterEach(cleanup);

describe('AppContext location state', () => {
  it('starts unlocated with no coordinates, error, or open panel', () => {
    renderProbe();
    expect(screen.getByTestId('located')).toHaveTextContent('false');
    expect(screen.getByTestId('locating')).toHaveTextContent('false');
    expect(screen.getByTestId('coords')).toHaveTextContent('none');
    expect(screen.getByTestId('error')).toHaveTextContent('none');
    expect(screen.getByTestId('back-open')).toHaveTextContent('false');
  });

  it('allowLocation resolves the browser position into coords', async () => {
    getCurrentPosition.mockResolvedValue({ lat: 37.8, lng: -122.4 });
    renderProbe();

    fireEvent.click(screen.getByText('Allow location'));

    await waitFor(() =>
      expect(screen.getByTestId('located')).toHaveTextContent('true'),
    );
    expect(screen.getByTestId('coords')).toHaveTextContent('37.8,-122.4');
    expect(screen.getByTestId('locating')).toHaveTextContent('false');
    expect(screen.getByTestId('error')).toHaveTextContent('none');
  });

  it('falls back to the cottage coordinates and surfaces the error message when geolocation fails', async () => {
    getCurrentPosition.mockRejectedValue(new Error('User denied Geolocation'));
    renderProbe();

    fireEvent.click(screen.getByText('Allow location'));

    await waitFor(() =>
      expect(screen.getByTestId('located')).toHaveTextContent('true'),
    );
    expect(screen.getByTestId('error')).toHaveTextContent(
      'User denied Geolocation',
    );
    expect(screen.getByTestId('coords')).toHaveTextContent(
      `${COTTAGE_LAT},${COTTAGE_LNG}`,
    );
    expect(screen.getByTestId('locating')).toHaveTextContent('false');
  });

  it('uses a default error message when the rejection has no message', async () => {
    getCurrentPosition.mockRejectedValue({});
    renderProbe();

    fireEvent.click(screen.getByText('Allow location'));

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent(
        'Could not get your location.',
      ),
    );
    expect(screen.getByTestId('coords')).toHaveTextContent(
      `${COTTAGE_LAT},${COTTAGE_LNG}`,
    );
  });

  it('sets the cottage as the location immediately without calling geolocation', () => {
    renderProbe();

    fireEvent.click(screen.getByText('Use cottage'));

    expect(screen.getByTestId('located')).toHaveTextContent('true');
    expect(screen.getByTestId('coords')).toHaveTextContent(
      `${COTTAGE_LAT},${COTTAGE_LNG}`,
    );
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('toggles the back panel open state', () => {
    renderProbe();

    expect(screen.getByTestId('back-open')).toHaveTextContent('false');
    fireEvent.click(screen.getByText('Open back panel'));
    expect(screen.getByTestId('back-open')).toHaveTextContent('true');
    fireEvent.click(screen.getByText('Close back panel'));
    expect(screen.getByTestId('back-open')).toHaveTextContent('false');
  });
});