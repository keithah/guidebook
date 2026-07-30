import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../hooks/useLiveDepartures.js', () => ({
  useLiveDepartures: vi.fn(),
}));

vi.mock('../../lib/weather.js', () => ({
  fetchCurrentWeather: vi.fn().mockResolvedValue({ ok: false }),
  fetchWeatherForDate: vi.fn().mockResolvedValue({ ok: false }),
  fetchForecastDays: vi.fn().mockResolvedValue({ ok: false }),
}));

vi.mock('../../lib/geo.js', () => ({
  getCurrentPosition: vi.fn(),
}));

import { useLiveDepartures } from '../../hooks/useLiveDepartures.js';
import { getCurrentPosition } from '../../lib/geo.js';
import { encodeStay } from '../../lib/stayHash.js';
import { AppProvider, useApp } from '../AppContext.jsx';

let latestContext;
function Capture() {
  latestContext = useApp();
  return null;
}

function renderProvider() {
  render(
    <AppProvider>
      <Capture />
    </AppProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = '';
  useLiveDepartures.mockReturnValue({ times: {}, meta: {} });
});

afterEach(() => {
  cleanup();
  latestContext = undefined;
});

describe('AppContext', () => {
  it('uses a valid stay location override without calling browser geolocation', async () => {
    window.location.hash = encodeStay({
      guestName: 'Jamie',
      checkin: '2026-07-30',
      checkout: '2026-08-03',
      fakeLocation: {
        label: '1620 Howard St, San Francisco',
        lat: 37.77154,
        lng: -122.41761,
      },
    });
    getCurrentPosition.mockResolvedValue({ lat: 1, lng: 2 });
    renderProvider();

    await act(async () => latestContext.allowLocation());

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(latestContext.coords).toEqual({
      label: '1620 Howard St, San Francisco',
      lat: 37.77154,
      lng: -122.41761,
      source: 'stay-override',
    });
    expect(latestContext.located).toBe(true);
  });

  it('uses browser geolocation when the stay override is invalid', async () => {
    window.location.hash = encodeStay({
      guestName: 'Jamie',
      checkin: '2026-07-30',
      checkout: '2026-08-03',
      fakeLocation: {
        label: '1620 Howard St, San Francisco',
        lat: '37.77154',
        lng: -122.41761,
      },
    });
    getCurrentPosition.mockResolvedValue({ lat: 37.78, lng: -122.42 });
    renderProvider();

    await act(async () => latestContext.allowLocation());

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(latestContext.coords).toEqual({ lat: 37.78, lng: -122.42 });
  });

  it('no longer exposes dest/setDest now that destination search owns that state', () => {
    useLiveDepartures.mockReturnValue({ times: {}, meta: {} });
    renderProvider();

    expect('dest' in latestContext).toBe(false);
    expect('setDest' in latestContext).toBe(false);
  });

  it('prefers the live K departure time over the static schedule when available', () => {
    useLiveDepartures.mockReturnValue({
      times: { 0: '7, 21′' },
      meta: {},
    });
    renderProvider();

    expect(useLiveDepartures).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ line: 'K' })]),
    );
    expect(latestContext.kTimes).toBe('7, 21′');
  });

  it('falls back to the static K schedule when no live time is available for that index', () => {
    useLiveDepartures.mockReturnValue({ times: {}, meta: {} });
    renderProvider();

    expect(latestContext.kTimes).toBe('4, 16′');
  });
});
