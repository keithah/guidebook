import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { lineColors, lineLabel } from '../../theme.js';

function lineDivIcon(line, size = 30) {
  const bg = lineColors[line] || '#5A6B65';
  const label = lineLabel(line);
  const fontSize = label.length > 1 ? Math.round(size * 0.36) : Math.round(size * 0.5);
  return L.divIcon({
    className: 'sfc-line-pin',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font:${fontSize}px/1 'Instrument Sans',sans-serif;font-weight:700;box-shadow:0 2px 6px rgba(20,32,29,.35);border:2px solid #fff;">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function homeDivIcon() {
  return L.divIcon({
    className: 'sfc-home-pin',
    html: '<div style="width:22px;height:22px;border-radius:50%;background:#2C6D61;border:3px solid #fff;box-shadow:0 0 0 6px rgba(44,109,97,.18);"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function meDivIcon() {
  return L.divIcon({
    className: 'sfc-me-pin',
    html: '<div style="width:16px;height:16px;border-radius:50%;background:#14201D;border:3px solid #fff;box-shadow:0 0 0 5px rgba(20,32,29,.18);"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function destDivIcon() {
  return L.divIcon({
    className: 'sfc-dest-pin',
    html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#E8A03C;border:3px solid #fff;box-shadow:0 2px 6px rgba(20,32,29,.35);"></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 24],
  });
}

function FitToDest({ center, dest }) {
  const map = useMap();
  useEffect(() => {
    if (dest) {
      map.fitBounds(
        [
          [center.lat, center.lng],
          [dest.lat, dest.lng],
        ],
        { padding: [30, 30] },
      );
    }
  }, [map, center.lat, center.lng, dest?.lat, dest?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function OnlineNearbyMap({
  center,
  cottage,
  stops,
  showMe,
  dest,
  onTileFailure,
}) {
  const homeIcon = useMemo(() => homeDivIcon(), []);
  const meIcon = useMemo(() => meDivIcon(), []);
  const destIcon = useMemo(() => destDivIcon(), []);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{ tileerror: onTileFailure }}
      />
      <Marker position={[cottage.lat, cottage.lng]} icon={homeIcon}>
        <Popup>The SF Cottage</Popup>
      </Marker>
      {showMe && (
        <Marker position={[center.lat, center.lng]} icon={meIcon}>
          <Popup>You are here</Popup>
        </Marker>
      )}
      {stops.map((stop, index) => (
        <Marker
          key={`${stop.name}-${stop.sub}-${index}`}
          position={[stop.lat, stop.lng]}
          icon={lineDivIcon(stop.line)}
        >
          <Popup>
            {stop.name}
            <br />
            {stop.sub}
          </Popup>
        </Marker>
      ))}
      {dest && (
        <Marker position={[dest.lat, dest.lng]} icon={destIcon}>
          <Popup>{dest.name}</Popup>
        </Marker>
      )}
      <FitToDest center={center} dest={dest} />
    </MapContainer>
  );
}
