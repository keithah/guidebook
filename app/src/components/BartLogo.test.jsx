import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import BartLogo from './BartLogo.jsx';

afterEach(cleanup);

describe('BartLogo', () => {
  it('renders the bundled SVG with a standalone accessible name', () => {
    render(<BartLogo height={24} />);
    const logo = screen.getByRole('img', { name: 'BART' });
    expect(logo.getAttribute('src')).toMatch(/bart-logo\.svg$/);
    expect(logo).toHaveStyle({ height: '24px', width: 'auto' });
  });

  it('is ignored when an accessible parent already names BART', () => {
    render(<BartLogo decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute('alt', '');
  });
});
