import { describe, expect, it } from 'vitest';
import {
  decodeStayHash,
  encodeStay,
  normalizeStayLocationOverride,
} from '../stayHash.js';

const howardLocation = {
  label: '  1620 Howard St, San Francisco  ',
  lat: 37.77154,
  lng: -122.41761,
};

describe('stay location overrides', () => {
  it('round-trips and normalizes a valid fake location', () => {
    const stay = {
      guestName: 'Jamie',
      checkin: '2026-07-30',
      checkout: '2026-08-03',
      code: '2468',
      fakeLocation: howardLocation,
    };

    const decoded = decodeStayHash(`#${encodeStay(stay)}`);

    expect(normalizeStayLocationOverride(decoded)).toEqual({
      label: '1620 Howard St, San Francisco',
      lat: 37.77154,
      lng: -122.41761,
      source: 'stay-override',
    });
  });

  it.each([
    [-90, -180],
    [90, 180],
  ])('accepts boundary coordinates %s, %s', (lat, lng) => {
    expect(
      normalizeStayLocationOverride({
        fakeLocation: { label: 'Boundary', lat, lng },
      }),
    ).toEqual({ label: 'Boundary', lat, lng, source: 'stay-override' });
  });

  it.each([
    [undefined],
    [{}],
    [{ fakeLocation: null }],
    [{ fakeLocation: { label: '', lat: 37.7, lng: -122.4 } }],
    [{ fakeLocation: { label: '   ', lat: 37.7, lng: -122.4 } }],
    [{ fakeLocation: { label: 'Howard', lat: '37.7', lng: -122.4 } }],
    [{ fakeLocation: { label: 'Howard', lat: Number.NaN, lng: -122.4 } }],
    [{ fakeLocation: { label: 'Howard', lat: 91, lng: -122.4 } }],
    [{ fakeLocation: { label: 'Howard', lat: 37.7, lng: -181 } }],
  ])('rejects invalid override %#', (stay) => {
    expect(normalizeStayLocationOverride(stay)).toBeNull();
  });
});
