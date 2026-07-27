// Color + line tokens lifted from the Fog direction mockup (Fog Guidebook.dc.html).
export const colors = {
  bg: '#EDF1EF',
  bgOuter: '#C9D2CE',
  ink: '#14201D',
  teal: '#2C6D61',
  tealText: '#25423B',
  muted: '#6E807B',
  mutedText: '#5C716B',
  border: '#DCE4E1',
  borderSoft: '#E4EBE8',
  borderDashed: '#C2CFCA',
  faint: '#9FB0AA',
  cream: '#FDF6E7',
  sage: '#DFE9E5',
  sageDeep: '#EAF1EC',
  sun: '#E8A03C',
  navBg: '#F6F8F7',
  white: '#FFFFFF',
  italicText: '#4A605A',
};

export const lineColors = {
  J: '#E2A32B',
  K: '#569BBE',
  L: '#7B4B94',
  M: '#008752',
  N: '#16418B',
  T: '#D31245',
  BART: '#0077C0',
  BUS: '#5A6B65',
  CT: '#DA1E5B',
};

export const fonts = {
  serif: "'Instrument Serif', serif",
  sans: "'Instrument Sans', sans-serif",
};

export function lineBadgeStyle(line, { size = 28, fontSize } = {}) {
  const fs = fontSize || (line === 'BART' ? '10px' : line === 'BUS' || line === 'CT' ? '11px' : '14px');
  return {
    width: size + 'px',
    height: size + 'px',
    borderRadius: line === 'CT' ? '6px' : '50%',
    flexShrink: 0,
    background: lineColors[line] || colors.muted,
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fs,
    fontWeight: 700,
  };
}

export const screenPad = { display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 16px 28px' };

export const card = { background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 18, padding: 16 };
export const cardTight = { background: colors.white, border: `1px solid ${colors.border}`, borderRadius: 18, padding: '4px 16px' };
export const tip = { background: colors.sage, borderRadius: 16, padding: '14px 16px', fontSize: 13, lineHeight: 1.6, color: colors.tealText };
export const darkCard = { background: colors.ink, color: colors.bg, borderRadius: 18, padding: 18 };
export const sectionLabel = { fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: colors.muted, marginBottom: 2 };
export const backLink = { cursor: 'pointer', fontSize: 13, color: colors.muted };

export function lineLabel(line) {
  if (line === 'BART') return 'ba';
  if (line === 'BUS') return '29';
  return line;
}
