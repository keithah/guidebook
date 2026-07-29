import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import OnlineNearbyMap from './OnlineNearbyMap.jsx';

function OfflineNeighborhoodFigure({ expanded, onToggle, buttonRef }) {
  return (
    <figure className="offline-neighborhood-map">
      <img
        src={`${import.meta.env.BASE_URL}images/ingleside-neighborhood.svg`}
        alt="Offline neighborhood map around The SF Cottage in Ingleside"
        style={{ objectFit: 'contain' }}
      />
      <button
        ref={buttonRef}
        type="button"
        className="offline-neighborhood-map-toggle"
        aria-expanded={expanded}
        onClick={onToggle}
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
  );
}

function trapModalFocus(event) {
  if (event.key !== 'Tab') return;

  const dialog = event.currentTarget;
  const focusable = [
    ...dialog.querySelectorAll('button:not([disabled]), a[href]'),
  ];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;

  if (
    event.shiftKey &&
    (document.activeElement === first ||
      !dialog.contains(document.activeElement))
  ) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    (document.activeElement === last ||
      !dialog.contains(document.activeElement))
  ) {
    event.preventDefault();
    first.focus();
  }
}

function OfflineNeighborhoodMap() {
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!expanded) return undefined;

    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    closeButtonRef.current?.focus();
    const backgroundElements = [...document.body.children]
      .filter((element) => element !== dialog)
      .map((element) => ({
        element,
        hadInert: element.hasAttribute('inert'),
        ariaHidden: element.getAttribute('aria-hidden'),
      }));
    backgroundElements.forEach(({ element }) => {
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    });

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      backgroundElements.forEach(({ element, hadInert, ariaHidden }) => {
        if (!hadInert) element.removeAttribute('inert');
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
      queueMicrotask(() => trigger?.focus());
    };
  }, [expanded]);

  return (
    <>
      <div className="offline-neighborhood-map-frame">
        <OfflineNeighborhoodFigure
          expanded={false}
          onToggle={() => setExpanded(true)}
          buttonRef={triggerRef}
        />
      </div>
      {expanded &&
        createPortal(
          <div
            ref={dialogRef}
            className="offline-neighborhood-map-frame expanded"
            role="dialog"
            aria-modal="true"
            aria-label="Full offline neighborhood map"
            onKeyDown={trapModalFocus}
          >
            <OfflineNeighborhoodFigure
              expanded
              onToggle={() => setExpanded(false)}
              buttonRef={closeButtonRef}
            />
          </div>,
          document.body,
        )}
    </>
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
