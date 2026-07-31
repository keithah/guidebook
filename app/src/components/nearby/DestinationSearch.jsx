import { colors, fonts } from '../../theme.js';

const SEARCH_MESSAGES = {
  loading: 'Looking for addresses…',
  empty: 'No matching address or neighborhood…',
  error: 'Address search needs a connection…',
};

/**
 * Render a destination row with selection and saved-place controls.
 * @param {Object} candidate - The destination to display.
 * @param {boolean} selected - Whether the destination is currently selected.
 * @param {boolean} saved - Whether the destination is in saved places.
 * @param {Function} onSelect - Called with the destination when it is selected.
 * @param {Function} onToggleSaved - Called with the destination when its saved state is toggled.
 */
function PlaceRow({ candidate, selected, saved, onSelect, onToggleSaved }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 7,
        borderTop: `1px solid ${colors.borderSoft}`,
        padding: '8px 0',
      }}
    >
      <button
        type="button"
        aria-label={`Choose ${candidate.title}${candidate.address ? ` — ${candidate.address}` : ''}`}
        aria-pressed={selected}
        onClick={() => onSelect(candidate)}
        style={{
          minWidth: 0,
          flex: 1,
          border: 0,
          padding: '2px 0',
          background: 'transparent',
          color: colors.ink,
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>
          {candidate.title}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 2,
            color: colors.muted,
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {candidate.address}
        </span>
      </button>
      <button
        type="button"
        aria-label={`${saved ? 'Remove' : 'Save'} ${candidate.title}${saved ? ' from saved places' : ''}`}
        onClick={() => onToggleSaved(candidate)}
        style={{
          alignSelf: 'center',
          border: `1px solid ${colors.border}`,
          borderRadius: 999,
          padding: '7px 9px',
          background: saved ? colors.sage : colors.white,
          color: colors.teal,
          cursor: 'pointer',
          font: 'inherit',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}

/**
 * Render a destination search form with search results and saved places.
 * @param {Object} props - Destination search configuration and event handlers.
 * @param {string} props.query - Current search query.
 * @param {Function} props.onQueryChange - Handles changes to the search query.
 * @param {Array} [props.candidates] - Destinations matching the query.
 * @param {Object} [props.selectedDestination] - Currently selected destination.
 * @param {Object} [props.searchStatus] - Current search status.
 * @param {Array} [props.savedDestinations] - Destinations saved by the user.
 * @param {Function} [props.isSaved] - Determines whether a destination is saved.
 * @param {Function} props.onToggleSaved - Toggles a destination's saved state.
 * @param {Function} props.onSubmit - Submits the current search query.
 * @param {Function} props.onSelect - Selects a destination.
 * @return {JSX.Element} The destination search interface.
 */
export default function DestinationSearch({
  query,
  onQueryChange,
  candidates = [],
  selectedDestination,
  searchStatus,
  savedDestinations = [],
  isSaved = () => false,
  onToggleSaved,
  onSubmit,
  onSelect,
}) {
  const submit = (event) => {
    event?.preventDefault();
    onSubmit(query);
  };
  const status = searchStatus?.status ?? 'idle';

  return (
    <section aria-label="Destination search">
      <label
        htmlFor="nearby-destination"
        style={{
          display: 'block',
          color: colors.muted,
          fontSize: 11,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
        }}
      >
        Where are you trying to go?
      </label>
      <form onSubmit={submit} style={{ display: 'flex', gap: 7, marginTop: 7 }}>
        <input
          id="nearby-destination"
          type="search"
          aria-label="Destination"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit(event);
          }}
          placeholder="Type in address or neighborhood"
          style={{
            minWidth: 0,
            flex: 1,
            boxSizing: 'border-box',
            border: `1px solid ${colors.border}`,
            borderRadius: 999,
            padding: '11px 16px',
            background: colors.white,
            color: colors.ink,
            fontFamily: fonts.sans,
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          style={{
            flexShrink: 0,
            border: 0,
            borderRadius: 999,
            padding: '11px 17px',
            background: colors.ink,
            color: colors.bg,
            cursor: status === 'loading' ? 'wait' : 'pointer',
            font: 'inherit',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {status === 'loading' ? '…' : 'Go'}
        </button>
      </form>

      {SEARCH_MESSAGES[status] && (
        <div
          role="status"
          style={{
            marginTop: 7,
            color: colors.mutedText,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {SEARCH_MESSAGES[status]}
          {status === 'error' && (
            <button
              type="button"
              aria-label="Retry address search"
              onClick={() => onSubmit(query)}
              style={{
                marginLeft: 7,
                border: 0,
                padding: 0,
                background: 'transparent',
                color: colors.teal,
                cursor: 'pointer',
                font: 'inherit',
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {candidates.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {candidates.map((candidate) => (
            <PlaceRow
              key={candidate.id}
              candidate={candidate}
              selected={selectedDestination?.id === candidate.id}
              saved={isSaved(candidate.id)}
              onSelect={onSelect}
              onToggleSaved={onToggleSaved}
            />
          ))}
        </div>
      )}

      {savedDestinations.length > 0 && (
        <section aria-label="Saved destinations" style={{ marginTop: 11 }}>
          <div
            style={{
              color: colors.muted,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
            }}
          >
            Saved places
          </div>
          {savedDestinations.map((candidate) => (
            <PlaceRow
              key={candidate.id}
              candidate={candidate}
              selected={selectedDestination?.id === candidate.id}
              saved
              onSelect={onSelect}
              onToggleSaved={onToggleSaved}
            />
          ))}
        </section>
      )}
    </section>
  );
}
