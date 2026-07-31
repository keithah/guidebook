import { describe, expect, it } from 'vitest';

import alertFixture from '../../test/fixtures/511-alerts.json';
import { normalizeServiceAlerts } from '../transit511.js';
import { warningsForTrip } from '../tripWarnings.js';

const alertNow = Date.parse('2026-07-28T19:00:00.000Z');
const alerts = normalizeServiceAlerts(alertFixture, alertNow, 'SF');
const mixedAgencyAlert = {
  id: 'mixed-agency-alert',
  agency: 'BART',
  activePeriods: [],
  informedEntities: [
    {
      agencyId: 'BART',
      routeId: 'RED',
      stopId: '',
      directionId: '',
    },
    {
      agencyId: 'SF',
      routeId: 'K',
      stopId: '',
      directionId: '',
    },
  ],
  header: 'Mixed operator service change',
  description: 'Check the affected route.',
  severity: 'MODIFIED_SERVICE',
  url: '',
};

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
  sectionNotices = [],
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
        notices: sectionNotices,
      },
    ],
  };
}

describe('warningsForTrip', () => {
  it('matches Muni aliases by exact route, overlapping time, direction, and stop', () => {
    const warning = warningsForTrip(transitTrip(), alerts).find(
      ({ header }) => header === 'K Ingleside delay',
    );

    expect(warning).toMatchObject({ sectionIds: ['section-K'] });
  });

  it('associates a 511 route entity only with matching transit sections', () => {
    const trip = transitTrip();
    trip.sections.push({
      ...trip.sections[0],
      id: 'section-38R',
      transport: { shortName: '38R', name: '38R service' },
    });

    const warning = warningsForTrip(trip, alerts).find(
      ({ header }) => header === 'K Ingleside delay',
    );

    expect(warning).toMatchObject({ sectionIds: ['section-K'] });
  });

  it('associates one 511 alert with every matching transit section', () => {
    const trip = transitTrip();
    trip.sections.push({
      ...trip.sections[0],
      id: 'second-k-section',
      departure: { id: 'west-portal', stopCode: '17217' },
    });

    const warning = warningsForTrip(trip, alerts).find(
      ({ header }) => header === 'K Ingleside delay',
    );

    expect(warning).toMatchObject({
      sectionIds: ['section-K', 'second-k-section'],
    });
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

  it('uses an exact transport name only when route identifiers are absent', () => {
    const exactNameTrip = transitTrip();
    delete exactNameTrip.sections[0].transport.shortName;
    delete exactNameTrip.sections[0].transport.routeId;
    exactNameTrip.sections[0].transport.name = 'K';

    expect(
      warningsForTrip(exactNameTrip, alerts).map((warning) => warning.header),
    ).toContain('K Ingleside delay');

    exactNameTrip.sections[0].transport.name = 'K Ingleside';
    expect(warningsForTrip(exactNameTrip, alerts)).toEqual([]);
  });

  it.each([
    ['empty', '', ''],
    ['whitespace-only', '   ', '\t'],
  ])(
    'falls back from %s route identifiers to an exact transport name',
    (_label, shortName, routeId) => {
      const trip = transitTrip();
      trip.sections[0].transport = { shortName, routeId, name: 'K' };

      expect(
        warningsForTrip(trip, alerts).map((warning) => warning.header),
      ).toContain('K Ingleside delay');
    },
  );

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

  it('matches a later Muni entity without inheriting the first entity agency', () => {
    expect(
      warningsForTrip(transitTrip(), [mixedAgencyAlert]).map(
        (warning) => warning.header,
      ),
    ).toEqual(['Mixed operator service change']);
  });

  it('does not reinterpret a Muni entity as BART on a shared route ID', () => {
    expect(
      warningsForTrip(
        transitTrip({
          agencyId: 'BART',
          agencyName: 'Bay Area Rapid Transit',
        }),
        [mixedAgencyAlert],
      ),
    ).toEqual([]);
  });

  it('falls back to the alert agency when an entity has no agency', () => {
    const fallbackAgencyAlert = {
      id: 'fallback-agency-alert',
      agency: 'BART',
      activePeriods: [],
      informedEntities: [
        {
          agencyId: '',
          routeId: 'RED',
          stopId: '',
          directionId: '',
        },
      ],
      header: 'Red Line service change',
      description: 'Check the affected route.',
      severity: 'MODIFIED_SERVICE',
      url: '',
    };

    expect(
      warningsForTrip(
        transitTrip({
          agencyId: 'BA',
          agencyName: 'Bay Area Rapid Transit',
          routeId: 'red',
        }),
        [fallbackAgencyAlert],
      ).map((warning) => warning.header),
    ).toEqual(['Red Line service change']);
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

  it('associates HERE section incidents and notices with their section', () => {
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
      sectionNotices: [
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
        sectionIds: ['section-K'],
      },
      {
        id: 'here-notice:excessiveWaitingTime',
        header: 'Allow extra time',
        description: '',
        severity: 'info',
        source: 'HERE',
        url: '',
        sectionIds: ['section-K'],
      },
    ]);
  });

  it('keeps trip-level HERE notices unscoped', () => {
    const trip = transitTrip({
      notices: [
        {
          code: 'trip-guidance',
          title: 'Check trip details',
          severity: 'info',
        },
      ],
    });

    expect(warningsForTrip(trip, [])).toEqual([
      {
        id: 'here-notice:trip-guidance',
        header: 'Check trip details',
        description: '',
        severity: 'info',
        source: 'HERE',
        url: '',
        sectionIds: [],
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

  it('merges section associations while deduplicating by provider ID', () => {
    const trip = transitTrip();
    trip.sections.push({
      ...trip.sections[0],
      id: 'second-k-section',
      incidents: [
        {
          id: 'shared-incident',
          summary: 'Boarding change',
          description: 'Use the marked platform.',
        },
      ],
    });
    trip.sections[0].incidents = [
      {
        id: 'shared-incident',
        summary: 'Boarding change',
        description: 'Use the marked platform.',
      },
    ];

    expect(warningsForTrip(trip, [])).toEqual([
      expect.objectContaining({
        id: 'shared-incident',
        sectionIds: ['section-K', 'second-k-section'],
      }),
    ]);
  });

  it('merges section associations while deduplicating normalized copy', () => {
    const incident = {
      summary: 'Boarding change',
      description: 'Use the marked platform.',
    };
    const trip = transitTrip({ incidents: [incident] });
    trip.sections.push({
      ...trip.sections[0],
      id: 'second-k-section',
      incidents: [{ ...incident, summary: ' boarding   CHANGE ' }],
    });

    expect(warningsForTrip(trip, [])).toEqual([
      expect.objectContaining({
        sectionIds: ['section-K', 'second-k-section'],
      }),
    ]);
  });
});
