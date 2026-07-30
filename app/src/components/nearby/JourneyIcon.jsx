const iconPaths = {
  bus: [
    <path key="body" d="M6 3h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />,
    <path key="window" d="M7 6h10v5H7zM7 15h2M15 15h2M7 18v3M17 18v3" />,
  ],
  train: [
    <path key="body" d="M7 3h10a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z" />,
    <path key="window" d="M8 6h8v5H8zM8 15h2M14 15h2M8 19l-2 2M16 19l2 2" />,
  ],
  walk: [
    <path key="head" d="M12 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />,
    <path key="body" d="m10 7 3-1 2 3 3 2M13 6l-1 6 4 3 1 6M12 12l-3 3-2 5" />,
  ],
  car: [
    <path key="body" d="m5 10 2-5h10l2 5 2 2v6h-3v-2H6v2H3v-6l2-2Z" />,
    <path key="detail" d="M6 10h12M7 13h2M15 13h2" />,
  ],
  transit: [
    <path key="circle" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" />,
    <path key="arrows" d="m8 9 4-3 4 3M16 15l-4 3-4-3M12 6v12" />,
  ],
};

/**
 * Render a decorative icon for a journey vehicle or walking leg.
 * @param {{ type: 'bus'|'train'|'walk'|'car'|'transit' }} props - Icon type.
 * @returns {JSX.Element} A decorative 24-by-24 SVG.
 */
export default function JourneyIcon({ type }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[type] ?? iconPaths.transit}
    </svg>
  );
}
