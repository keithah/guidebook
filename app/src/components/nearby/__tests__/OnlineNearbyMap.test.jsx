import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { lineColors, lineLabel } from '../../../theme.js';

const fitBoundsMock = vi.hoisted(() => vi.fn());

vi.mock('leaflet', () => ({
  default: {
    // Return the icon options as-is so tests can inspect className/html/size.
    divIcon: (options) => options,
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center, zoom, scrollWheelZoom }) => (
    <div
      data-testid="map-container"
      data-center={JSON.stringify(center)}
      data-zoom={zoom}
      data-scroll-wheel-zoom={String(scrollWheelZoom)}
    >
      {children}
    </div>
  ),
  TileLayer: ({ attribution, url, eventHandlers }) => (
    <div data-testid="tile-layer" data-attribution={attribution} data-url={url}>
      <button
        type="button"
        onClick={(event) => eventHandlers?.tileerror?.(event)}
      >
        trigger tile error
      </button>
    </div>
  ),
  Marker: ({ position, icon, children }) => (
    <div
      data-testid="marker"
      data-position={JSON.stringify(position)}
      data-icon-class={icon?.className}
      data-icon-html={icon?.html}
    >
      {children}
    </div>
  ),
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({ fitBounds: fitBoundsMock }),
}));

const { default: OnlineNearbyMap } = await import('../OnlineNearbyMap.jsx');

const cottage = { lat: 37.7226, lng: -122.4547 };
const center = { lat: 37.723, lng: -122.455 };

function stopMarkers() {
  return screen
    .getAllByTestId('marker')
    .filter((marker) => marker.dataset.iconClass === 'sfc-line-pin');
}

afterEach(cleanup);

describe('OnlineNearbyMap', () => {
  it('centers the map on the current location with scroll-wheel zoom disabled', () => {
    render(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={[]}
        showMe={false}
      />,
    );

    const mapContainer = screen.getByTestId('map-container');
    expect(JSON.parse(mapContainer.dataset.center)).toEqual([
      center.lat,
      center.lng,
    ]);
    expect(mapContainer.dataset.zoom).toBe('15');
    expect(mapContainer.dataset.scrollWheelZoom).toBe('false');
  });

  it('wires the OpenStreetMap tile layer and forwards tile failures', () => {
    const onTileFailure = vi.fn();
    render(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={[]}
        showMe={false}
        onTileFailure={onTileFailure}
      />,
    );

    const tileLayer = screen.getByTestId('tile-layer');
    expect(tileLayer.dataset.url).toBe(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    expect(tileLayer.dataset.attribution).toContain('OpenStreetMap');

    fireEvent.click(within(tileLayer).getByRole('button'));
    expect(onTileFailure).toHaveBeenCalledTimes(1);
  });

  it('always shows the cottage marker and adds the "you are here" marker only when requested', () => {
    const { rerender } = render(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={[]}
        showMe={false}
      />,
    );

    const initialMarkers = screen.getAllByTestId('marker');
    expect(initialMarkers).toHaveLength(1);
    expect(initialMarkers[0].dataset.iconClass).toBe('sfc-home-pin');
    expect(JSON.parse(initialMarkers[0].dataset.position)).toEqual([
      cottage.lat,
      cottage.lng,
    ]);
    expect(within(initialMarkers[0]).getByTestId('popup')).toHaveTextContent(
      'The SF Cottage',
    );

    rerender(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={[]}
        showMe
      />,
    );

    const markersWithMe = screen.getAllByTestId('marker');
    expect(markersWithMe).toHaveLength(2);
    const meMarker = markersWithMe.find(
      (marker) => marker.dataset.iconClass === 'sfc-me-pin',
    );
    expect(meMarker).toBeDefined();
    expect(JSON.parse(meMarker.dataset.position)).toEqual([
      center.lat,
      center.lng,
    ]);
    expect(within(meMarker).getByTestId('popup')).toHaveTextContent(
      'You are here',
    );
  });

  it('renders one marker per stop with a line-colored, labeled icon and a name/sub popup', () => {
    const stops = [
      {
        name: 'West Portal Station',
        sub: 'Inbound platform',
        lat: 37.74,
        lng: -122.466,
        line: 'K',
      },
      {
        name: 'Embarcadero BART',
        sub: 'Southbound',
        lat: 37.793,
        lng: -122.397,
        line: 'BART',
      },
      {
        name: 'Some Curb Stop',
        sub: 'Route 99',
        lat: 37.7,
        lng: -122.4,
        line: 'ZZ',
      },
    ];

    render(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={stops}
        showMe={false}
      />,
    );

    const markers = stopMarkers();
    expect(markers).toHaveLength(3);

    markers.forEach((marker, index) => {
      const stop = stops[index];
      expect(JSON.parse(marker.dataset.position)).toEqual([
        stop.lat,
        stop.lng,
      ]);
      expect(marker.dataset.iconHtml).toContain(lineLabel(stop.line));
      expect(within(marker).getByTestId('popup')).toHaveTextContent(
        `${stop.name}${stop.sub}`,
      );
    });

    expect(markers[0].dataset.iconHtml).toContain(lineColors.K);
    expect(markers[1].dataset.iconHtml).toContain(lineColors.BART);
    // A line with no configured color falls back to the default gray.
    expect(markers[2].dataset.iconHtml).toContain('#5A6B65');
  });

  it('omits the destination marker and never fits bounds when there is no destination', () => {
    render(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={[]}
        showMe={false}
        dest={null}
      />,
    );

    expect(
      screen
        .getAllByTestId('marker')
        .some((marker) => marker.dataset.iconClass === 'sfc-dest-pin'),
    ).toBe(false);
    expect(fitBoundsMock).not.toHaveBeenCalled();
  });

  it('shows a destination marker and fits the map bounds, recalculating when the destination changes', () => {
    const dest = { lat: 37.79, lng: -122.4, name: 'Union Square' };
    const { rerender } = render(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={[]}
        showMe={false}
        dest={dest}
      />,
    );

    const destMarker = screen
      .getAllByTestId('marker')
      .find((marker) => marker.dataset.iconClass === 'sfc-dest-pin');
    expect(destMarker).toBeDefined();
    expect(JSON.parse(destMarker.dataset.position)).toEqual([
      dest.lat,
      dest.lng,
    ]);
    expect(within(destMarker).getByTestId('popup')).toHaveTextContent(
      'Union Square',
    );
    expect(fitBoundsMock).toHaveBeenCalledWith(
      [
        [center.lat, center.lng],
        [dest.lat, dest.lng],
      ],
      { padding: [30, 30] },
    );

    fitBoundsMock.mockClear();
    const newDest = { lat: 37.8, lng: -122.41, name: 'Ferry Building' };
    rerender(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={[]}
        showMe={false}
        dest={newDest}
      />,
    );

    expect(fitBoundsMock).toHaveBeenCalledWith(
      [
        [center.lat, center.lng],
        [newDest.lat, newDest.lng],
      ],
      { padding: [30, 30] },
    );
  });
});