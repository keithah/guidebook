import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import property from '../../data/properties/sfcottage.json';
import { useApp } from '../../context/AppContext.jsx';
import HowToRide from './HowToRide.jsx';

vi.mock('../../context/AppContext.jsx', () => ({
  useApp: vi.fn(),
}));

afterEach(cleanup);

describe('HowToRide', () => {
  it('renders one standalone BART logo with an accessible name', () => {
    useApp.mockReturnValue({ property, backToAround: vi.fn() });

    render(<HowToRide />);

    const logos = screen.getAllByRole('img', { name: 'BART' });
    expect(logos).toHaveLength(1);
    expect(logos[0].getAttribute('src')).toMatch(/bart-logo\.svg$/);
  });
});
