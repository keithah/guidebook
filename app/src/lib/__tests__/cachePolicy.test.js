import { describe, expect, it } from 'vitest';

import { cacheUntilFromHeaders } from '../cachePolicy.js';

describe('cacheUntilFromHeaders', () => {
  it('uses a positive browser max-age from Cache-Control', () => {
    const headers = new Headers({ 'cache-control': 'public, max-age=120' });

    expect(cacheUntilFromHeaders(headers, 1_000)).toBe(121_000);
  });

  it('does not treat s-maxage as browser max-age', () => {
    const headers = new Headers({ 'cache-control': 'public, s-maxage=120' });

    expect(cacheUntilFromHeaders(headers, 1_000)).toBeNull();
  });

  it('refuses responses marked no-store', () => {
    const headers = new Headers({
      'cache-control': 'no-store, max-age=120',
    });

    expect(cacheUntilFromHeaders(headers, 1_000)).toBeNull();
  });

  it('refuses responses marked no-cache', () => {
    const headers = new Headers({ 'cache-control': 'no-cache' });

    expect(cacheUntilFromHeaders(headers, 1_000)).toBeNull();
  });

  it('refuses parameterized no-cache directives', () => {
    const headers = new Headers({
      'cache-control': 'no-cache="set-cookie", max-age=120',
    });

    expect(cacheUntilFromHeaders(headers, 1_000)).toBeNull();
  });

  it('uses a future Expires header when Cache-Control is absent', () => {
    const headers = new Headers({ expires: 'Thu, 01 Jan 1970 00:02:01 GMT' });

    expect(cacheUntilFromHeaders(headers, 1_000)).toBe(121_000);
  });

  it('refuses an expired Expires header', () => {
    const headers = new Headers({ expires: 'Thu, 01 Jan 1970 00:00:01 GMT' });

    expect(cacheUntilFromHeaders(headers, 2_000)).toBeNull();
  });

  it('returns null when caching headers are missing', () => {
    expect(cacheUntilFromHeaders(new Headers(), 1_000)).toBeNull();
  });
});
