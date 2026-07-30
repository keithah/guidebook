import muniLogoUrl from '../assets/muni-logo.png';

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
