import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn((opts) => opts),
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center, zoom }) => (
    <div
      data-testid="map-container"
      data-center={JSON.stringify(center)}
      data-zoom={zoom}
    >
      {children}
    </div>
  ),
  TileLayer: ({ url, attribution, eventHandlers }) => (
    <div data-testid="tile-layer" data-url={url} data-attribution={attribution}>
      <button
        type="button"
        onClick={() => eventHandlers?.tileerror?.()}
      >
        Simulate tile error
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
  useMap: vi.fn(),
}));

import { useMap } from 'react-leaflet';
import OnlineNearbyMap from '../OnlineNearbyMap.jsx';

const center = { lat: 37.75, lng: -122.44 };
const cottage = { lat: 37.751, lng: -122.441 };
const stops = [
  { name: 'Church St & 22nd', sub: 'Muni K, inbound', lat: 37.752, lng: -122.43, line: 'K' },
  { name: 'Balboa Park BART', sub: 'BART', lat: 37.72, lng: -122.447, line: 'BART' },
  { name: 'Some Bus Stop', sub: 'Route 29', lat: 37.73, lng: -122.4, line: 'BUS' },
  { name: 'Unmapped line', sub: 'Mystery', lat: 37.74, lng: -122.41, line: 'ZZZ' },
];

function getMarkers() {
  return screen.getAllByTestId('marker');
}

afterEach(() => {
  cleanup();
  vi.mocked(useMap).mockReset();
});

