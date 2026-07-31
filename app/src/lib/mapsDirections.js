const GOOGLE_MAPS_DIRECTIONS_URL = 'https://www.google.com/maps/dir/';
const ALLOWED_MODES = new Set(['transit', 'walking']);

/**
 * Format finite coordinates for a Google Maps directions URL.
 * @param {Object} position - Position containing latitude and longitude.
 * @returns {string} Comma-separated coordinates.
 */
function formatPosition(position) {
  if (!Number.isFinite(position?.lat) || !Number.isFinite(position?.lng)) {
    throw new TypeError('Directions coordinates must be finite');
  }
  return `${position.lat},${position.lng}`;
}

/**
 * Build a Google Maps fallback for one supported journey mode.
 * @param {Object} origin - Journey origin.
 * @param {Object} destination - Journey destination.
 * @param {'transit'|'walking'} mode - Supported Google Maps travel mode.
 * @returns {string} Safe HTTPS Google Maps directions URL.
 */
export function googleMapsDirectionsUrl(origin, destination, mode) {
  if (!ALLOWED_MODES.has(mode)) {
    throw new TypeError('Directions mode must be transit or walking');
  }

  const url = new URL(GOOGLE_MAPS_DIRECTIONS_URL);
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', formatPosition(origin));
  url.searchParams.set('destination', formatPosition(destination));
  url.searchParams.set('travelmode', mode);
  return url.toString();
}
