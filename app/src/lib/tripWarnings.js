/**
 * Converts provider-specific agency identifiers into conservative service identities.
 * @param {...unknown} values - Candidate agency IDs and names.
 * @returns {string} A canonical agency identity, or an empty string.
 */
function canonicalAgency(...values) {
  const agencies = values
    .map((value) =>
      String(value ?? '')
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean);
  if (
    agencies.some(
      (agency) =>
        agency === 'BART' || agency.includes('BAY AREA RAPID TRANSIT'),
    )
  ) {
    return 'BART';
  }
  if (
    agencies.some(
      (agency) =>
      agency === 'SF' ||
      agency === 'SFMTA' ||
      agency.includes('MUNI') ||
        agency.includes('SAN FRANCISCO MUNICIPAL TRANSPORTATION'),
    )
  ) {
    return 'MUNI';
  }
  return agencies[0] ?? '';
}

/**
 * Normalize a value for exact provider identifier comparisons.
 * @param {*} value - Provider identifier.
 * @returns {string} Trimmed uppercase identifier.
 */
function comparable(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

/**
 * Parse a provider timestamp when it is valid.
 * @param {*} value - Timestamp value.
 * @returns {number|null} Milliseconds since the epoch, or null.
 */
function timeValue(value) {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) ? time : null;
}

/**
 * Determine whether any alert period overlaps a transit leg.
 * @param {Array<Object>} periods - Alert active periods.
 * @param {Object} leg - Transit leg.
 * @returns {boolean} Whether the alert can be active during the leg.
 */
function periodsOverlapLeg(periods, leg) {
  const legStart = timeValue(leg.departureTime) ?? Number.NEGATIVE_INFINITY;
  const legEnd = timeValue(leg.arrivalTime) ?? Number.POSITIVE_INFINITY;
  if (!Array.isArray(periods) || periods.length === 0) return true;

  return periods.some((period) => {
    const alertStart = timeValue(period?.start) ?? Number.NEGATIVE_INFINITY;
    const alertEnd = timeValue(period?.end) ?? Number.POSITIVE_INFINITY;
    return alertStart < legEnd && legStart < alertEnd;
  });
}

/**
 * Collect comparable stop identifiers visited by a transit leg.
 * @param {Object} leg - Transit leg.
 * @returns {Set<string>} Stop IDs and public stop codes.
 */
function stopIdsFor(leg) {
  const places = [
    leg.departure,
    ...(Array.isArray(leg.intermediateStops) ? leg.intermediateStops : []),
    leg.arrival,
  ];
  return new Set(
    places
      .flatMap((place) => [place?.id, place?.stopCode])
      .map(comparable)
      .filter(Boolean),
  );
}

/**
 * Read the first available direction identifier from a transit leg.
 * @param {Object} leg - Transit leg.
 * @returns {string} Comparable direction identifier.
 */
function directionFor(leg) {
  return comparable(
    leg.directionId ??
      leg.transport?.directionId ??
      leg.departure?.directionId ??
      leg.arrival?.directionId,
  );
}

/**
 * Read the most conservative available route identifier from a transit leg.
 * @param {Object} leg - Transit leg.
 * @returns {string} Comparable route identifier.
 */
function routeFor(leg) {
  return comparable(
    leg.transport?.shortName ?? leg.transport?.routeId ?? leg.transport?.name,
  );
}

/**
 * Determine whether one informed entity applies to a transit leg.
 * @param {Object} entity - Normalized informed entity.
 * @param {Object} alert - Parent service alert.
 * @param {Object} leg - Candidate transit leg.
 * @returns {boolean} Whether the entity applies to the leg.
 */
function entityMatchesLeg(entity, alert, leg) {
  const alertRoute = comparable(entity?.routeId);
  if (!alertRoute || alertRoute !== routeFor(leg)) return false;

  const entityAgency = String(entity?.agencyId ?? '').trim();
  const alertAgency = canonicalAgency(entityAgency || alert?.agency);
  const legAgency = canonicalAgency(leg.agency?.id, leg.agency?.name);
  if (alertAgency && legAgency && alertAgency !== legAgency) return false;
  if (!periodsOverlapLeg(alert?.activePeriods, leg)) return false;

  const alertDirection = comparable(entity?.directionId);
  const legDirection = directionFor(leg);
  if (alertDirection && legDirection && alertDirection !== legDirection) {
    return false;
  }

  const alertStop = comparable(entity?.stopId);
  const legStops = stopIdsFor(leg);
  if (alertStop && legStops.size > 0 && !legStops.has(alertStop)) return false;
  return true;
}