describe('OnlineNearbyMap', () => {
  it('renders the tile layer with attribution/url and forwards tile errors', () => {
    useMap.mockReturnValue({ fitBounds: vi.fn() });
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

    const tileLayer = screen.getByTestId('tile-layer');
    expect(tileLayer).toHaveAttribute(
      'data-url',
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    expect(tileLayer.getAttribute('data-attribution')).toMatch(
      /openstreetmap/i,
    );

    fireEvent.click(
      within(tileLayer).getByRole('button', { name: /simulate tile error/i }),
    );
    expect(onTileFailure).toHaveBeenCalledTimes(1);
  });

  it('always renders a home marker for the cottage', () => {
    useMap.mockReturnValue({ fitBounds: vi.fn() });
    render(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={[]}
        showMe={false}
        dest={null}
        onTileFailure={vi.fn()}
      />,
    );

    const markers = getMarkers();
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveAttribute(
      'data-position',
      JSON.stringify([cottage.lat, cottage.lng]),
    );
    expect(markers[0]).toHaveAttribute('data-icon-class', 'sfc-home-pin');
    expect(within(markers[0]).getByTestId('popup')).toHaveTextContent(
      'The SF Cottage',
    );
  });

  it('renders a "you are here" marker only when showMe is true', () => {
    useMap.mockReturnValue({ fitBounds: vi.fn() });
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
    expect(getMarkers()).toHaveLength(1);

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
    const markers = getMarkers();
    expect(markers).toHaveLength(2);
    const meMarker = markers.find(
      (m) => m.getAttribute('data-icon-class') === 'sfc-me-pin',
    );
    expect(meMarker).toBeTruthy();
    expect(meMarker).toHaveAttribute(
      'data-position',
      JSON.stringify([center.lat, center.lng]),
    );
    expect(within(meMarker).getByTestId('popup')).toHaveTextContent(
      'You are here',
    );
  });

  it('adds a stay location label when the user and cottage positions match', () => {
    useMap.mockReturnValue({ fitBounds: vi.fn() });
    render(
      <OnlineNearbyMap
        center={cottage}
        cottage={cottage}
        stops={[]}
        showMe
        locationLabel="1620 Howard St, San Francisco"
        dest={null}
        onTileFailure={vi.fn()}
      />,
    );

    const meMarker = getMarkers().find(
      (marker) => marker.getAttribute('data-icon-class') === 'sfc-me-pin',
    );
    expect(within(meMarker).getByTestId('popup')).toHaveTextContent(
      'You are here · 1620 Howard St, San Francisco',
    );
  });

  it('renders a marker per stop with a colored line pin and name/sub popup', () => {
    useMap.mockReturnValue({ fitBounds: vi.fn() });
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

    const markers = getMarkers();
    // one home marker + one per stop
    expect(markers).toHaveLength(1 + stops.length);

    const stopMarkers = markers.filter(
      (m) => m.getAttribute('data-icon-class') === 'sfc-line-pin',
    );
    expect(stopMarkers).toHaveLength(stops.length);

    const kMarker = stopMarkers[0];
    expect(kMarker).toHaveAttribute(
      'data-position',
      JSON.stringify([stops[0].lat, stops[0].lng]),
    );
    expect(kMarker.getAttribute('data-icon-html')).toContain('#569BBE'); // K line color
    expect(within(kMarker).getByTestId('popup')).toHaveTextContent(
      'Church St & 22nd',
    );
    expect(within(kMarker).getByTestId('popup')).toHaveTextContent(
      'Muni K, inbound',
    );

    const bartMarker = stopMarkers[1];
    expect(bartMarker.getAttribute('data-icon-html')).toContain('#0077C0');
    expect(bartMarker.getAttribute('data-icon-html')).toContain('bart-logo.svg');
    expect(bartMarker.getAttribute('data-icon-html')).not.toContain(
      ['>', 'ba', '<'].join(''),
    );

    const busMarker = stopMarkers[2];
    expect(busMarker.getAttribute('data-icon-html')).toContain('>29<');

    // Unknown lines fall back to the default gray pin color.
    const unknownMarker = stopMarkers[3];
    expect(unknownMarker.getAttribute('data-icon-html')).toContain('#5A6B65');
  });

  it('renders a destination marker only when dest is supplied', () => {
    useMap.mockReturnValue({ fitBounds: vi.fn() });
    const dest = { lat: 37.6188, lng: -122.3756, name: 'SFO' };
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
    expect(
      getMarkers().find(
        (m) => m.getAttribute('data-icon-class') === 'sfc-dest-pin',
      ),
    ).toBeUndefined();

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
    const destMarker = getMarkers().find(
      (m) => m.getAttribute('data-icon-class') === 'sfc-dest-pin',
    );
    expect(destMarker).toHaveAttribute(
      'data-position',
      JSON.stringify([dest.lat, dest.lng]),
    );
    expect(within(destMarker).getByTestId('popup')).toHaveTextContent('SFO');
  });

  it('fits the map bounds to center and dest once a destination is chosen', () => {
    const fitBounds = vi.fn();
    useMap.mockReturnValue({ fitBounds });
    const dest = { lat: 37.6188, lng: -122.3756, name: 'SFO' };

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
    expect(fitBounds).not.toHaveBeenCalled();

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
    expect(fitBounds).toHaveBeenCalledWith(
      [
        [center.lat, center.lng],
        [dest.lat, dest.lng],
      ],
      { padding: [30, 30] },
    );
  });

  it('moves the viewport when the active center changes', () => {
    const panTo = vi.fn();
    useMap.mockReturnValue({ fitBounds: vi.fn(), panTo });
    const montana = { lat: 46.8797, lng: -110.3626 };
    const howard = { lat: 37.77154, lng: -122.41761 };

    const { rerender } = render(
      <OnlineNearbyMap
        center={montana}
        cottage={cottage}
        stops={[]}
        showMe
        dest={null}
        onTileFailure={vi.fn()}
      />,
    );
    expect(panTo).not.toHaveBeenCalled();

    rerender(
      <OnlineNearbyMap
        center={howard}
        cottage={cottage}
        stops={[]}
        showMe
        dest={null}
        onTileFailure={vi.fn()}
      />,
    );
    expect(panTo).toHaveBeenCalledOnce();
    expect(panTo).toHaveBeenCalledWith(
      [37.77154, -122.41761],
      { animate: false },
    );
  });

  it('keeps destination bounds in control when the active center changes', () => {
    const fitBounds = vi.fn();
    const panTo = vi.fn();
    useMap.mockReturnValue({ fitBounds, panTo });
    const dest = { lat: 37.6188, lng: -122.3756, name: 'SFO' };
    const howard = { lat: 37.77154, lng: -122.41761 };

    const { rerender } = render(
      <OnlineNearbyMap
        center={center}
        cottage={cottage}
        stops={[]}
        showMe
        dest={dest}
        onTileFailure={vi.fn()}
      />,
    );
    fitBounds.mockClear();

    rerender(
      <OnlineNearbyMap
        center={howard}
        cottage={cottage}
        stops={[]}
        showMe
        dest={dest}
        onTileFailure={vi.fn()}
      />,
    );

    expect(fitBounds).toHaveBeenCalledOnce();
    expect(fitBounds).toHaveBeenCalledWith(
      [
        [37.77154, -122.41761],
        [37.6188, -122.3756],
      ],
      { padding: [30, 30] },
    );
    expect(panTo).not.toHaveBeenCalled();
  });
});
