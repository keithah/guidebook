import muniLogoUrl from '../assets/muni-logo.png';

export default function MuniLogo({ height = 14 }) {
  return <img src={muniLogoUrl} alt="Muni" style={{ height, width: 'auto', display: 'block' }} />;
}
