/**
 * Determines when a response should stop being cached based on its HTTP caching headers.
 * @param {Headers} headers - The response headers containing cache directives.
 * @param {number} nowMs - The current time in milliseconds since the Unix epoch.
 * @return {number|null} The cache expiration time in milliseconds since the Unix epoch, or `null` when caching is disallowed or no valid future expiration is available.
 */
export function cacheUntilFromHeaders(headers, nowMs) {
  const cacheControl = headers.get('cache-control');

  if (cacheControl) {
    const directives = cacheControl
      .split(',')
      .map((directive) => directive.trim().toLowerCase());
    const directiveNames = directives.map(
      (directive) => directive.split('=', 1)[0],
    );

    if (
      directiveNames.includes('no-store') ||
      directiveNames.includes('no-cache')
    ) {
      return null;
    }

    const maxAge = directives.find((directive) =>
      directive.startsWith('max-age='),
    );
    if (maxAge) {
      const seconds = maxAge.slice('max-age='.length);
      if (!/^\d+$/.test(seconds) || Number(seconds) <= 0) return null;
      return nowMs + Number(seconds) * 1_000;
    }
  }

  const expiresAt = Date.parse(headers.get('expires') ?? '');
  return Number.isFinite(expiresAt) && expiresAt > nowMs ? expiresAt : null;
}
