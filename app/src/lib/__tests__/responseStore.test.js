import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { providerResponseStore, savedStateStore } from '../responseStore.js';

describe('response stores', () => {
  beforeEach(async () => {
    await providerResponseStore.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips a normalized provider response entry', async () => {
    const entry = {
      key: '511:SF:15794',
      data: { departures: [{ route: 'F', minutes: 3 }] },
      fetchedAt: 1_000,
      expiresAt: 121_000,
      staleUntil: 421_000,
    };

    await providerResponseStore.put(entry);

    expect(await providerResponseStore.get(entry.key)).toEqual(entry);
  });

  it('stores only normalized provider response fields', async () => {
    const entry = {
      key: 'geocode:mission',
      data: { latitude: 37.759, longitude: -122.419 },
      fetchedAt: 1_000,
      expiresAt: 2_000,
      staleUntil: 3_000,
      rawUrl: 'https://provider.example/search?q=mission',
      requestHeaders: { authorization: 'secret' },
    };

    await providerResponseStore.put(entry);

    expect(await providerResponseStore.get(entry.key)).toEqual({
      key: 'geocode:mission',
      data: { latitude: 37.759, longitude: -122.419 },
      fetchedAt: 1_000,
      expiresAt: 2_000,
      staleUntil: 3_000,
    });
  });

  it('deletes an expired provider response entry', async () => {
    const entry = {
      key: 'weather:37.759:-122.429',
      data: { temperature: 61 },
      fetchedAt: 1_000,
      expiresAt: 2_000,
      staleUntil: 3_000,
    };
    await providerResponseStore.put(entry);

    await providerResponseStore.delete(entry.key);

    expect(await providerResponseStore.get(entry.key)).toBeUndefined();
  });

  it('keeps saved state in a separate store', async () => {
    const key = 'shared-key';
    const providerEntry = {
      key,
      data: { kind: 'provider' },
      fetchedAt: 1_000,
      expiresAt: 2_000,
      staleUntil: 3_000,
    };
    const savedValue = { kind: 'saved', selectedStop: '15794' };
    await providerResponseStore.put(providerEntry);

    await savedStateStore.put(key, savedValue);

    expect(await providerResponseStore.get(key)).toEqual(providerEntry);
    expect(await savedStateStore.get(key)).toEqual(savedValue);
    await savedStateStore.delete(key);
    expect(await savedStateStore.get(key)).toBeUndefined();
  });

  it('retries opening IndexedDB after a transient initialization failure', async () => {
    const realIndexedDb = globalThis.indexedDB;
    let attempts = 0;
    const transientIndexedDb = {
      open(...args) {
        attempts += 1;
        if (attempts > 1) return realIndexedDb.open(...args);

        const request = {};
        queueMicrotask(() => {
          request.error = new Error('temporary IndexedDB failure');
          request.onerror?.();
        });
        return request;
      },
    };
    vi.stubGlobal('indexedDB', transientIndexedDb);
    vi.resetModules();
    const { providerResponseStore: retryingStore } =
      await import('../responseStore.js');

    await expect(retryingStore.get('retry-key')).rejects.toThrow(
      'temporary IndexedDB failure',
    );
    await expect(retryingStore.get('retry-key')).resolves.toBeUndefined();
    expect(attempts).toBe(2);
  });
});
