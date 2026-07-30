import { describe, expect, it } from 'vitest';
import { classifyTransitLeg, safeTransitColor } from '../transitIdentity.js';

const section = (agency, transport) => ({ type: 'transit', agency, transport });

describe('classifyTransitLeg', () => {
  it.each(['lightRail', 'metro', 'subway', 'tram', 'train'])(
    'classifies Muni %s as rail',
    (mode) => {
      expect(classifyTransitLeg(section(
        { id: 'SFMTA', name: 'San Francisco Municipal Transportation Agency' },
        { mode, shortName: 'K', name: 'K Ingleside', color: '#005B95' },
      ))).toMatchObject({
        operator: 'muni', operatorLabel: 'Muni', vehicle: 'train',
        vehicleLabel: 'train', lineLabel: 'K', color: '#005B95',
        accessibleLabel: 'Muni K train',
      });
    },
  );

  it('classifies a numbered Muni rapid route as a bus', () => {
    expect(classifyTransitLeg(section(
      { id: 'SF', name: 'Muni' },
      { mode: 'busRapid', shortName: '38R', name: '38R Geary Rapid' },
    ))).toMatchObject({
      operator: 'muni', vehicle: 'bus', lineLabel: '38R',
      accessibleLabel: 'Muni 38R bus',
    });
  });

  it('classifies every BART color line as a train and keeps its name', () => {
    for (const line of ['Blue', 'Yellow', 'Red', 'Green', 'Orange']) {
      expect(classifyTransitLeg(section(
        { id: 'BART', name: 'Bay Area Rapid Transit' },
        { mode: 'subway', shortName: line, name: `${line} Line` },
      ))).toMatchObject({
        operator: 'bart', operatorLabel: 'BART', vehicle: 'train',
        lineLabel: line, accessibleLabel: `BART ${line} train`,
      });
    }
  });

  it('uses the explicit rail mode before the digit-leading fallback', () => {
    expect(classifyTransitLeg(section(
      { id: 'SFMTA' }, { mode: 'lightRail', shortName: '1' },
    )).vehicle).toBe('train');
  });

  it('keeps an unknown operator leg visible with a generic identity', () => {
    expect(classifyTransitLeg(section(
      { name: 'Golden Gate Transit' }, { shortName: '101' },
    ))).toMatchObject({
      operator: 'other', operatorLabel: 'Golden Gate Transit',
      vehicle: 'transit', lineLabel: '101',
    });
  });

  it('keeps line labels readable and accepts only contrast-safe provider text colors', () => {
    const yellow = classifyTransitLeg(section(
      { id: 'BART' },
      { mode: 'train', shortName: 'Yellow' },
    ));
    const dark = classifyTransitLeg(section(
      { id: 'SFMTA' },
      { mode: 'lightRail', shortName: 'K', color: '#005B95' },
    ));
    const safeProvider = classifyTransitLeg(section(
      { id: 'BART' },
      {
        mode: 'train',
        shortName: 'Yellow',
        textColor: '#14201D',
      },
    ));
    const unsafeProvider = classifyTransitLeg(section(
      { id: 'BART' },
      {
        mode: 'train',
        shortName: 'Yellow',
        textColor: 'url(javascript:bad)',
      },
    ));
    const lowContrastProvider = classifyTransitLeg(section(
      { id: 'BART' },
      {
        mode: 'train',
        shortName: 'Yellow',
        textColor: '#F9DF3A',
      },
    ));

    expect(yellow).toMatchObject({ color: '#F9DF3A', foreground: '#000000' });
    expect(dark).toMatchObject({ color: '#005B95', foreground: '#FFFFFF' });
    expect(safeProvider.foreground).toBe('#14201D');
    expect(unsafeProvider.foreground).toBe('#000000');
    expect(lowContrastProvider.foreground).toBe('#000000');
  });
});

describe('safeTransitColor', () => {
  it('accepts six-digit hex and rejects unsafe or unreadable values', () => {
    expect(safeTransitColor('#009BDA', '#5A6B65')).toBe('#009BDA');
    expect(safeTransitColor('url(javascript:bad)', '#5A6B65')).toBe('#5A6B65');
    expect(safeTransitColor('#fff', '#5A6B65')).toBe('#5A6B65');
  });
});
