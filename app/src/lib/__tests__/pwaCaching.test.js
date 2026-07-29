import { describe, expect, it } from 'vitest';

import { runtimeCaching } from '../../../vite.config.js';

describe('PWA runtime caching', () => {
  it('allows only weather and font requests into runtime caches', () => {
    expect(runtimeCaching).toHaveLength(2);
    expect(
      runtimeCaching.map(({ urlPattern, handler, options }) => ({
        pattern: String(urlPattern),
        handler,
        cacheName: options.cacheName,
      })),
    ).toEqual([
      {
        pattern: String(/^https:\/\/api\.weather\.gov\//),
        handler: 'NetworkFirst',
        cacheName: 'nws-weather',
      },
      {
        pattern: String(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//),
        handler: 'CacheFirst',
        cacheName: 'google-fonts',
      },
    ]);
  });
});
