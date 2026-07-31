import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import TripModeSelector from '../TripModeSelector.jsx';

afterEach(cleanup);

describe('TripModeSelector', () => {
  it('keeps the approved mode order and exposes the active mode', () => {
    render(<TripModeSelector value="transit" onChange={vi.fn()} />);

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Transit',
      'Walk',
      'Rideshare',
    ]);
    expect(screen.getByRole('button', { name: 'Transit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Walk' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Rideshare' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('reports the selected mode', () => {
    const onChange = vi.fn();
    render(<TripModeSelector value="transit" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Walk' }));

    expect(onChange).toHaveBeenCalledWith('walk');
  });
});
