const DEFAULT_PROVIDER_COLOR = '#14201D';

/**
 * Keep only display-safe six-digit hexadecimal colors.
 * @param {*} value - Candidate provider color.
 * @returns {string} Valid color or the neutral provider fallback.
 */
function providerColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? '').trim())
    ? String(value).trim()
    : DEFAULT_PROVIDER_COLOR;
}

/**
 * Keep only absolute HTTPS provider launch URLs.
 * @param {*} value - Candidate provider launch URL.
 * @returns {string|null} Normalized HTTPS URL or null.
 */
function providerLaunchUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Normalize property rides into the future live-provider result shape.
 * @param {Array<Object>} rides - Property-configured approximate estimates.
 * @returns {Array<{providerId:string,name:string,estimateKind:string,pickupWaitLabel:string,note:string,color:string,launchUrl:string|null}>} Normalized rideshare options.
 */
export function normalizeRideshareOptions(rides) {
  if (!Array.isArray(rides)) return [];

  return rides.map((ride) => {
    const name = String(ride?.name ?? '').trim() || 'Rideshare';
    return {
      providerId:
        name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'rideshare',
      name,
      estimateKind: 'approximate',
      pickupWaitLabel:
        typeof ride?.note === 'string' && ride.note.trim()
          ? ride.note.trim()
          : 'Pickup wait unavailable',
      note: 'Approximate pickup wait',
      color: providerColor(ride?.color),
      launchUrl: providerLaunchUrl(ride?.launchUrl),
    };
  });
}
