import muniLogoUrl from '../assets/muni-logo.png';

/**
 * Render the Muni wordmark at a requested height.
 * @param {Object} props - Logo properties.
 * @param {number} [props.height=14] - Rendered logo height in pixels.
 * @param {boolean} [props.decorative=false] - Whether assistive technology should ignore the logo.
 * @returns {JSX.Element} The Muni logo image.
 */
export default function MuniLogo({ height = 14, decorative = false }) {
  return (
    <img
      src={muniLogoUrl}
      alt={decorative ? '' : 'Muni'}
      aria-hidden={decorative ? 'true' : undefined}
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
}
