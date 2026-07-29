export function cacheUntilFromHeaders(headers, nowMs) {
  const cacheControl = headers.get('cache-control');

  if (cacheControl) {
    const directives = cacheControl
      .split(',')
      .map((directive) => directive.trim().toLowerCase());

    if (directives.includes('no-store') || directives.includes('no-cache')) {
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
