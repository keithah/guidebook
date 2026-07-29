import { describe, expect, it } from 'vitest';

import {
  lineBadge,
  validatePropertyFixture,
} from '../generate-offline-map.mjs';

const validProperty = {
  address: { lat: 37.7226, lng: -122.4547 },
  transit: { nearbyStops: [] },
};

describe('offline map property fixture validation', () => {
  it.each([
    [
      { ...validProperty, address: { lat: '37.7', lng: -122.4 } },
      'address.lat',
    ],
    [{ ...validProperty, address: { lat: 37.7, lng: null } }, 'address.lng'],
    [
      { ...validProperty, transit: { nearbyStops: null } },
      'transit.nearbyStops',
    ],
  ])('rejects an invalid fixture before generation', (fixture, field) => {
    expect(() => validatePropertyFixture(fixture)).toThrow(field);
  });

  it('accepts a fixture with finite coordinates and a stop list', () => {
    expect(() => validatePropertyFixture(validProperty)).not.toThrow();
  });
});

describe('offline map line badges', () => {
  it.each([
    ['BUS', '29'],
    ['BART', 'BA'],
    ['KT', 'KT'],
    ['long-name', 'LO'],
    [undefined, '?'],
  ])('renders %s as %s', (line, badge) => {
    expect(lineBadge(line)).toBe(badge);
  });
});
