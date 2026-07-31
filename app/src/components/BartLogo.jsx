import bartLogoUrl from '../assets/bart-logo.svg';

export default function BartLogo({ height = 18, decorative = false }) {
  return (
    <img
      src={bartLogoUrl}
      alt={decorative ? '' : 'BART'}
      aria-hidden={decorative ? 'true' : undefined}
      style={{ display: 'block', width: 'auto', height }}
    />
  );
}
