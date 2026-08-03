import { parseResultSnapshot, type ResultSnapshot } from './resultSnapshot';

const DATABASE_NAME = 'brigx-result-previews';
const STORE_NAME = 'snapshots';
const DATABASE_VERSION = 1;
const PREVIEW_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface StoredPreview {
  id: string;
  snapshot: ResultSnapshot;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open preview storage'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Preview storage failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Preview storage was cancelled'));
  });
}

export function createPreviewId(): string {
  return crypto.randomUUID();
}

export async function saveResultPreview(id: string, snapshot: ResultSnapshot): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({ id, snapshot } satisfies StoredPreview);

    const allRequest = store.getAll();
    allRequest.onsuccess = () => {
      const cutoff = Date.now() - PREVIEW_MAX_AGE_MS;
      for (const entry of allRequest.result as StoredPreview[]) {
        if (entry.snapshot.createdAt < cutoff) store.delete(entry.id);
      }
    };
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function loadResultPreview(id: string): Promise<ResultSnapshot | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(id);
    const stored = await new Promise<StoredPreview | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as StoredPreview | undefined);
      request.onerror = () => reject(request.error ?? new Error('Could not read preview'));
    });
    if (!stored) return null;
    return parseResultSnapshot(stored.snapshot);
  } finally {
    database.close();
  }
}
