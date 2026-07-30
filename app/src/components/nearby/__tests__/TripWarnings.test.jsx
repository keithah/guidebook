import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import TripWarnings from '../TripWarnings.jsx';

const warnings = [
  {
    id: 'sf-k-delay',
    header: 'K Ingleside delay',
    description: 'Allow extra travel time on the K line.',
    severity: 'SIGNIFICANT_DELAYS',
    source: '511',
    url: 'https://example.test/k-delay',
  },
  {
    id: 'here-platform',
    header: 'Boarding platform changed',
    description: 'Board from platform 2.',
    severity: 'modifiedService',
    source: 'HERE',
    url: '',
  },
];

afterEach(cleanup);

describe('TripWarnings', () => {
  it('renders nothing for an empty warning list', () => {
    const { container } = render(<TripWarnings warnings={[]} compact />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders visible warning headers in compact mode without details or links', () => {
    render(<TripWarnings warnings={warnings} compact />);

    expect(
      screen.getByRole('region', { name: 'Warnings for this trip' }),
    ).toBeVisible();
    expect(screen.getByText('K Ingleside delay')).toBeVisible();
    expect(screen.getByText('Boarding platform changed')).toBeVisible();
    expect(
      screen.queryByText('Allow extra travel time on the K line.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders warning descriptions, sources, and safe links in expanded mode', () => {
    render(<TripWarnings warnings={warnings} />);

    expect(screen.getByText('Allow extra travel time on the K line.')).toBeVisible();
    expect(screen.getByText('Board from platform 2.')).toBeVisible();
    expect(screen.getByText('511')).toBeVisible();
    expect(screen.getByText('HERE')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Read K Ingleside delay warning' }),
    ).toHaveAttribute('href', 'https://example.test/k-delay');
    expect(
      screen.getByRole('link', { name: 'Read K Ingleside delay warning' }),
    ).toHaveAttribute('rel', 'noreferrer');
  });
});
