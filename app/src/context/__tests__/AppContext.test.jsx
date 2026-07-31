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
const howardStay = {
  guestName: 'Jamie',
  checkin: '2026-07-30',
  checkout: '2026-08-03',
  fakeLocation: {
    label: '1620 Howard St, San Francisco',
    lat: 37.77154,
    lng: -122.41761,
  },
};
const ferryStay = {
  guestName: 'Morgan',
  checkin: '2026-08-04',
  checkout: '2026-08-08',
  fakeLocation: {
    label: 'Ferry Building, San Francisco',
    lat: 37.7955,
    lng: -122.3937,
  },
};

function Capture({ onContext }) {
  latestContext = useApp();
  onContext?.(latestContext);
  return null;
}

function renderProvider(onContext) {
  render(
    <AppProvider>
      <Capture onContext={onContext} />
    </AppProvider>,
  );
}

async function changeStayHash(stay) {
  await act(async () => {
    window.location.hash = stay ? encodeStay(stay) : '';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

async function replaceHashAfterUnrelatedRender(stay) {
  window.history.replaceState(null, '', stay ? `#${encodeStay(stay)}` : '');
  act(() => latestContext.setQuery('force unrelated render'));
  await act(async () => {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
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

describe('getCurrentPosition', () => {
  it('publishes browser coordinates with device provenance', async () => {
    const geolocationDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      'geolocation',
    );
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((onSuccess) =>
          onSuccess({
            coords: { latitude: 37.78, longitude: -122.42 },
          }),
        ),
      },
    });
    const actualGeo = await vi.importActual('../../lib/geo.js');

    try {
      await expect(actualGeo.getCurrentPosition()).resolves.toEqual({
        lat: 37.78,
        lng: -122.42,
        source: 'device',
      });
    } finally {
      if (geolocationDescriptor) {
        Object.defineProperty(
          navigator,
          'geolocation',
          geolocationDescriptor,
        );
      } else {
        delete navigator.geolocation;
      }
    }
  });
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

    expect(latestContext.coords).toBeNull();
    expect(latestContext.located).toBe(false);

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

  it('clears an active stay location override when the stay hash is removed', async () => {
    window.location.hash = encodeStay(howardStay);
    renderProvider();

    await act(async () => latestContext.allowLocation());
    await changeStayHash(null);

    expect(latestContext.coords).toBeNull();
    expect(latestContext.located).toBe(false);
  });

  it('activates a replacement stay location override after consent', async () => {
    window.location.hash = encodeStay(howardStay);
    renderProvider();

    await act(async () => latestContext.allowLocation());
    await changeStayHash({
      guestName: 'Morgan',
      checkin: '2026-08-04',
      checkout: '2026-08-08',
      fakeLocation: {
        label: 'Ferry Building, San Francisco',
        lat: 37.7955,
        lng: -122.3937,
      },
    });

    expect(latestContext.coords).toEqual({
      label: 'Ferry Building, San Francisco',
      lat: 37.7955,
      lng: -122.3937,
      source: 'stay-override',
    });
    expect(latestContext.located).toBe(true);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('keeps a valid replacement hash coherent across an unrelated render', async () => {
    window.history.replaceState(null, '', `#${encodeStay(howardStay)}`);
    renderProvider();

    await act(async () => latestContext.allowLocation());
    await replaceHashAfterUnrelatedRender(ferryStay);

    expect(latestContext.coords).toEqual({
      label: 'Ferry Building, San Francisco',
      lat: 37.7955,
      lng: -122.3937,
      source: 'stay-override',
    });
    expect(latestContext.located).toBe(true);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('clears an active stay location override when its replacement is invalid', async () => {
    window.location.hash = encodeStay(howardStay);
    renderProvider();

    await act(async () => latestContext.allowLocation());
    await changeStayHash({
      guestName: 'Morgan',
      checkin: '2026-08-04',
      checkout: '2026-08-08',
      fakeLocation: {
        label: 'Ferry Building, San Francisco',
        lat: '37.7955',
        lng: -122.3937,
      },
    });

    expect(latestContext.coords).toBeNull();
    expect(latestContext.located).toBe(false);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('clears an invalid replacement after an unrelated render before hashchange', async () => {
    window.history.replaceState(null, '', `#${encodeStay(howardStay)}`);
    renderProvider();

    await act(async () => latestContext.allowLocation());
    await replaceHashAfterUnrelatedRender({
      ...ferryStay,
      fakeLocation: { ...ferryStay.fakeLocation, lat: '37.7955' },
    });

    expect(latestContext.coords).toBeNull();
    expect(latestContext.located).toBe(false);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('replaces consented browser coordinates when a valid stay location hash arrives', async () => {
    getCurrentPosition.mockResolvedValue({
      lat: 46.8797,
      lng: -110.3626,
      source: 'device',
    });
    renderProvider();

    await act(async () => latestContext.allowLocation());
    expect(latestContext.coords).toEqual({
      lat: 46.8797,
      lng: -110.3626,
      source: 'device',
    });

    await changeStayHash(howardStay);

    expect(latestContext.coords).toEqual({
      label: '1620 Howard St, San Francisco',
      lat: 37.77154,
      lng: -122.41761,
      source: 'stay-override',
    });
    expect(latestContext.located).toBe(true);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('never exposes pending browser coordinates after a valid stay hash arrives', async () => {
    let resolvePosition;
    getCurrentPosition.mockReturnValue(
      new Promise((resolve) => {
        resolvePosition = resolve;
      }),
    );
    const coordsAfterHashChange = [];
    let hashChanged = false;
    renderProvider((context) => {
      if (hashChanged) coordsAfterHashChange.push(context.coords);
    });
    let locationPromise;

    act(() => {
      locationPromise = latestContext.allowLocation();
    });
    hashChanged = true;
    await changeStayHash(howardStay);
    await act(async () => {
      resolvePosition({ lat: 46.8797, lng: -110.3626 });
      await locationPromise;
    });

    expect(coordsAfterHashChange).not.toContainEqual({
      lat: 46.8797,
      lng: -110.3626,
    });
    expect(latestContext.coords).toEqual({
      label: '1620 Howard St, San Francisco',
      lat: 37.77154,
      lng: -122.41761,
      source: 'stay-override',
    });
    expect(latestContext.located).toBe(true);
    expect(latestContext.locating).toBe(false);
    expect(latestContext.locateError).toBeNull();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('preserves cottage coordinates when the stay hash changes', async () => {
    renderProvider();
    const cottageCoords = {
      lat: latestContext.property.address.lat,
      lng: latestContext.property.address.lng,
      source: 'cottage',
    };

    act(() => latestContext.useCottageAsLocation());
    await changeStayHash(howardStay);

    expect(latestContext.coords).toEqual(cottageCoords);
    expect(latestContext.located).toBe(true);
  });

  it('clears a geolocation error when cottage location is selected', async () => {
    getCurrentPosition.mockRejectedValue(new Error('Location blocked.'));
    renderProvider();
    const cottageCoords = {
      lat: latestContext.property.address.lat,
      lng: latestContext.property.address.lng,
      source: 'cottage',
    };

    await act(async () => latestContext.allowLocation());
    expect(latestContext.locateError).toBe('Location blocked.');
    expect(latestContext.coords).toEqual(cottageCoords);

    act(() => latestContext.useCottageAsLocation());

    expect(latestContext.coords).toEqual(cottageCoords);
    expect(latestContext.located).toBe(true);
    expect(latestContext.locating).toBe(false);
    expect(latestContext.locateError).toBeNull();

    await changeStayHash(howardStay);

    expect(latestContext.coords).toEqual(cottageCoords);
    expect(latestContext.located).toBe(true);
    expect(latestContext.locateError).toBeNull();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('ignores pending browser geolocation after cottage selection', async () => {
    let resolvePosition;
    getCurrentPosition.mockReturnValue(
      new Promise((resolve) => {
        resolvePosition = resolve;
      }),
    );
    renderProvider();
    const cottageCoords = {
      lat: latestContext.property.address.lat,
      lng: latestContext.property.address.lng,
      source: 'cottage',
    };
    let locationPromise;

    act(() => {
      locationPromise = latestContext.allowLocation();
    });
    act(() => latestContext.useCottageAsLocation());
    await act(async () => {
      resolvePosition({ lat: 46.8797, lng: -110.3626 });
      await locationPromise;
    });

    expect(latestContext.coords).toEqual(cottageCoords);
    expect(latestContext.located).toBe(true);
    expect(latestContext.locating).toBe(false);

    await changeStayHash(howardStay);

    expect(latestContext.coords).toEqual(cottageCoords);
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
    getCurrentPosition.mockResolvedValue({
      lat: 37.78,
      lng: -122.42,
      source: 'device',
    });
    renderProvider();

    await act(async () => latestContext.allowLocation());

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(latestContext.coords).toEqual({
      lat: 37.78,
      lng: -122.42,
      source: 'device',
    });
  });

  it('clears a geolocation error when a valid stay override activates', async () => {
    getCurrentPosition.mockRejectedValue(new Error('Location blocked.'));
    renderProvider();

    await act(async () => latestContext.allowLocation());
    expect(latestContext.locateError).toBe('Location blocked.');

    await changeStayHash(howardStay);

    expect(latestContext.coords).toEqual({
      label: '1620 Howard St, San Francisco',
      lat: 37.77154,
      lng: -122.41761,
      source: 'stay-override',
    });
    expect(latestContext.locateError).toBeNull();

    await changeStayHash(null);

    expect(latestContext.coords).toBeNull();
    expect(latestContext.located).toBe(false);
    expect(latestContext.locateError).toBeNull();
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
