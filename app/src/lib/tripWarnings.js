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
  return (
    [
      leg.transport?.shortName,
      leg.transport?.routeId,
      leg.transport?.name,
    ]
      .map(comparable)
      .find(Boolean) ?? ''
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
 * Return the stable identifier used to associate warnings with trip sections.
 * @param {Object} section - Trip section.
 * @param {number} index - Section position within the trip.
 * @returns {string} Provider section ID or a stable positional fallback.
 */
export function sectionId(section, index) {
  return String(section?.id ?? `section:${index}`);
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
        const associatedSectionId = sectionId(section, sectionIndex);
        return [
          {
            id: warningText(incident?.id) ||
              `here-incident:${associatedSectionId}:${incidentIndex}`,
            header,
            description: warningText(incident?.description),
            severity: warningText(incident?.effect ?? incident?.type),
            source: 'HERE',
            url: warningText(incident?.url),
            sectionIds: [associatedSectionId],
          },
        ];
      },
    ),
  );
  const noticeWarning = (notice, noticeIndex, sectionIds, fallbackScope) => {
    const header = warningText(notice?.title);
    if (!header) return [];
    const code = warningText(notice?.code);
    return [
      {
        id: code
          ? `here-notice:${code}`
          : `here-notice:${fallbackScope}:${noticeIndex}`,
        header,
        description: warningText(notice?.description),
        severity: warningText(notice?.severity),
        source: 'HERE',
        url: warningText(notice?.url),
        sectionIds,
      },
    ];
  };
  const tripNotices = (Array.isArray(trip?.notices) ? trip.notices : []).flatMap(
    (notice, noticeIndex) =>
      noticeWarning(notice, noticeIndex, [], 'trip'),
  );
  const sectionNotices = sections.flatMap((section, sectionIndex) => {
    const associatedSectionId = sectionId(section, sectionIndex);
    return (Array.isArray(section?.notices) ? section.notices : []).flatMap(
      (notice, noticeIndex) =>
        noticeWarning(
          notice,
          noticeIndex,
          [associatedSectionId],
          associatedSectionId,
        ),
    );
  });
  return [...incidents, ...tripNotices, ...sectionNotices];
}

/**
 * Collect 511 alerts that match at least one transit leg in a trip.
 * @param {Object} trip - Normalized HERE trip.
 * @param {Array<Object>} alerts - Normalized 511 alerts.
 * @returns {Array<Object>} Route-relevant 511 warnings.
 */
function alertWarnings(trip, alerts) {
  const legs = (Array.isArray(trip?.sections) ? trip.sections : [])
    .map((section, index) => ({ section, id: sectionId(section, index) }))
    .filter(({ section }) => section?.type === 'transit');
  if (legs.length === 0) return [];

  return (Array.isArray(alerts) ? alerts : []).flatMap((alert) => {
    const entities = Array.isArray(alert?.informedEntities)
      ? alert.informedEntities
      : [];
    const sectionIds = legs.flatMap(({ section, id }) =>
      entities.some((entity) => entityMatchesLeg(entity, alert, section))
        ? [id]
        : [],
    );
    const header = warningText(alert?.header);
    if (sectionIds.length === 0 || !header) return [];
    return [
      {
        id: warningText(alert?.id),
        header,
        description: warningText(alert?.description),
        severity: warningText(alert?.severity),
        source: '511',
        url: warningText(alert?.url),
        sectionIds: [...new Set(sectionIds)],
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
  const byId = new Map();
  const byText = new Map();
  return warnings.reduce((deduplicated, warning) => {
    const id = comparable(warning.id);
    const textKey = `${comparable(warning.header)}\u0000${comparable(warning.description)}`;
    const idMatch = id ? byId.get(id) : undefined;
    const textMatch = byText.get(textKey);
    const existing = idMatch || textMatch;
    if (existing) {
      if (idMatch && textMatch && idMatch !== textMatch) {
        existing.sectionIds = [...new Set([
          ...(existing.sectionIds ?? []),
          ...(textMatch.sectionIds ?? []),
        ])];
        for (const [key, match] of byId) {
          if (match === textMatch) byId.set(key, existing);
        }
        for (const [key, match] of byText) {
          if (match === textMatch) byText.set(key, existing);
        }
        const duplicateIndex = deduplicated.indexOf(textMatch);
        if (duplicateIndex !== -1) deduplicated.splice(duplicateIndex, 1);
      }
      existing.sectionIds = [...new Set([
        ...(existing.sectionIds ?? []),
        ...(warning.sectionIds ?? []),
      ])];
      if (id) byId.set(id, existing);
      byText.set(textKey, existing);
      return deduplicated;
    }

    const normalized = {
      ...warning,
      sectionIds: [...new Set(warning.sectionIds ?? [])],
    };
    if (id) byId.set(id, normalized);
    byText.set(textKey, normalized);
    deduplicated.push(normalized);
    return deduplicated;
  }, []);
}

/**
 * Returns provider and route warnings relevant to one normalized HERE trip.
 * @param {Object} trip - A normalized HERE trip.
 * @param {Array<Object>} alerts - Normalized 511 service alerts.
 * @returns {Array<{id: string, header: string, description: string, severity: string, source: string, url: string, sectionIds: string[]}>} Relevant, deduplicated warnings.
 */
export function warningsForTrip(trip, alerts) {
  return deduplicateWarnings([
    ...hereWarnings(trip),
    ...alertWarnings(trip, alerts),
  ]);
}
