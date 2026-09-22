export type OfflineSnapshot = {
  version: 1;
  tenantSlug: string;
  userId: string;
  tenantName: string;
  generatedAt: string;
  summary: {
    total: number;
    urgent: number;
    critical: number;
    byKind: Record<string, number>;
  };
};

export type OfflineDraft = {
  id: string;
  tenantSlug: string;
  userId: string;
  kind: "note" | "task" | "content";
  body: string;
  updatedAt: string;
  status: "local";
};

const DATABASE_NAME = "accelerate-command-center";
const DATABASE_VERSION = 1;
const SNAPSHOTS = "snapshots";
const DRAFTS = "drafts";

function workspaceKey(tenantSlug: string, userId: string) {
  return `${tenantSlug}:${userId}`;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  return new Promise<IDBDatabase | null>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOTS)) database.createObjectStore(SNAPSHOTS);
      if (!database.objectStoreNames.contains(DRAFTS))
        database.createObjectStore(DRAFTS, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(() => null);
}

function transaction<T>(
  store: string,
  mode: IDBTransactionMode,
  operation: (objectStore: IDBObjectStore) => IDBRequest<T>,
) {
  return openDatabase().then((database) =>
    new Promise<T | null>((resolve, reject) => {
      if (!database) return resolve(null);
      const request = operation(database.transaction(store, mode).objectStore(store));
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    }).finally(() => database?.close()),
  );
}

export async function saveOfflineSnapshot(snapshot: OfflineSnapshot) {
  return transaction(SNAPSHOTS, "readwrite", (store) =>
    store.put(snapshot, workspaceKey(snapshot.tenantSlug, snapshot.userId)),
  );
}

export async function readOfflineSnapshot(tenantSlug: string, userId: string) {
  return transaction<OfflineSnapshot>(SNAPSHOTS, "readonly", (store) =>
    store.get(workspaceKey(tenantSlug, userId)),
  );
}

export async function saveOfflineDraft(draft: OfflineDraft) {
  if (!draft.body.trim() || draft.body.length > 5000) return false;
  await transaction(DRAFTS, "readwrite", (store) => store.put(draft));
  return true;
}

export async function listOfflineDrafts(tenantSlug: string, userId: string) {
  const database = await openDatabase();
  if (!database) return [];
  return new Promise<OfflineDraft[]>((resolve, reject) => {
    const request = database.transaction(DRAFTS, "readonly").objectStore(DRAFTS).getAll();
    request.onsuccess = () => {
      resolve(
        (request.result as OfflineDraft[]).filter(
          (draft) => draft.tenantSlug === tenantSlug && draft.userId === userId,
        ),
      );
      database.close();
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  }).catch(() => []);
}

export async function clearOfflineWorkspace(tenantSlug: string, userId: string) {
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    const store = database.transaction([SNAPSHOTS, DRAFTS], "readwrite");
    store.objectStore(SNAPSHOTS).delete(workspaceKey(tenantSlug, userId));
    const drafts = store.objectStore(DRAFTS).getAll();
    drafts.onsuccess = () => {
      for (const draft of drafts.result as OfflineDraft[])
        if (draft.tenantSlug === tenantSlug && draft.userId === userId)
          store.objectStore(DRAFTS).delete(draft.id);
    };
    store.oncomplete = () => resolve();
    store.onerror = () => resolve();
  });
  database.close();
}
