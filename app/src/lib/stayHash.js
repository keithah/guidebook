// Per-stay guest links: /sfcottage#<hash>
//
// The product spec (uploads/SPEC.md) defines the hash as carrying stay data
// "injected via an airbnb.com scraping pipeline, defined later" — that
// pipeline doesn't exist yet. This module is the CONSUMING half of that
// contract: whatever writes real hashes later just needs to produce the same
// base64url(JSON) shape decoded here.
//
// Payload shape:
//   { guestName: string, checkin: 'YYYY-MM-DD', checkout: 'YYYY-MM-DD', code?: string, notes?: string[] }

function base64UrlEncode(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return decodeURIComponent(escape(atob(b64)));
}

export function encodeStay(payload) {
  return base64UrlEncode(JSON.stringify(payload));
}

export function decodeStayHash(hash) {
  const raw = (hash || '').replace(/^#/, '');
  if (!raw) return null;
  try {
    const json = base64UrlDecode(raw);
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') return null;
    if (typeof data.guestName !== 'string' || !data.checkin || !data.checkout) return null;
    return data;
  } catch {
    return null;
  }
}

// Date-only comparison — a guest arriving or leaving today is 'during' for
// the whole day, not just before/after a specific hour.
export function computeStayPhase(checkinISO, checkoutISO, now = new Date()) {
  const day = (d) => {
    const dt = new Date(d + 'T00:00:00');
    return Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate());
  };
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const inDay = day(checkinISO);
  const outDay = day(checkoutISO);
  if (today < inDay) return 'before';
  if (today >= outDay) return 'checkout';
  return 'during';
}

export function readStayFromLocation(loc = window.location) {
  return decodeStayHash(loc.hash);
}
