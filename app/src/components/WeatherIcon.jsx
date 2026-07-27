import { colors } from '../theme.js';

// Sun-over-fog glyph from the Fog mockup — a warm sun with cool fog lines
// underneath, reused everywhere weather shows up (home cards, arrival day).
export default function WeatherIcon({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46">
      <circle cx="26" cy="16" r="9" fill={colors.sun} />
      <path d="M6 26h30M11 32h28M6 38h24" stroke={colors.faint} strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
