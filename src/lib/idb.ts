// Minimal IndexedDB blob store for uploaded documents (civil IDs, contracts…).
// Keeps localStorage free for structured data; swaps to Supabase Storage later
// by replacing these four functions.

const DB_NAME = "aqar-files";
const STORE = "blobs";

let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("no-idb"));
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export const putBlob = (key: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, key));
export const getBlob = (key: string) => tx<Blob | undefined>("readonly", (s) => s.get(key));
export const delBlob = (key: string) => tx("readwrite", (s) => s.delete(key));
export const allKeys = () => tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());

export async function openBlob(key: string, fileName: string) {
  const b = await getBlob(key);
  if (!b) throw new Error("الملف غير موجود");
  const url = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function blobUrl(key: string) {
  const b = await getBlob(key);
  return b ? URL.createObjectURL(b) : null;
}
