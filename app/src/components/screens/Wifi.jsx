import { useApp } from '../../context/AppContext.jsx';
import { colors, fonts, screenPad, backLink, tip } from '../../theme.js';
import QrImage from '../QrImage.jsx';
import { wifiQrPayload } from '../../lib/wifiQr.js';

export default function Wifi() {
  const { property, goTab, wifiCopied, wifiJoining, copyWifiPassword, joinWifi } = useApp();
  const { network, password, speed, troubleshoot } = property.wifi;

  return (
    <div style={screenPad}>
      <div onClick={goTab('home')} style={backLink}>
        ← Home
      </div>
      <div style={{ fontFamily: fonts.serif, fontSize: 32, lineHeight: 1.1 }}>WiFi</div>
      <div style={{ fontSize: 14, color: colors.mutedText, lineHeight: 1.6 }}>
        {speed}, and it reaches the courtyard. Point your camera at the code — or just tap the button.
      </div>
      <div style={{ background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <QrImage text={wifiQrPayload({ ssid: network, password })} />
        <div
          onClick={joinWifi}
          style={{
            cursor: 'pointer',
            width: '100%',
            boxSizing: 'border-box',
            background: colors.teal,
            color: '#F2F7F5',
            borderRadius: 999,
            padding: 13,
            textAlign: 'center',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {wifiJoining ? `Joining ${network}…` : 'Join this network'}
        </div>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '11px 0', borderTop: `1px solid ${colors.borderSoft}` }}>
            <span style={{ fontSize: 13, color: colors.muted }}>Network</span>
            <span style={{ fontFamily: fonts.serif, fontSize: 20 }}>{network}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '11px 0', borderTop: `1px solid ${colors.borderSoft}` }}>
            <span style={{ fontSize: 13, color: colors.muted }}>Password</span>
            <span style={{ fontFamily: fonts.serif, fontSize: 20 }}>{password}</span>
          </div>
        </div>
        <div onClick={copyWifiPassword} style={{ cursor: 'pointer', fontSize: 13, color: wifiCopied ? colors.teal : colors.muted, fontWeight: 600 }}>
          {wifiCopied ? 'Password copied ✓' : 'Copy password'}
        </div>
      </div>
      <div style={tip}>{troubleshoot}</div>
    </div>
  );
}
