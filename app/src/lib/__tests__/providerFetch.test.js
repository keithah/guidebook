import { describe, expect, it, vi } from 'vitest';
import { sharedProviderRequest } from '../providerFetch.js';

describe('sharedProviderRequest', () => {
  it('does not start provider work for an already-aborted caller', async () => {
    const controller = new AbortController();
    controller.abort();
    const loader = vi.fn();

    await expect(
      sharedProviderRequest({
        key: 'provider:aborted',
        signal: controller.signal,
        timeoutMs: 10_000,
        loader,
      }),
    ).resolves.toEqual({ ok: false, reason: 'aborted' });
    expect(loader).not.toHaveBeenCalled();
  });
});
