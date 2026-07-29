import { useId, useState } from 'react';
import { colors } from '../../theme.js';

function normalizeLineId(value) {
  return String(value ?? '').trim().toUpperCase();
}

function isRelevant(alert, lineIds) {
  const affectedLines = Array.isArray(alert?.affectedLines)
    ? alert.affectedLines
    : [];
  if (!lineIds?.length) return affectedLines.length === 0;

  const requested = new Set(lineIds.map(normalizeLineId));
  return affectedLines.some((line) => requested.has(normalizeLineId(line)));
}

function AlertRow({ alert }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const hasDetails = Boolean(
    alert.description ||
      alert.activePeriod?.start ||
      alert.activePeriod?.end ||
      alert.url ||
      alert.updatedAt,
  );

  return (
    <li
      style={{
        padding: '10px 0',
        borderBottom: `1px solid ${colors.borderSoft}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ color: colors.ink, fontSize: 13, fontWeight: 600 }}>
          {alert.header}
        </div>
        {hasDetails && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={`${expanded ? 'Hide' : 'Show'} details for ${alert.header}`}
            onClick={() => setExpanded((value) => !value)}
            style={{
              border: 0,
              padding: 0,
              background: 'transparent',
              color: colors.teal,
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {expanded ? 'Hide' : 'Details'}
          </button>
        )}
      </div>
      {expanded && (
        <div
          id={detailsId}
          style={{
            marginTop: 6,
            color: colors.mutedText,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {alert.description && <div>{alert.description}</div>}
          {(alert.activePeriod?.start || alert.activePeriod?.end) && (
            <div style={{ marginTop: 4 }}>
              {alert.activePeriod.start && (
                <>
                  From{' '}
                  <time dateTime={alert.activePeriod.start}>
                    {new Date(alert.activePeriod.start).toLocaleString()}
                  </time>
                </>
              )}
              {alert.activePeriod.start && alert.activePeriod.end && ' · '}
              {alert.activePeriod.end && (
                <>
                  Until{' '}
                  <time dateTime={alert.activePeriod.end}>
                    {new Date(alert.activePeriod.end).toLocaleString()}
                  </time>
                </>
              )}
            </div>
          )}
          {alert.updatedAt && (
            <div style={{ marginTop: 4 }}>
              Updated{' '}
              <time dateTime={alert.updatedAt}>
                {new Date(alert.updatedAt).toLocaleString()}
              </time>
            </div>
          )}
          {alert.url && (
            <a
              href={alert.url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-block', marginTop: 5 }}
            >
              Read alert ↗
            </a>
          )}
        </div>
      )}
    </li>
  );
}

export default function TransitAlerts({ alerts = [], lineIds }) {
  const relevantAlerts = alerts.filter((alert) =>
    isRelevant(alert, lineIds),
  );
  if (relevantAlerts.length === 0) return null;

  return (
    <section
      aria-label={lineIds?.length ? 'Alerts for this trip' : 'Transit alerts'}
      style={{
        marginTop: 12,
        borderRadius: 12,
        background: colors.cream,
        padding: '3px 12px',
      }}
    >
      <div
        style={{
          paddingTop: 9,
          color: colors.muted,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
        }}
      >
        {lineIds?.length ? 'Service alert' : 'General service alert'}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {relevantAlerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} />
        ))}
      </ul>
    </section>
  );
}
