import { useEffect, useState } from 'react';
import OnlineNearbyMap from './OnlineNearbyMap.jsx';

function OfflineNeighborhoodMap() {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [expanded]);

  return (
    <div
      className={`offline-neighborhood-map-frame${expanded ? ' expanded' : ''}`}
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded ? 'true' : undefined}
      aria-label={expanded ? 'Full offline neighborhood map' : undefined}
    >
      <figure className="offline-neighborhood-map">
        <img
          src={`${import.meta.env.BASE_URL}images/ingleside-neighborhood.svg`}
          alt="Offline neighborhood map around The SF Cottage in Ingleside"
          style={{ objectFit: 'contain' }}
        />
        <button
          type="button"
          className="offline-neighborhood-map-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Close full offline map' : 'View full offline map'}
        </button>
        <figcaption>
          Offline orientation map · ©{' '}
          <a href="https://www.openstreetmap.org/copyright">
            OpenStreetMap contributors
          </a>
        </figcaption>
      </figure>
    </div>
  );
}

export default function NeighborhoodMap(props) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [tileFailed, setTileFailed] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => {
      setTileFailed(false);
      setIsOnline(true);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOnline || tileFailed) {
    return <OfflineNeighborhoodMap />;
  }

  return <OnlineNearbyMap {...props} onTileFailure={() => setTileFailed(true)} />;
}
