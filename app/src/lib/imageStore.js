// Client-only persistence for guest-facing photo slots (cottage exterior,
// gate/door keypad closeups, ...). There's no backend, so a host fills these
// in once from whatever device they're using and it's stored as a resized
// data URL in localStorage — good enough for a single-property PWA, though a
// real deploy should eventually swap these for checked-in static assets.

const PREFIX = 'sfcottage:photo:';
const MAX_DIM = 1600;

export function getStoredImage(id) {
  try {
    return localStorage.getItem(PREFIX + id);
  } catch {
    return null;
  }
}

export function clearStoredImage(id) {
  try {
    localStorage.removeItem(PREFIX + id);
  } catch {
    /* ignore */
  }
}

export async function storeImageFile(id, file) {
  const dataUrl = await downscaleToDataUrl(file, MAX_DIM);
  try {
    localStorage.setItem(PREFIX + id, dataUrl);
  } catch {
    throw new Error('Could not save that photo (it may be too large for local storage).');
  }
  return dataUrl;
}

function downscaleToDataUrl(file, maxDim) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      img.onerror = () => reject(new Error('Could not decode that image.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
