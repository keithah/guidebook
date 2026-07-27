import { useApp } from '../../context/AppContext.jsx';
import { colors, fonts, screenPad, card, tip } from '../../theme.js';

const TAG_NAMES = { hood: 'neighborhood', nature: 'nature', car: 'car', wine: 'wine', museums: 'museums', kids: 'kids', dogs: 'dogs' };

export default function Explore() {
  const { property, isGeneric, filter, setFilter } = useApp();
  const { filters, places, eventsGeneric, eventsSample, tips } = property.explore;

  const visible = places
    .filter((p) => filter === 'all' || p.tags.includes(filter))
    .map((p) => ({ ...p, tagLabel: p.tags.map((t) => TAG_NAMES[t]).join(' · ') }));

  return (
    <div style={screenPad}>
      <div style={{ fontFamily: fonts.serif, fontSize: 32 }}>Explore SF</div>
      <div style={{ fontSize: 13, color: colors.muted, lineHeight: 1.6 }}>
        No fixed itineraries — pick what you're into and {property.host.name} will point you at the city he'd send a friend to.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {filters.map((fl) => {
          const on = filter === fl.id;
          return (
            <div
              key={fl.id}
              onClick={() => setFilter(fl.id)}
              style={{
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: on ? 600 : 500,
                padding: '7px 13px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                background: on ? colors.teal : colors.white,
                color: on ? '#F2F7F5' : colors.ink,
                border: on ? `1px solid ${colors.teal}` : `1px solid ${colors.border}`,
              }}
            >
              {fl.label}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((p, i) => (
          <div key={i} style={{ ...card, padding: '15px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: colors.muted, whiteSpace: 'nowrap' }}>{p.tagLabel}</div>
            </div>
            <div style={{ fontSize: 12, color: colors.teal, fontWeight: 600, marginTop: 2 }}>{p.route}</div>
            <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.55, marginTop: 5 }}>{p.note}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>What's on</div>
        <div style={{ fontSize: 13, color: colors.mutedText, lineHeight: 1.65, marginTop: 4 }}>{isGeneric ? eventsGeneric : eventsSample}</div>
      </div>

      <div style={tip}>
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.ink }}>SF tips &amp; safety</div>
        <div style={{ fontSize: 13, color: colors.tealText, lineHeight: 1.65, marginTop: 4 }}>{tips}</div>
      </div>
    </div>
  );
}
