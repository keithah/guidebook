import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../hooks/useLiveDepartures.js', () => ({
  useLiveDepartures: vi.fn().mockReturnValue({ times: {}, meta: {} }),
}));

vi.mock('../lib/weather.js', () => ({
  fetchCurrentWeather: vi.fn().mockResolvedValue({ ok: false }),
  fetchWeatherForDate: vi.fn().mockResolvedValue({ ok: false }),
  fetchForecastDays: vi.fn().mockResolvedValue({ ok: false }),
}));

import GuestPreviewBar from './GuestPreviewBar.jsx';
import { AppProvider } from '../context/AppContext.jsx';
import { decodeStayHash } from '../lib/stayHash.js';

function renderPreviewBar() {
  render(
    <AppProvider>
      <GuestPreviewBar />
    </AppProvider>,
  );
}

function openGuestLinkBuilder() {
  fireEvent.click(screen.getByRole('button', { name: 'Dev: preview a guest stay link' }));
}

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('GuestPreviewBar', () => {
  it('shows the deployed guest-link path', () => {
    renderPreviewBar();
    openGuestLinkBuilder();

    expect(
      screen.getByText(/Build a \/guidebook\/#<hash> guest link/),
    ).toBeVisible();
  });

  it('previews a guest without replacing the current path', () => {
    const { origin, pathname, search } = window.location;
    renderPreviewBar();
    openGuestLinkBuilder();

    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(window.location.origin).toBe(origin);
    expect(window.location.pathname).toBe(pathname);
    expect(window.location.search).toBe(search);
    expect(decodeStayHash(window.location.hash)).toMatchObject({
      guestName: 'Sarah',
      code: '4821',
    });
  });
});
