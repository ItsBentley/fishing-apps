/* Keep records and photo blobs in a site-local database; no catch data is sent to a server. */
const catchStore = (() => {
  const DATABASE_NAME = 'bentleys-catch-log';
  const STORE_NAME = 'catches';
  const VENUE_STORE_NAME = 'venues';
  let databasePromise;

  function rememberVenue(store, venue) {
    const name = venue.trim();
    if (name) store.put({ key: name.toLocaleLowerCase(), name, lastUsed: Date.now() });
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(VENUE_STORE_NAME)) {
          db.createObjectStore(VENUE_STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open the catch log database.'));
      request.onblocked = () => reject(new Error('Close other Catch Log tabs to finish opening the database.'));
    });
    return databasePromise;
  }

  async function readAll() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not read saved catches.'));
      transaction.onabort = () => reject(transaction.error || new Error('Could not read saved catches.'));
    });
  }

  async function save(record) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, VENUE_STORE_NAME], 'readwrite');
      transaction.objectStore(STORE_NAME).put(record);
      rememberVenue(transaction.objectStore(VENUE_STORE_NAME), record.venue || '');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not save the catch.'));
      transaction.onabort = () => reject(transaction.error || new Error('Could not save the catch.'));
    });
  }

  async function remove(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not delete the catch.'));
      transaction.onabort = () => reject(transaction.error || new Error('Could not delete the catch.'));
    });
  }

  async function merge(records, rememberedVenues = []) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, VENUE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const venues = transaction.objectStore(VENUE_STORE_NAME);
      records.forEach((record) => {
        store.put(record);
        rememberVenue(venues, record.venue || '');
      });
      rememberedVenues.forEach((venue) => rememberVenue(venues, venue));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Could not import the backup.'));
      transaction.onabort = () => reject(transaction.error || new Error('Could not import the backup.'));
    });
  }

  async function readVenues() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(VENUE_STORE_NAME, 'readonly');
      const request = transaction.objectStore(VENUE_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not read saved venues.'));
      transaction.onabort = () => reject(transaction.error || new Error('Could not read saved venues.'));
    });
  }

  return { merge, readAll, readVenues, remove, save };
})();
