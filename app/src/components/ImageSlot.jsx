import { useCallback, useRef, useState } from 'react';
import { getStoredImage, storeImageFile, clearStoredImage } from '../lib/imageStore.js';
import { colors } from '../theme.js';

const ACCEPT = 'image/png,image/jpeg,image/webp';

export default function ImageSlot({ id, placeholder = 'Drop an image', radius = 18, style }) {
  const [src, setSrc] = useState(() => getStoredImage(id));
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const ingest = useCallback(
    async (file) => {
      if (!file || !ACCEPT.includes(file.type)) {
        setError('Drop a PNG, JPEG, or WebP image.');
        setTimeout(() => setError(null), 2500);
        return;
      }
      try {
        const dataUrl = await storeImageFile(id, file);
        setSrc(dataUrl);
      } catch (err) {
        setError(err.message || 'Could not save that photo.');
        setTimeout(() => setError(null), 2500);
      }
    },
    [id]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) ingest(file);
  };

  const clear = (e) => {
    e.stopPropagation();
    clearStoredImage(id);
    setSrc(null);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current && inputRef.current.click()}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: radius,
        overflow: 'hidden',
        cursor: 'pointer',
        background: src ? 'transparent' : 'rgba(20,32,29,.04)',
        border: dragOver ? `1.5px dashed ${colors.teal}` : src ? 'none' : `1.5px dashed ${colors.borderDashed}`,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          if (file) ingest(file);
          e.target.value = '';
        }}
      />
      {src ? (
        <>
          <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <button
            type="button"
            onClick={clear}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              border: 0,
              borderRadius: 6,
              padding: '5px 10px',
              background: 'rgba(0,0,0,.6)',
              color: '#fff',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Replace
          </button>
        </>
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            textAlign: 'center',
            padding: 10,
            color: colors.muted,
            fontSize: 12,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          <div>{placeholder}</div>
          <div style={{ textDecoration: 'underline' }}>tap to add a photo</div>
        </div>
      )}
      {error && (
        <div
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            bottom: 8,
            background: 'rgba(255,255,255,.9)',
            color: '#b3261e',
            fontSize: 11,
            padding: '4px 6px',
            borderRadius: 5,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
