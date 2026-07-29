const DATABASE_NAME = 'sfcottage-guidebook';
const DATABASE_VERSION = 1;
const PROVIDER_RESPONSES = 'providerResponses';
const SAVED_STATE = 'savedState';

let databasePromise;

/**
 * Opens the IndexedDB database and creates the required object stores when needed.
 * @return {Promise<IDBDatabase>} The opened database connection.
 */
function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROVIDER_RESPONSES)) {
        database.createObjectStore(PROVIDER_RESPONSES, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(SAVED_STATE)) {
        database.createObjectStore(SAVED_STATE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    databasePromise = undefined;
    throw error;
  });

  return databasePromise;
}

/**
 * Executes an operation within a transaction on the specified object store.
 * @param {string} storeName - The name of the object store to access.
 * @param {IDBTransactionMode} mode - The transaction access mode.
 * @param {function(IDBObjectStore): IDBRequest} operation - The operation to perform on the object store.
 * @return {Promise<*>} The result of the IndexedDB request.
 */
async function runTransaction(storeName, mode, operation) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));

    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error ?? request.error);
    transaction.onabort = () => reject(transaction.error ?? request.error);
  });
}

export const providerResponseStore = {
  get(key) {
    return runTransaction(PROVIDER_RESPONSES, 'readonly', (store) =>
      store.get(key),
    );
  },

  put(entry) {
    const normalizedEntry = {
      key: entry.key,
      data: entry.data,
      fetchedAt: entry.fetchedAt,
      expiresAt: entry.expiresAt,
      staleUntil: entry.staleUntil,
    };
    return runTransaction(PROVIDER_RESPONSES, 'readwrite', (store) =>
      store.put(normalizedEntry),
    );
  },

  delete(key) {
    return runTransaction(PROVIDER_RESPONSES, 'readwrite', (store) =>
      store.delete(key),
    );
  },

  clear() {
    return runTransaction(PROVIDER_RESPONSES, 'readwrite', (store) =>
      store.clear(),
    );
  },
};

export const savedStateStore = {
  async get(key) {
    const entry = await runTransaction(SAVED_STATE, 'readonly', (store) =>
      store.get(key),
    );
    return entry?.value;
  },

  put(key, value) {
    return runTransaction(SAVED_STATE, 'readwrite', (store) =>
      store.put({ key, value }),
    );
  },

  delete(key) {
    return runTransaction(SAVED_STATE, 'readwrite', (store) =>
      store.delete(key),
    );
  },
};
