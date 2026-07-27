import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { colors } from '../theme.js';

export default function QrImage({ text, size = 230 }) {
  const [dataUrl, setDataUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(text, { width: size * 2, margin: 1, color: { dark: '#14201D', light: '#FFFFFF' } })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [text, size]);

  return (
    <div style={{ width: size, maxWidth: '100%', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {dataUrl ? (
        <img src={dataUrl} alt="WiFi QR code" style={{ width: '100%', height: '100%', display: 'block' }} />
      ) : (
        <div style={{ fontSize: 11, color: colors.muted }}>Generating code…</div>
      )}
    </div>
  );
}
