import { describe, expect, it } from 'vitest';

import { googleMapsDirectionsUrl } from '../mapsDirections.js';

const origin = { lat: 37.77154, lng: -122.41761 };
const destination = { lat: 37.7596, lng: -122.4269 };

describe('googleMapsDirectionsUrl', () => {
  it.each(['transit', 'walking'])('builds a Google Maps %s URL', (mode) => {
    const url = new URL(
      googleMapsDirectionsUrl(origin, destination, mode),
    );

    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('origin')).toBe('37.77154,-122.41761');
    expect(url.searchParams.get('destination')).toBe('37.7596,-122.4269');
    expect(url.searchParams.get('travelmode')).toBe(mode);
  });

  it('rejects driving and other unsupported modes', () => {
    expect(() =>
      googleMapsDirectionsUrl(origin, destination, 'driving'),
    ).toThrow(TypeError);
    expect(() =>
      googleMapsDirectionsUrl(origin, destination, ''),
    ).toThrow(TypeError);
  });

  it.each([
    [{ lat: Number.NaN, lng: origin.lng }, destination],
    [origin, { lat: destination.lat, lng: Number.POSITIVE_INFINITY }],
  ])('rejects non-finite coordinates', (invalidOrigin, invalidDestination) => {
    expect(() =>
      googleMapsDirectionsUrl(invalidOrigin, invalidDestination, 'walking'),
    ).toThrow(TypeError);
  });
});
