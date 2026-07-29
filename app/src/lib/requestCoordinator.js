const inFlight = new Map();

export function dedupeRequest(key, loader) {
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = Promise.resolve()
    .then(loader)
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

export function resetRequestCoordinatorForTests() {
  inFlight.clear();
}
