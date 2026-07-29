import { describe, expect, it } from 'vitest';

import { runtimeCaching } from '../../../vite.config.js';

describe('PWA runtime caching', () => {
  it('keeps live map and transit requests out of the service worker', () => {
    const patterns = runtimeCaching.map((entry) => String(entry.urlPattern));
    const registeredPatterns = patterns.join('\n');

    expect(registeredPatterns).not.toMatch(/openstreetmap|511|hereapi/);
  });

  it('retains weather and font runtime caching', () => {
    const patterns = runtimeCaching.map((entry) => String(entry.urlPattern));
    const registeredPatterns = patterns.join('\n');

    expect(registeredPatterns).toMatch(/weather/);
    expect(registeredPatterns).toMatch(/googleapis|gstatic/);
  });
});
