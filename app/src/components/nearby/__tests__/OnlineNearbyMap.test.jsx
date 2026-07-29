import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import L from 'leaflet';
import OnlineNearbyMap from '../OnlineNearbyMap.jsx';

const { mockMap } = vi.hoisted(() => ({
  mockMap: { fitBounds: vi.fn() },
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn((options) => ({ __mockIcon: true, ...options })),
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
  TileLayer: ({ url, eventHandlers }) => (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      data-testid="tile-layer"
      data-url={url}
      onClick={() => eventHandlers?.tileerror?.()}
    />
  ),
  Marker: ({ position, icon, children }) => (
    <div
      data-testid="marker"
      data-position={JSON.stringify(position)}
      data-icon-class={icon?.className}
    >
      {children}
    </div>
  ),
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  useMap: () => mockMap,
}));

const center = { lat: 37.7226, lng: -122.4547 };
const cottage = { lat: 37.7226, lng: -122.4547 };

afterEach(cleanup);

describe('OnlineNearbyMap', () => {
  it('renders the map centered on the current position and wires tile failures to the handler', () => {
    const onTileFailure = vi.fn();
    render(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={[]}
        showMe={false}
        dest={null}
        onTileFailure={onTileFailure}
      />,
    );

    expect(screen.getByTestId('map-container')).toHaveAttribute(
      'data-center',
      JSON.stringify([center.lat, center.lng]),
    );

    const tileLayer = screen.getByTestId('tile-layer');
    expect(tileLayer).toHaveAttribute(
      'data-url',
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    fireEvent.click(tileLayer);
    expect(onTileFailure).toHaveBeenCalledTimes(1);

    expect(screen.getByText('The SF Cottage')).toBeVisible();
    expect(screen.queryByText('You are here')).not.toBeInTheDocument();
  });

  it('shows a "me" marker only when showMe is true', () => {
    const { rerender } = render(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={[]}
        showMe={false}
        dest={null}
        onTileFailure={vi.fn()}
      />,
    );
    expect(screen.queryByText('You are here')).not.toBeInTheDocument();

    rerender(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={[]}
        showMe
        dest={null}
        onTileFailure={vi.fn()}
      />,
    );
    expect(screen.getByText('You are here')).toBeVisible();
  });

  it('renders one line-colored marker per stop', () => {
    const stops = [
      {
        name: 'Forest Hill Station',
        sub: 'Platform 2',
        lat: 37.7482,
        lng: -122.4583,
        line: 'K',
      },
      {
        name: 'Church Street Station',
        sub: 'Inbound',
        lat: 37.7671,
        lng: -122.4291,
        line: 'N',
      },
    ];

    render(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={stops}
        showMe={false}
        dest={null}
        onTileFailure={vi.fn()}
      />,
    );

    const linePinCalls = L.divIcon.mock.calls.filter(
      ([options]) => options.className === 'sfc-line-pin',
    );
    expect(linePinCalls).toHaveLength(stops.length);

    const markers = screen
      .getAllByTestId('marker')
      .filter((marker) => marker.dataset.iconClass === 'sfc-line-pin');
    expect(markers.map((marker) => marker.dataset.position)).toEqual(
      stops.map((stop) => JSON.stringify([stop.lat, stop.lng])),
    );
    expect(markers[0]).toHaveTextContent('Forest Hill Station');
    expect(markers[0]).toHaveTextContent('Platform 2');
    expect(markers[1]).toHaveTextContent('Church Street Station');
    expect(markers[1]).toHaveTextContent('Inbound');
  });

  it('shows a destination marker and fits the map bounds only when a destination is set', () => {
    const dest = { lat: 37.7879, lng: -122.4075, name: 'Union Square' };
    const { rerender } = render(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={[]}
        showMe={false}
        dest={null}
        onTileFailure={vi.fn()}
      />,
    );
    expect(screen.queryByText('Union Square')).not.toBeInTheDocument();
    expect(mockMap.fitBounds).not.toHaveBeenCalled();

    rerender(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={[]}
        showMe={false}
        dest={dest}
        onTileFailure={vi.fn()}
      />,
    );

    expect(screen.getByText('Union Square')).toBeVisible();
    expect(mockMap.fitBounds).toHaveBeenCalledWith(
      [
        [center.lat, center.lng],
        [dest.lat, dest.lng],
      ],
      { padding: [30, 30] },
    );
  });
});