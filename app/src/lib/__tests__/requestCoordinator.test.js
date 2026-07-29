import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  dedupeRequest,
  resetRequestCoordinatorForTests,
} from '../requestCoordinator.js';

describe('dedupeRequest', () => {
  beforeEach(() => {
    resetRequestCoordinatorForTests();
  });

  it('runs one loader for concurrent requests with the same key', async () => {
    const loader = vi.fn(async () => ({ ok: true }));

    const [first, second] = await Promise.all([
      dedupeRequest('511:SF:15794', loader),
      dedupeRequest('511:SF:15794', loader),
    ]);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('removes a request after it settles', async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ request: 1 })
      .mockResolvedValueOnce({ request: 2 });

    await dedupeRequest('weather:current', loader);
    const second = await dedupeRequest('weather:current', loader);

    expect(loader).toHaveBeenCalledTimes(2);
    expect(second).toEqual({ request: 2 });
  });

  it('removes a rejected request so a later call can retry', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ request: 2 });

    await expect(dedupeRequest('alerts:SF', loader)).rejects.toThrow(
      'temporary failure',
    );
    await expect(dedupeRequest('alerts:SF', loader)).resolves.toEqual({
      request: 2,
    });
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
