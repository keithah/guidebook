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
    [{ ...validProperty, address: undefined }, 'address.lat'],
    [
      { ...validProperty, address: { lat: Infinity, lng: -122.4 } },
      'address.lat',
    ],
    [{ ...validProperty, address: { lat: 37.7, lng: NaN } }, 'address.lng'],
  ])('rejects an invalid fixture before generation', (fixture, field) => {
    expect(() => validatePropertyFixture(fixture)).toThrow(field);
  });

  it('accepts a fixture with finite coordinates and a stop list', () => {
    expect(() => validatePropertyFixture(validProperty)).not.toThrow();
  });

  it('accepts a fixture with a populated list of nearby stops', () => {
    const fixtureWithStops = {
      ...validProperty,
      transit: {
        nearbyStops: [
          { name: 'West Portal Station', sub: 'Inbound', lat: 37.74, lng: -122.466, line: 'K' },
        ],
      },
    };
    expect(() => validatePropertyFixture(fixtureWithStops)).not.toThrow();
  });
});

describe('offline map line badges', () => {
  it.each([
    ['BUS', '29'],
    ['BART', 'BA'],
    ['KT', 'KT'],
    ['long-name', 'LO'],
    [undefined, '?'],
    ['', '?'],
    [null, '?'],
    ['J', 'J'],
  ])('renders %s as %s', (line, badge) => {
    expect(lineBadge(line)).toBe(badge);
  });
});
