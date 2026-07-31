import { useState } from 'react';
import { colors } from '../../theme.js';
import { sectionId } from '../../lib/tripWarnings.js';
import JourneyIcon from './JourneyIcon.jsx';
import TransitIdentity from './TransitIdentity.jsx';
import { formatDuration } from './itineraryFormat.jsx';

/**
 * Build a readable summary for a transit journey section.
 * @param {Object} section - Normalized transit section.
 * @returns {string} Route and destination summary.
 */
function transitDescription(section) {
  const line =
    section.transport?.name ?? section.transport?.shortName ?? 'Transit';
  return section.transport?.headsign
    ? `${line} toward ${section.transport.headsign}`
    : line;
}

/**
 * Render every route section as an ordered, horizontally scrollable journey.
 * @param {{ sections?: Array<Object>, advisorySectionIds?: Set<string> }} props - Journey sections and affected section IDs.
 * @returns {JSX.Element} The accessible journey timeline.
 */
export default function JourneyTimeline({ sections, advisorySectionIds }) {
  const routeSections = Array.isArray(sections) ? sections : [];
  const [isFocused, setIsFocused] = useState(false);

  return (
    <>
      <ol
        role="list"
        aria-label="Journey timeline"
        tabIndex={0}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          overflowX: 'auto',
          listStyle: 'none',
          margin: '11px 0 0',
          padding: 0,
          borderRadius: 4,
          outline: isFocused
            ? `2px solid ${colors.teal}`
            : '2px solid transparent',
          outlineOffset: 2,
        }}
      >
        {routeSections.map((section, index) => (
          <li
            role="listitem"
            key={section.id || `${section.type}-${index}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              flex: '0 0 auto',
              color: colors.tealText,
              fontSize: 12,
            }}
          >
            {section.type === 'pedestrian' ? (
              <>
                <JourneyIcon type="walk" />
                <span>{section.label || 'Walk'}</span>
              </>
            ) : null}
            {section.type === 'transit' ? (
              <>
                <TransitIdentity
                  section={section}
                  compact
                  hasAdvisory={advisorySectionIds?.has(sectionId(section, index))}
                />
                <span>{transitDescription(section)}</span>
              </>
            ) : null}
            {section.type !== 'pedestrian' && section.type !== 'transit' ? (
              <span>{section.label || 'Route step'}</span>
            ) : null}
            {Number.isFinite(section.durationSeconds) ? (
              <span style={{ color: colors.muted }}>
                {formatDuration(section.durationSeconds)}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {routeSections.length === 0 ? (
        <div style={{ color: colors.mutedText, fontSize: 13 }}>
          Transit option
        </div>
      ) : null}
    </>
  );
}
