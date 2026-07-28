import { useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { colors, fonts, screenPad, card, tip } from '../../theme.js';
import ImageSlot from '../ImageSlot.jsx';
import Drill from '../Drill.jsx';

export const ARRIVE_SECTIONS = [
  { id: 'plane', name: 'By Plane', sub: 'SFO · OAK · SJC · STS' },
  { id: 'driving', name: 'Driving', sub: 'I-280 to Ocean Ave' },
  { id: 'transit', name: 'By Public Transit', sub: 'BART, the K, and buses' },
  { id: 'parking', name: 'Parking', sub: 'Your spot + street rules' },
  { id: 'gettingin', name: 'Getting In', sub: 'Gate and door codes' },
];

const bodyText = { fontSize: 13, color: colors.mutedText, lineHeight: 1.65 };
const subLabel = { fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: colors.teal, marginTop: 10, marginBottom: 3 };

function SectionHeader({ id, title }) {
  return (
    <div id={`arrive-${id}`} style={{ fontFamily: fonts.serif, fontSize: 22, scrollMarginTop: 8, marginTop: 6 }}>
      {title}
    </div>
  );
}

function Airport({ airport }) {
  return (
    <Drill title={`From ${airport.name}`} sub={airport.sub}>
      <div style={bodyText}>{airport.summary}</div>
      {airport.mapUrl && (
        <a
          href={airport.mapUrl}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'inline-block', marginTop: 6, fontSize: 13, fontWeight: 600 }}
        >
          Route map to the cottage →
        </a>
      )}
      <div style={subLabel}>Public transit</div>
      <div style={bodyText}>{airport.transit}</div>
      <div style={subLabel}>Rental car</div>
      <div style={bodyText}>{airport.rentalCar}</div>
      <div style={subLabel}>Rideshare</div>
      <div style={bodyText}>{airport.rideshare}</div>
    </Drill>
  );
}

export default function Arrive() {
  const { property, arriveTarget, clearArriveTarget } = useApp();
  const { steps, earlyArrival } = property.checkin;
  const arrive = property.arrive;

  useEffect(() => {
    if (!arriveTarget) return;
    const el = document.getElementById(`arrive-${arriveTarget}`);
    if (el) el.scrollIntoView({ block: 'start' });
    clearArriveTarget();
  }, [arriveTarget, clearArriveTarget]);

  return (
    <div style={screenPad}>
      <div style={{ fontFamily: fonts.serif, fontSize: 32 }}>Arrive</div>

      <SectionHeader id="plane" title="By Plane" />
      <div style={{ ...card, paddingTop: 4, paddingBottom: 4 }}>
        {arrive.byPlane.map((a) => (
          <Airport key={a.id} airport={a} />
        ))}
      </div>

      <SectionHeader id="driving" title="Driving" />
      <div style={card}>
        <div style={bodyText}>{arrive.driving}</div>
      </div>

      <SectionHeader id="transit" title="By Public Transit" />
      <div style={card}>
        <div style={bodyText}>{arrive.publicTransit}</div>
      </div>

      <SectionHeader id="parking" title="Parking" />
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <img
          src={import.meta.env.BASE_URL + arrive.parking.photo}
          alt="The parking spot in front of the cottage"
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
        <div style={{ padding: 16 }}>
          <div style={{ ...bodyText, color: '#3B4E49' }}>{arrive.parking.main}</div>
          <div style={{ ...bodyText, marginTop: 8, fontWeight: 600, color: colors.tealText }}>{arrive.parking.limit}</div>
          <div style={{ ...bodyText, marginTop: 8 }}>{arrive.parking.street}</div>
          <div style={{ marginTop: 6 }}>
            <Drill title="Need a second spot?" sub="Nearby streets that usually have room">
              <div style={bodyText}>{arrive.parking.secondCar.intro}</div>
              <ul style={{ ...bodyText, margin: '6px 0 0', paddingLeft: 18 }}>
                {arrive.parking.secondCar.spots.map((s, i) => (
                  <li key={i} style={{ marginBottom: 5 }}>
                    {s}
                  </li>
                ))}
              </ul>
              <div style={{ ...bodyText, marginTop: 6 }}>
                {arrive.parking.secondCar.outro}{' '}
                <a href={arrive.parking.secondCar.spotAngelsUrl} target="_blank" rel="noreferrer">
                  Open SpotAngels →
                </a>
              </div>
            </Drill>
          </div>
        </div>
      </div>

      <SectionHeader id="gettingin" title="Getting In" />
      <div style={card}>
        {steps.map((text, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: `1px solid ${colors.borderSoft}` }}>
            <div style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.teal, minWidth: 14 }}>{i + 1}</div>
            <div style={{ fontSize: 13, color: '#3B4E49', lineHeight: 1.55 }}>{text}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <div style={{ flex: 1, height: 92, borderRadius: 12, overflow: 'hidden' }}>
            <ImageSlot id="fog-gate" placeholder="Gate keypad" radius={12} />
          </div>
          <div style={{ flex: 1, height: 92, borderRadius: 12, overflow: 'hidden' }}>
            <ImageSlot id="fog-door" placeholder="Door keypad" radius={12} />
          </div>
        </div>
      </div>

      <div style={tip}>
        The cottage is down a narrow alley — take big suitcases slowly. {earlyArrival}
      </div>
    </div>
  );
}
