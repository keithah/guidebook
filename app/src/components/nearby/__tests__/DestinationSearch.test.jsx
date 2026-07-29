import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DestinationSearch from '../DestinationSearch.jsx';

const unionSquare = {
  id: 'here:union-square',
  title: 'Union Square',
  address: '333 Post St, San Francisco, CA',
  position: { lat: 37.7879, lng: -122.4075 },
  resultType: 'place',
  categories: ['Landmark'],
  distanceMeters: 8_100,
};

afterEach(cleanup);

function renderSearch(overrides = {}) {
  const props = {
    query: 'Union Square',
    onQueryChange: vi.fn(),
    candidates: [unionSquare],
    selectedDestination: null,
    searchStatus: { status: 'success' },
    savedDestinations: [],
    isSaved: vi.fn().mockReturnValue(false),
    onToggleSaved: vi.fn(),
    onSubmit: vi.fn(),
    onSelect: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  render(<DestinationSearch {...props} />);
  return props;
}

describe('DestinationSearch', () => {
  it('preserves the controlled query and submits it from Enter and Go', () => {
    const props = renderSearch();
    const input = screen.getByRole('searchbox', { name: /destination/i });

    expect(input).toHaveValue('Union Square');
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(props.onSubmit).toHaveBeenNthCalledWith(1, 'Union Square');
    expect(props.onSubmit).toHaveBeenNthCalledWith(2, 'Union Square');
  });

  it('shows candidate details without preselecting and selects from a native button', () => {
    const props = renderSearch();
    const option = screen.getByRole('button', {
      name: /choose union square/i,
    });

    expect(within(option).getByText('Union Square')).toBeVisible();
    expect(
      within(option).getByText('333 Post St, San Francisco, CA'),
    ).toBeVisible();
    expect(option).not.toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(option, { key: 'Enter' });
    fireEvent.click(option);
    expect(props.onSelect).toHaveBeenCalledWith(unionSquare);
  });

  it.each([
    [{ status: 'loading' }, 'Looking for places…'],
    [
      { status: 'empty' },
      'No nearby matches. Try adding a street or neighborhood.',
    ],
    [
      { status: 'error', reason: 'network' },
      'Place search needs a connection. Saved places and nearby transit are still available.',
    ],
  ])('shows calm %s feedback', (searchStatus, copy) => {
    renderSearch({ searchStatus, candidates: [] });
    expect(screen.getByRole('status')).toHaveTextContent(copy);
  });

  it('retries an error without erasing the query', () => {
    const props = renderSearch({
      query: 'Ocean Beach',
      candidates: [],
      searchStatus: { status: 'error', reason: 'network' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /retry place search/i }),
    );
    expect(props.onSubmit).toHaveBeenCalledWith('Ocean Beach');
    expect(props.onQueryChange).not.toHaveBeenCalled();
    expect(screen.getByRole('searchbox')).toHaveValue('Ocean Beach');
  });

  it('labels save actions and keeps saved destinations selectable offline', () => {
    const saved = {
      ...unionSquare,
      id: 'here:saved',
      title: 'Saved Union Square',
    };
    const props = renderSearch({
      candidates: [],
      savedDestinations: [saved],
      searchStatus: { status: 'error', reason: 'network' },
      isSaved: vi.fn((id) => id === saved.id),
    });

    fireEvent.click(
      screen.getByRole('button', { name: /choose saved union square/i }),
    );
    expect(props.onSelect).toHaveBeenCalledWith(saved);
    fireEvent.click(
      screen.getByRole('button', {
        name: /remove saved union square from saved places/i,
      }),
    );
    expect(props.onToggleSaved).toHaveBeenCalledWith(saved);
  });

  it('labels the online save action', () => {
    const onlineProps = renderSearch();
    fireEvent.click(screen.getByRole('button', { name: /save union square/i }));
    expect(onlineProps.onToggleSaved).toHaveBeenCalledWith(unionSquare);
  });

  it('omits a missing address from the candidate accessible name', () => {
    const candidate = { ...unionSquare, address: undefined };
    renderSearch({ candidates: [candidate] });

    const option = screen.getByRole('button', { name: 'Choose Union Square' });
    expect(option).not.toHaveAccessibleName(/undefined/i);
  });

  it('renders safely when optional collections and saved lookup are omitted', () => {
    renderSearch({
      candidates: undefined,
      savedDestinations: undefined,
      isSaved: undefined,
    });

    expect(
      screen.getByRole('searchbox', { name: /destination/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /choose/i }),
    ).not.toBeInTheDocument();
  });
});
