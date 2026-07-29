import { dedupeRequest } from './requestCoordinator.js';

export function providerFailureReason(error) {
  return error?.name === 'AbortError' ? 'aborted' : 'network';
}

export function providerHttpFailure(response) {
  if (response.status === 401 || response.status === 403) {
    return 'unauthorized';
  }
  if (response.status === 429) return 'rate-limited';
  return response.ok ? null : 'network';
}

export function isFinitePosition(position) {
  return Number.isFinite(position?.lat) && Number.isFinite(position?.lng);
}

export function settleForCaller(request, signal) {
  if (!signal) return request;
  if (signal.aborted) {
    return Promise.resolve({ ok: false, reason: 'aborted' });
  }

  let onAbort;
  const aborted = new Promise((resolve) => {
    onAbort = () => resolve({ ok: false, reason: 'aborted' });
    signal.addEventListener('abort', onAbort, { once: true });
  });

  return Promise.race([request, aborted]).finally(() => {
    signal.removeEventListener('abort', onAbort);
  });
}

function withProviderDeadline(loader, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  let timeout;
  const timeoutResult = new Promise((resolve) => {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      resolve({ ok: false, reason: 'timeout' });
    }, timeoutMs);
  });
  const operation = Promise.resolve().then(() =>
    loader({
      signal: controller.signal,
      didTimeout: () => timedOut,
    }),
  );

  return Promise.race([operation, timeoutResult]).finally(() => {
    clearTimeout(timeout);
  });
}

export function sharedProviderRequest({ key, signal, timeoutMs, loader }) {
  const request = dedupeRequest(key, () =>
    withProviderDeadline(loader, timeoutMs),
  ).catch((error) => ({ ok: false, reason: providerFailureReason(error) }));
  return settleForCaller(request, signal);
}
