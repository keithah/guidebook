import { dedupeRequest } from './requestCoordinator.js';

/**
 * Classifies a provider error by its failure reason.
 * @param {Error} error - The provider error to classify.
 * @return {'aborted'|'network'} `'aborted'` when the error is an abort error, `'network'` otherwise.
 */
export function providerFailureReason(error) {
  return error?.name === 'AbortError' ? 'aborted' : 'network';
}

/**
 * Classifies an HTTP response as a provider failure.
 * @param {Response} response - The provider response to classify.
 * @return {'unauthorized'|'rate-limited'|'network'|null} The failure reason, or `null` for a successful response.
 */
export function providerHttpFailure(response) {
  if (response.status === 401 || response.status === 403) {
    return 'unauthorized';
  }
  if (response.status === 429) return 'rate-limited';
  return response.ok ? null : 'network';
}

/**
 * Determines whether a position contains finite latitude and longitude values.
 * @param {Object} position - The position to validate.
 * @returns {boolean} `true` if both coordinates are finite numbers, `false` otherwise.
 */
export function isFinitePosition(position) {
  return Number.isFinite(position?.lat) && Number.isFinite(position?.lng);
}

/**
 * Resolves a request with a standardized result when the caller aborts.
 * @param {Promise} request - The request promise to settle.
 * @param {AbortSignal} signal - The caller's abort signal, if available.
 * @return {Promise} The request result, or `{ ok: false, reason: 'aborted' }` when aborted first.
 */
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

/**
 * Runs a provider loader with a deadline and standardized timeout result.
 * @param {Function} loader - Provider operation that receives an abort signal and a function indicating whether the deadline elapsed.
 * @param {number} timeoutMs - Maximum time to allow the provider operation to complete.
 * @return {Promise<*>} The loader result, or `{ ok: false, reason: 'timeout' }` if the deadline expires first.
 */
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

/**
 * Coordinates a deduplicated provider request with a deadline and caller cancellation.
 * @param {Object} options - Request configuration.
 * @param {string} options.key - Key used to deduplicate identical requests.
 * @param {AbortSignal} [options.signal] - Signal that can cancel the caller's request.
 * @param {number} options.timeoutMs - Maximum time allowed for the provider request.
 * @param {Function} options.loader - Function that performs the provider request.
 * @return {Promise<Object>} The provider result, or a failure result with reason `aborted`, `timeout`, `unauthorized`, `rate-limited`, or `network`.
 */
export function sharedProviderRequest({ key, signal, timeoutMs, loader }) {
  const request = dedupeRequest(key, () =>
    withProviderDeadline(loader, timeoutMs),
  ).catch((error) => ({ ok: false, reason: providerFailureReason(error) }));
  return settleForCaller(request, signal);
}
