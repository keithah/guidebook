const inFlight = new Map();

/**
 * Deduplicate concurrent requests that use the same key.
 * @param {*} key - The identifier used to group requests.
 * @param {Function} loader - Produces the request result.
 * @return {Promise<*>} The shared request result.
 */
export function dedupeRequest(key, loader) {
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = Promise.resolve()
    .then(loader)
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

/**
 * Clears all tracked in-flight requests for test isolation.
 */
export function resetRequestCoordinatorForTests() {
  inFlight.clear();
}