/**
 * Normalize provider warning copy for display and deduplication.
 * @param {*} value - Provider warning value.
 * @returns {string} Single-spaced warning text.
 */
function warningText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Collect HERE incidents and notices attached to a trip.
 * @param {Object} trip - Normalized HERE trip.
 * @returns {Array<Object>} Normalized HERE warnings.
 */
function hereWarnings(trip) {
  const sections = Array.isArray(trip?.sections) ? trip.sections : [];
  const incidents = sections.flatMap((section, sectionIndex) =>
    (Array.isArray(section?.incidents) ? section.incidents : []).flatMap(
      (incident, incidentIndex) => {
        const header = warningText(incident?.summary ?? incident?.description);
        if (!header) return [];
        const sectionId = section?.id ?? sectionIndex;
        return [
          {
            id: warningText(incident?.id) ||
              `here-incident:${sectionId}:${incidentIndex}`,
            header,
            description: warningText(incident?.description),
            severity: warningText(incident?.effect ?? incident?.type),
            source: 'HERE',
            url: warningText(incident?.url),
          },
        ];
      },
    ),
  );
  const notices = [
    ...(Array.isArray(trip?.notices) ? trip.notices : []),
    ...sections.flatMap((section) =>
      Array.isArray(section?.notices) ? section.notices : [],
    ),
  ].flatMap((notice, noticeIndex) => {
    const header = warningText(notice?.title);
    if (!header) return [];
    const code = warningText(notice?.code);
    return [
      {
        id: code ? `here-notice:${code}` : `here-notice:${noticeIndex}`,
        header,
        description: warningText(notice?.description),
        severity: warningText(notice?.severity),
        source: 'HERE',
        url: warningText(notice?.url),
      },
    ];
  });
  return [...incidents, ...notices];
}

/**
 * Collect 511 alerts that match at least one transit leg in a trip.
 * @param {Object} trip - Normalized HERE trip.
 * @param {Array<Object>} alerts - Normalized 511 alerts.
 * @returns {Array<Object>} Route-relevant 511 warnings.
 */
function alertWarnings(trip, alerts) {
  const legs = (Array.isArray(trip?.sections) ? trip.sections : []).filter(
    (section) => section?.type === 'transit',
  );
  if (legs.length === 0) return [];

  return (Array.isArray(alerts) ? alerts : []).flatMap((alert) => {
    const entities = Array.isArray(alert?.informedEntities)
      ? alert.informedEntities
      : [];
    const matches = entities.some((entity) =>
      legs.some((leg) => entityMatchesLeg(entity, alert, leg)),
    );
    const header = warningText(alert?.header);
    if (!matches || !header) return [];
    return [
      {
        id: warningText(alert?.id),
        header,
        description: warningText(alert?.description),
        severity: warningText(alert?.severity),
        source: '511',
        url: warningText(alert?.url),
      },
    ];
  });
}

/**
 * Remove warnings with duplicate IDs or normalized copy.
 * @param {Array<Object>} warnings - Candidate warnings.
 * @returns {Array<Object>} Deduplicated warnings.
 */
function deduplicateWarnings(warnings) {
  const ids = new Set();
  const text = new Set();
  return warnings.filter((warning) => {
    const id = comparable(warning.id);
    const textKey = `${comparable(warning.header)}\u0000${comparable(warning.description)}`;
    if ((id && ids.has(id)) || text.has(textKey)) return false;
    if (id) ids.add(id);
    text.add(textKey);
    return true;
  });
}

/**
 * Returns provider and route warnings relevant to one normalized HERE trip.
 * @param {Object} trip - A normalized HERE trip.
 * @param {Array<Object>} alerts - Normalized 511 service alerts.
 * @returns {Array<{id: string, header: string, description: string, severity: string, source: string, url: string}>} Relevant, deduplicated warnings.
 */
export function warningsForTrip(trip, alerts) {
  return deduplicateWarnings([
    ...hereWarnings(trip),
    ...alertWarnings(trip, alerts),
  ]);
}
