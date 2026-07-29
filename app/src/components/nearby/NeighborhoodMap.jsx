import { useEffect, useState } from 'react';
import OnlineNearbyMap from './OnlineNearbyMap.jsx';

function OfflineNeighborhoodMap() {
  return (
    <figure className="offline-neighborhood-map">
      <img
        src={`${import.meta.env.BASE_URL}images/ingleside-neighborhood.svg`}
        alt="Offline neighborhood map around The SF Cottage in Ingleside"
      />
      <figcaption>
        Offline orientation map · ©{' '}
        <a href="https://www.openstreetmap.org/copyright">
          OpenStreetMap contributors
        </a>
      </figcaption>
    </figure>
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
