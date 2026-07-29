import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import OnlineNearbyMap from './OnlineNearbyMap.jsx';

const TILE_FAILURE_THRESHOLD = 3;
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Render the offline neighborhood map and a control for expanding it.
 * @param {boolean} expanded - Whether the full offline map is displayed.
 * @param {Function} onToggle - Handles toggling the map's expanded state.
 * @param {object} buttonRef - Ref assigned to the toggle button.
 */
function OfflineNeighborhoodFigure({ expanded, onToggle, buttonRef }) {
  return (
    <figure className="offline-neighborhood-map">
      <img
        src={`${import.meta.env.BASE_URL}images/ingleside-neighborhood.svg`}
        alt="Offline neighborhood map around The SF Cottage in Ingleside"
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

/**
 * Keeps keyboard focus within the modal while navigating with the Tab key.
 * @param {KeyboardEvent} event - The keyboard event from the modal container.
 */
function trapModalFocus(event) {
  if (event.key !== 'Tab') return;

  const dialog = event.currentTarget;
  const focusable = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)];
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

/**
 * Render an offline neighborhood map with an optional live-map retry action and an expandable modal view.
 * @param {Function} [onRetry] - Callback invoked to retry loading the live map.
 * @return {JSX.Element} The offline neighborhood map interface.
 */
function OfflineNeighborhoodMap({ onRetry }) {
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!expanded) return undefined;

    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
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
      document.body.style.overflow = previousBodyOverflow;
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
        {onRetry && (
          <button
            type="button"
            className="offline-neighborhood-map-retry"
            onClick={onRetry}
          >
            Retry live map
          </button>
        )}
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

/**
 * Displays the online neighborhood map or an offline fallback based on connectivity and tile failures.
 * @return {JSX.Element} The online map or offline neighborhood map interface.
 */
export default function NeighborhoodMap(props) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [tileFailureCount, setTileFailureCount] = useState(0);

  useEffect(() => {
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => {
      setTileFailureCount(0);
      setIsOnline(true);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const tileFailed = tileFailureCount >= TILE_FAILURE_THRESHOLD;
  if (!isOnline || tileFailed) {
    return (
      <OfflineNeighborhoodMap
        onRetry={isOnline ? () => setTileFailureCount(0) : undefined}
      />
    );
  }

  return (
    <OnlineNearbyMap
      {...props}
      onTileFailure={() => setTileFailureCount((count) => count + 1)}
    />
  );
}
