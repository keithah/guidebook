import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import fixture from '../../../test/fixtures/511-alerts.json';
import { normalizeServiceAlerts } from '../../../lib/transit511.js';
import TransitAlerts from '../TransitAlerts.jsx';

const now = Date.parse('2026-07-28T19:00:00.000Z');
const alerts = normalizeServiceAlerts(fixture, now, 'SF');
const generalAlert = {
  id: 'sf-system-notice',
  agency: 'SF',
  affectedLines: [],
  severity: 'OTHER_EFFECT',
  header: 'Systemwide fare machines update',
  description: 'Some fare machines may take longer to respond.',
  activePeriod: {
    start: '2026-07-28T18:00:00.000Z',
    end: '2026-07-28T22:00:00.000Z',
  },
  url: 'https://example.test/system-notice',
  updatedAt: '2026-07-28T18:55:00.000Z',
};

afterEach(cleanup);

describe('TransitAlerts', () => {
  it('shows only alerts for the requested line and expands details deliberately', () => {
    const { container } = render(
      <TransitAlerts alerts={[...alerts, generalAlert]} lineIds={['K']} />,
    );

    expect(screen.getByText('K Ingleside delay')).toBeVisible();
    expect(screen.queryByText('43 Masonic reroute')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Systemwide fare machines update'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Allow extra travel time on the K line.'),
    ).not.toBeInTheDocument();

    const details = screen.getByRole('button', {
      name: /show details for k ingleside delay/i,
    });
    expect(details).toHaveAttribute('aria-expanded', 'false');
    const controlledDetails = document.getElementById(
      details.getAttribute('aria-controls'),
    );
    expect(controlledDetails).toBeInTheDocument();
    expect(controlledDetails).toHaveAttribute('hidden');
    fireEvent.click(details);
    expect(details).toHaveAttribute('aria-expanded', 'true');
    expect(controlledDetails).not.toHaveAttribute('hidden');
    expect(
      screen.getByText('Allow extra travel time on the K line.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: /read alert/i })).toHaveAttribute(
      'href',
      'https://example.invalid/transit/k-delay',
    );
    expect(
      container.querySelector('time[datetime="2026-07-28T21:00:00.000Z"]'),
    ).toBeInTheDocument();
  });

  it('uses standalone mode for alerts that affect the whole system', () => {
    render(
      <TransitAlerts
        alerts={[...alerts, generalAlert]}
        status="live"
        updatedAt={Date.parse('2026-07-28T18:58:00.000Z')}
      />,
    );

    expect(screen.getByText('Systemwide fare machines update')).toBeVisible();
    expect(screen.getByText('K Ingleside delay')).toBeVisible();
    expect(screen.getByText('43 Masonic reroute')).toBeVisible();
    expect(screen.getByRole('status', { name: /live/i })).toBeVisible();
  });

  it('labels last-known alerts and explains a failed live refresh', () => {
    render(
      <TransitAlerts
        alerts={alerts}
        status="stale"
        updatedAt={Date.parse('2026-07-28T18:58:00.000Z')}
        error="network"
      />,
    );

    expect(screen.getByRole('status', { name: /last known/i })).toBeVisible();
    expect(screen.getByText(/live alert update is unavailable/i)).toBeVisible();
    expect(screen.getByText('K Ingleside delay')).toBeVisible();
  });

  it('keeps unmatched alerts standalone while an expanded line owns its alert', () => {
    render(
      <TransitAlerts
        alerts={[...alerts, generalAlert]}
        status="cached"
        updatedAt={Date.parse('2026-07-28T18:58:00.000Z')}
        excludeLineIds={['K']}
      />,
    );

    expect(screen.queryByText('K Ingleside delay')).not.toBeInTheDocument();
    expect(screen.getByText('43 Masonic reroute')).toBeVisible();
    expect(screen.getByText('Systemwide fare machines update')).toBeVisible();
  });

  it('matches no alerts when trip mode receives no line IDs', () => {
    render(<TransitAlerts alerts={[...alerts, generalAlert]} lineIds={[]} />);

    expect(
      screen.queryByText('Systemwide fare machines update'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('K Ingleside delay')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Alerts for this trip' }),
    ).not.toBeInTheDocument();
  });
});
