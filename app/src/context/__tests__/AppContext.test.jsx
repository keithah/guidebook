import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
  cleanup();
  latestContext = undefined;
});

describe('AppContext', () => {
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