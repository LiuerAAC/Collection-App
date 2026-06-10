const DB_NAME = "collection-app-pwa";
const DB_VERSION = 1;
const STORE_NAME = "kv";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function withStore<T>(mode: IDBTransactionMode, task: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = task(store);

    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    request.onsuccess = () => resolve(request.result);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

export async function getIndexedRecord<T>(key: string) {
  return withStore<T | undefined>("readonly", (store) => store.get(key));
}

export async function setIndexedRecord<T>(key: string, value: T) {
  return withStore<IDBValidKey>("readwrite", (store) => store.put(value, key));
}

export async function deleteIndexedRecord(key: string) {
  return withStore<undefined>("readwrite", (store) => store.delete(key) as IDBRequest<undefined>);
}

export async function listIndexedKeys(prefix: string) {
  const database = await openDatabase();
  return new Promise<string[]>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();
    const keys: string[] = [];

    request.onerror = () => reject(request.error ?? new Error("IndexedDB cursor failed"));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(keys);
        return;
      }
      if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) {
        keys.push(cursor.key);
      }
      cursor.continue();
    };
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB cursor transaction failed"));
  });
}
