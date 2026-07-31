const MUNI_AGENCY = /\b(SF|SFMTA|MUNI|SAN FRANCISCO MUNICIPAL)\b/i;
const BART_AGENCY = /\b(BART|BAY AREA RAPID TRANSIT)\b/i;
const RAIL_MODES = new Set(['lightrail', 'metro', 'subway', 'tram', 'train', 'rail']);
const BUS_MODES = new Set(['bus', 'busrapid', 'privatebus']);
const BART_COLORS = {
  BLUE: '#009BDA', YELLOW: '#F9DF3A', RED: '#ED1C24',
  GREEN: '#4DB848', ORANGE: '#F7931D',
};

/**
 * Normalize a provider value into trimmed text.
 * @param {*} value - Provider value.
 * @returns {string} Trimmed text.
 */
const token = (value) => String(value ?? '').trim();

/**
 * Normalize a transit mode for conservative comparisons.
 * @param {*} value - Provider transit mode.
 * @returns {string} Lowercase mode without separators.
 */
const modeToken = (value) => token(value).replace(/[-_\s]/g, '').toLowerCase();

/**
 * Accept only full six-digit hexadecimal transit colors.
 * @param {*} value - Provider color value.
 * @param {string} [fallback='#5A6B65'] - Color returned for invalid input.
 * @returns {string} Safe color value.
 */
export function safeTransitColor(value, fallback = '#5A6B65') {
  return /^#[0-9a-f]{6}$/i.test(token(value)) ? token(value) : fallback;
}

/**
 * Calculate the WCAG relative luminance of a six-digit hex color.
 * @param {string} color - Six-digit hexadecimal color.
 * @returns {number} Relative luminance.
 */
function relativeLuminance(color) {
  const channels = color
    .slice(1)
    .match(/.{2}/g)
    .map((hex) => Number.parseInt(hex, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/**
 * Calculate the WCAG contrast ratio between two colors.
 * @param {string} first - First six-digit hexadecimal color.
 * @param {string} second - Second six-digit hexadecimal color.
 * @returns {number} Contrast ratio.
 */
function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Choose a contrast-safe foreground for a transit line background.
 * @param {string} background - Safe line background color.
 * @param {*} providerColor - Optional provider foreground color.
 * @returns {string} Contrast-safe foreground color.
 */
function readableForeground(background, providerColor) {
  const safeProviderColor = safeTransitColor(providerColor, '');
  if (
    safeProviderColor &&
    contrastRatio(background, safeProviderColor) >= 4.5
  ) {
    return safeProviderColor;
  }

  return contrastRatio(background, '#000000') >=
    contrastRatio(background, '#FFFFFF')
    ? '#000000'
    : '#FFFFFF';
}

/**
 * Classify a normalized transit section into operator, vehicle, and colors.
 * @param {Object} section - Normalized transit section.
 * @returns {Object} Display identity for the transit leg.
 */
export function classifyTransitLeg(section) {
  const agencyText = [section?.agency?.id, section?.agency?.name].filter(Boolean).join(' ');
  const transport = section?.transport ?? {};
  const lineLabel = token(transport.shortName || transport.name || '?');
  const mode = modeToken(transport.mode);
  const isMuni = MUNI_AGENCY.test(agencyText);
  const isBart = BART_AGENCY.test(agencyText);
  const fallbackBus = isMuni && /^\d/.test(lineLabel);
  const vehicle = isBart || RAIL_MODES.has(mode)
    ? 'train'
    : BUS_MODES.has(mode) || fallbackBus
      ? 'bus'
      : 'transit';
  const operator = isMuni ? 'muni' : isBart ? 'bart' : 'other';
  const operatorLabel = isMuni ? 'Muni' : isBart ? 'BART' : token(section?.agency?.name || section?.agency?.id || 'Transit');
  const fallback = isBart ? BART_COLORS[lineLabel.toUpperCase()] || '#0077C0' : '#5A6B65';
  const color = safeTransitColor(transport.color, fallback);
  const foreground = readableForeground(color, transport.textColor);
  const vehicleLabel = vehicle === 'train' ? 'train' : vehicle === 'bus' ? 'bus' : 'transit';
  return {
    operator, operatorLabel, vehicle, vehicleLabel, lineLabel, color, foreground,
    accessibleLabel: `${operatorLabel} ${lineLabel} ${vehicleLabel}`,
  };
}
