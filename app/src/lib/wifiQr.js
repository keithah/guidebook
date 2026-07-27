// Standard WIFI: URI scheme QR payload — recognized by iOS/Android camera
// apps as "join this network" without a companion app.
export function wifiQrPayload({ ssid, password, hidden = false }) {
  const esc = (s) => String(s).replace(/([\\;,:"])/g, '\\$1');
  return `WIFI:T:WPA;S:${esc(ssid)};P:${esc(password)};H:${hidden ? 'true' : 'false'};;`;
}
