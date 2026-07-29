import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import alertFixture from '../../test/fixtures/511-alerts.json';
import { resetRequestCoordinatorForTests } from '../requestCoordinator.js';
import { providerResponseStore } from '../responseStore.js';
import {
  fetchServiceAlerts,
  fetchStopDepartures,
  normalizeServiceAlerts,
  normalizeStopDepartures,
} from '../transit511.js';

const apiKey = 'test-key-not-a-credential';
const fetchedAt = 10_000;
const alertNow = Date.parse('2026-07-28T19:00:00.000Z');
const stopPayload = {
  ServiceDelivery: {
    StopMonitoringDelivery: {
      MonitoredStopVisit: [
        {
          MonitoredVehicleJourney: {
            MonitoredCall: {
              ExpectedArrivalTime: '2026-07-28T18:59:00.000Z',
            },
          },
        },
        {
          MonitoredVehicleJourney: {
            MonitoredCall: {
              ExpectedArrivalTime: '2026-07-28T19:06:00.000Z',
            },
          },
        },
      ],
    },
  },
};

function transitResponse(payload, options = {}) {
  const text =
    typeof payload === 'string' ? payload : JSON.stringify(payload);
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    text: vi.fn().mockResolvedValue(text),
  };
}

describe('511 normalization', () => {
  it('clamps departed Stop Monitoring predictions at zero minutes', () => {
    expect(normalizeStopDepartures(stopPayload, alertNow)).toEqual([0, 6]);
  });

  it('normalizes current capitalized GTFS-realtime alerts and prefers English', () => {
    expect(normalizeServiceAlerts(alertFixture, alertNow)).toEqual([
      expect.objectContaining({
        id: 'sf-k-delay',
        agency: 'SF',
        affectedLines: ['K'],
        severity: 'SIGNIFICANT_DELAYS',
        header: 'K Ingleside delay',
        description: 'Allow extra travel time on the K line.',
        url: 'https://example.invalid/transit/k-delay',
        updatedAt: '2026-07-28T19:00:00.000Z',
      }),
      expect.objectContaining({
        id: 'sf-43-reroute',
        agency: 'SF',
        affectedLines: ['43'],
      }),
    ]);
  });

  it('filters alerts without a currently active period', () => {
    const payload = structuredClone(alertFixture);
    payload.Entities[1].Alert.ActivePeriods = [
      { Start: '1785250800', End: '1785254400' },
    ];

    expect(
      normalizeServiceAlerts(payload, alertNow).map((alert) => alert.id),
    ).toEqual(['sf-k-delay']);
  });
});

describe('511 requests', () => {
  beforeEach(async () => {
    resetRequestCoordinatorForTests();
    await providerResponseStore.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('strips a BOM and returns normalized Stop Monitoring metadata', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(transitResponse(`\uFEFF${JSON.stringify(stopPayload)}`));

    await expect(
      fetchStopDepartures('15794', 'SF', {
        apiKey,
        fetchImpl,
        now: () => alertNow,
      }),
    ).resolves.toEqual({
      ok: true,
      minutesList: [0, 6],
      source: 'network',
      fetchedAt: alertNow,
      expiresAt: alertNow + 5 * 60_000,
    });
  });

  it('returns normalized service alerts from the capitalized endpoint payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(transitResponse(alertFixture));

    const result = await fetchServiceAlerts('SF', {
      apiKey,
      fetchImpl,
      now: () => alertNow,
    });

    expect(result).toMatchObject({
      ok: true,
      alerts: normalizeServiceAlerts(alertFixture, alertNow),
      source: 'network',
      fetchedAt: alertNow,
      expiresAt: alertNow + 10 * 60_000,
    });
  });

  it.each([
    ['departures', () => fetchStopDepartures('15794', 'SF')],
    ['alerts', () => fetchServiceAlerts('SF')],
  ])('rejects a missing API key for %s', async (_name, request) => {
    vi.stubEnv('VITE_API_511_KEY', '');
    await expect(request()).resolves.toEqual({
      ok: false,
      reason: 'missing-api-key',
    });
    vi.unstubAllEnvs();
  });

  it('rejects a missing stop code without fetching', async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchStopDepartures('', 'SF', { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'missing-stop-code' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'rate-limited'],
    [500, 'network'],
  ])('maps an HTTP %i response to %s', async (status, reason) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(transitResponse('', { ok: false, status }));

    await expect(
      fetchServiceAlerts('SF', { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason });
  });

  it.each([
    ['AbortError', 'timeout'],
    ['TypeError', 'network'],
  ])('maps a %s fetch failure to %s', async (name, reason) => {
    const error = new Error('synthetic failure');
    error.name = name;
    const fetchImpl = vi.fn().mockRejectedValue(error);

    await expect(
      fetchStopDepartures('15794', 'SF', { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason });
  });

  it('maps invalid JSON to invalid-response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(transitResponse('{broken'));

    await expect(
      fetchServiceAlerts('SF', { apiKey, fetchImpl }),
    ).resolves.toEqual({ ok: false, reason: 'invalid-response' });
  });

  it('deduplicates and caches departures without persisting the API key', async () => {
    let resolveResponse;
    const fetchImpl = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );
    const options = { apiKey, fetchImpl, now: () => alertNow };

    const first = fetchStopDepartures('15794', 'SF', options);
    const second = fetchStopDepartures('15794', 'SF', options);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    resolveResponse(transitResponse(stopPayload));

    expect(await first).toEqual(await second);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const entry = await providerResponseStore.get('511:departures:SF:15794');
    expect(entry).toMatchObject({
      data: { minutesList: [0, 6] },
      fetchedAt: alertNow,
      expiresAt: alertNow + 5 * 60_000,
      staleUntil: alertNow + 30 * 60_000,
    });
    expect(JSON.stringify(entry)).not.toContain(apiKey);
  });

  it('returns stale departures only after refresh failure and within 30 minutes', async () => {
    let currentTime = alertNow;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(transitResponse(stopPayload))
      .mockRejectedValue(new TypeError('offline'));
    const options = { apiKey, fetchImpl, now: () => currentTime };

    const live = await fetchStopDepartures('15794', 'SF', options);
    const cached = await fetchStopDepartures('15794', 'SF', options);
    currentTime += 5 * 60_000;
    const stale = await fetchStopDepartures('15794', 'SF', options);
    currentTime = alertNow + 30 * 60_000;
    const expired = await fetchStopDepartures('15794', 'SF', options);

    expect(live.source).toBe('network');
    expect(cached.source).toBe('cache');
    expect(stale).toMatchObject({
      ok: true,
      minutesList: [0, 6],
      source: 'stale',
      reason: 'network',
    });
    expect(expired).toEqual({ ok: false, reason: 'network' });
  });

  it('keeps alerts fresh for 10 minutes and stale for at most 60 minutes', async () => {
    let currentTime = fetchedAt;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(transitResponse(alertFixture))
      .mockRejectedValue(new TypeError('offline'));
    const options = { apiKey, fetchImpl, now: () => currentTime };

    await fetchServiceAlerts('SF', options);
    currentTime += 9 * 60_000;
    expect((await fetchServiceAlerts('SF', options)).source).toBe('cache');
    currentTime = fetchedAt + 10 * 60_000;
    expect((await fetchServiceAlerts('SF', options)).source).toBe('stale');
    currentTime = fetchedAt + 60 * 60_000;
    expect(await fetchServiceAlerts('SF', options)).toEqual({
      ok: false,
      reason: 'network',
    });
  });
});
