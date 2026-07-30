import { describe, expect, it } from 'vitest';

import { normalizeRideshareOptions } from '../rideshareOptions.js';

describe('normalizeRideshareOptions', () => {
  it('normalizes property estimates into the future provider shape', () => {
    expect(
      normalizeRideshareOptions([
        {
          name: 'Uber',
          note: 'Usually 3–6 min away',
          color: '#14201D',
          launchUrl: 'https://m.uber.com/',
        },
      ]),
    ).toEqual([
      {
        providerId: 'uber',
        name: 'Uber',
        estimateKind: 'approximate',
        pickupWaitLabel: 'Usually 3–6 min away',
        note: 'Approximate pickup wait',
        color: '#14201D',
        launchUrl: 'https://m.uber.com/',
      },
    ]);
  });

  it.each(['#', 'javascript:alert(1)', 'not a URL', 'http://example.test/'])(
    'turns unsafe launch URL %s into an unavailable action',
    (launchUrl) => {
      expect(
        normalizeRideshareOptions([
          { name: 'Waymo One!', note: 'Soon', color: '#0B7A5A', launchUrl },
        ]),
      ).toEqual([
        expect.objectContaining({
          providerId: 'waymoone',
          launchUrl: null,
        }),
      ]);
    },
  );

  it('keeps only valid six-digit colors and handles non-array input', () => {
    expect(
      normalizeRideshareOptions([
        { name: 'Lyft', note: 'Soon', color: '#fff', launchUrl: null },
      ]),
    ).toEqual([
      expect.objectContaining({
        color: '#14201D',
        launchUrl: null,
      }),
    ]);
    expect(normalizeRideshareOptions(null)).toEqual([]);
  });
});
