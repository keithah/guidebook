import { describe, expect, it } from 'vitest';

import alertFixture from '../../test/fixtures/511-alerts.json';
import { normalizeServiceAlerts } from '../transit511.js';
import { warningsForTrip } from '../tripWarnings.js';

const alertNow = Date.parse('2026-07-28T19:00:00.000Z');
const alerts = normalizeServiceAlerts(alertFixture, alertNow, 'SF');

function transitTrip({
  agencyId = 'SFMTA',
  agencyName = 'San Francisco Municipal Transportation Agency',
  routeId = 'K',
  directionId = '1',
  departureTime = '2026-07-28T18:30:00.000Z',
  arrivalTime = '2026-07-28T19:00:00.000Z',
  stopId = 'west-portal',
  stopCode = '17217',
  incidents = [],
  notices = [],
} = {}) {
  return {
    id: `trip-${routeId}`,
    notices,
    sections: [
      {
        id: `section-${routeId}`,
        type: 'transit',
        departureTime,
        arrivalTime,
        directionId,
        agency: { id: agencyId, name: agencyName },
        transport: { shortName: routeId, name: `${routeId} service` },
        departure: { id: stopId, stopCode },
        intermediateStops: [{ id: 'midpoint', stopCode: 'MID' }],
        arrival: { id: 'terminal', stopCode: 'TERM' },
        incidents,
        notices: [],
      },
    ],
  };
}

describe('warningsForTrip', () => {
  it('matches Muni aliases by exact route, overlapping time, direction, and stop', () => {
    expect(
      warningsForTrip(transitTrip(), alerts).map((warning) => warning.header),
    ).toContain('K Ingleside delay');
  });

  it('matches a route entity when optional stop and direction are absent', () => {
    expect(
      warningsForTrip(transitTrip({ routeId: '43' }), alerts).map(
        (warning) => warning.header,
      ),
    ).toContain('43 Masonic reroute');
  });

  it('excludes unrelated and substring-only routes', () => {
    expect(warningsForTrip(transitTrip({ routeId: '38R' }), alerts)).toEqual(
      [],
    );
    expect(warningsForTrip(transitTrip({ routeId: 'KX' }), alerts)).toEqual(
      [],
    );
  });

  it('excludes a matching route outside every active period', () => {
    expect(
      warningsForTrip(
        transitTrip({
          departureTime: '2026-07-29T10:00:00.000Z',
          arrivalTime: '2026-07-29T10:30:00.000Z',
        }),
        alerts,
      ),
    ).toEqual([]);
  });

  it('excludes a matching route with a comparable wrong direction', () => {
    expect(
      warningsForTrip(transitTrip({ directionId: '0' }), alerts),
    ).toEqual([]);
  });

  it('excludes a matching route with comparable nonmatching stops', () => {
    expect(
      warningsForTrip(
        transitTrip({ stopId: 'another-stop', stopCode: 'OTHER' }),
        alerts,
      ),
    ).toEqual([]);
  });

  it('does not require optional stop or direction data when the leg lacks it', () => {
    const trip = transitTrip({ directionId: undefined });
    trip.sections[0].departure = {};
    trip.sections[0].intermediateStops = [];
    trip.sections[0].arrival = {};

    expect(warningsForTrip(trip, alerts).map((warning) => warning.header)).toContain(
      'K Ingleside delay',
    );
  });

  it('requires a matchable alert route and compatible agencies when comparable', () => {
    const routeLess = {
      ...alerts[0],
      id: 'route-less',
      informedEntities: [
        { agencyId: 'SF', routeId: '', stopId: '', directionId: '' },
      ],
    };
    expect(warningsForTrip(transitTrip(), [routeLess])).toEqual([]);
    expect(
      warningsForTrip(
        transitTrip({ agencyId: 'BART', agencyName: 'Bay Area Rapid Transit' }),
        alerts,
      ),
    ).toEqual([]);
  });

  it('canonicalizes a BART agency name even when its provider ID is unfamiliar', () => {
    const bartAlert = {
      id: 'bart-red-delay',
      agency: 'BART',
      activePeriods: [],
      informedEntities: [
        {
          agencyId: 'BART',
          routeId: 'RED',
          stopId: '',
          directionId: '',
        },
      ],
      header: 'Red Line delay',
      description: 'Allow extra travel time.',
      severity: 'SIGNIFICANT_DELAYS',
      url: '',
    };

    expect(
      warningsForTrip(
        transitTrip({
          agencyId: 'BA',
          agencyName: 'Bay Area Rapid Transit',
          routeId: 'red',
        }),
        [bartAlert],
      ).map((warning) => warning.header),
    ).toEqual(['Red Line delay']);
  });

  it('does not overlap when an alert ends exactly as a leg begins', () => {
    const boundaryAlert = {
      ...alerts[1],
      activePeriods: [
        {
          start: '2026-07-28T18:00:00.000Z',
          end: '2026-07-28T18:30:00.000Z',
        },
      ],
    };

    expect(
      warningsForTrip(transitTrip({ routeId: '43' }), [boundaryAlert]),
    ).toEqual([]);
  });

  it('treats an empty period list and missing bounds as unbounded', () => {
    const unbounded = {
      ...alerts[1],
      activePeriods: [],
    };
    const openEnded = {
      ...alerts[1],
      id: 'open-ended',
      activePeriods: [{ start: null, end: null }],
    };
    expect(warningsForTrip(transitTrip({ routeId: '43' }), [unbounded])).toHaveLength(1);
    expect(warningsForTrip(transitTrip({ routeId: '43' }), [openEnded])).toHaveLength(1);
  });

  it('gathers HERE incidents and notices into the warning model', () => {
    const trip = transitTrip({
      incidents: [
        {
          type: 'technicalProblem',
          effect: 'modifiedService',
          summary: 'Boarding platform changed',
          description: 'Board from platform 2.',
          url: 'https://example.test/platform',
        },
      ],
      notices: [
        {
          code: 'excessiveWaitingTime',
          title: 'Allow extra time',
          severity: 'info',
        },
      ],
    });

    expect(warningsForTrip(trip, [])).toEqual([
      {
        id: 'here-incident:section-K:0',
        header: 'Boarding platform changed',
        description: 'Board from platform 2.',
        severity: 'modifiedService',
        source: 'HERE',
        url: 'https://example.test/platform',
      },
      {
        id: 'here-notice:excessiveWaitingTime',
        header: 'Allow extra time',
        description: '',
        severity: 'info',
        source: 'HERE',
        url: '',
      },
    ]);
  });

  it('deduplicates equivalent HERE and 511 warnings by normalized text', () => {
    const duplicateIncident = {
      summary: '  K Ingleside DELAY ',
      description: 'Allow extra travel time on the K line.',
      effect: 'modifiedService',
    };

    const warnings = warningsForTrip(
      transitTrip({ incidents: [duplicateIncident] }),
      alerts,
    );

    expect(
      warnings.filter((warning) => warning.header.trim().toLowerCase() === 'k ingleside delay'),
    ).toHaveLength(1);
  });
});
