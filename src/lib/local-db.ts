"use client";

/**
 * Local Database Layer — IndexedDB wrapper for offline-first storage.
 *
 * Stores a local copy of subscribers + a "pending changes" outbox
 * for sync when connectivity returns.
 *
 * Architecture:
 *   - subscribers store: cached subscriber records (keyed by id)
 *   - outbox store: pending mutations (POST/PUT/DELETE) to sync
 *   - meta store: lastSyncAt timestamp, device ID
 */

const DB_NAME = "rcs-club-local";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB not available"));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      // Subscribers cache (local copy of cloud data)
      if (!db.objectStoreNames.contains("subscribers")) {
        const store = db.createObjectStore("subscribers", { keyPath: "id" });
        store.createIndex("fileNumber", "fileNumber", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // Outbox — pending mutations to sync
      if (!db.objectStoreNames.contains("outbox")) {
        db.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
      }

      // Meta — last sync time, device ID
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

// ─── Subscribers cache ───

export async function cacheSubscribers(subs: any[]): Promise<void> {
  try {
    const list = Array.isArray(subs) ? subs : [];
    const db = await openDB();
    const tx = db.transaction("subscribers", "readwrite");
    const store = tx.objectStore("subscribers");
    // Clear + bulk insert
    store.clear();
    for (const s of list) store.put(s);
    await tx.done;
  } catch (e) {
    console.error("cacheSubscribers:", e);
  }
}

export async function getCachedSubscribers(): Promise<any[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("subscribers", "readonly");
    const store = tx.objectStore("subscribers");
    return await store.getAll();
  } catch {
    return [];
  }
}

// ─── Outbox (pending mutations) ───

export interface OutboxEntry {
  id?: number;
  url: string;
  method: "POST" | "PUT" | "DELETE";
  body?: any;
  createdAt: number;
}

export async function addToOutbox(entry: Omit<OutboxEntry, "id" | "createdAt">): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("outbox", "readwrite");
    tx.objectStore("outbox").add({ ...entry, createdAt: Date.now() });
    await tx.done;
  } catch (e) {
    console.error("addToOutbox:", e);
  }
}

export async function getOutbox(): Promise<OutboxEntry[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("outbox", "readonly");
    return await tx.objectStore("outbox").getAll();
  } catch {
    return [];
  }
}

export async function removeFromOutbox(id: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("outbox", "readwrite");
    tx.objectStore("outbox").delete(id);
    await tx.done;
  } catch (e) {
    console.error("removeFromOutbox:", e);
  }
}

export async function clearOutbox(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("outbox", "readwrite");
    tx.objectStore("outbox").clear();
    await tx.done;
  } catch {}
}

// ─── Meta (last sync, device ID) ───

export async function setMeta(key: string, value: any): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").put({ key, value });
    await tx.done;
  } catch {}
}

export async function getMeta(key: string): Promise<any> {
  try {
    const db = await openDB();
    const tx = db.transaction("meta", "readonly");
    const result = await tx.objectStore("meta").get(key);
    return result?.value ?? null;
  } catch {
    return null;
  }
}

export async function getDeviceId(): Promise<string> {
  let id = await getMeta("deviceId");
  if (!id) {
    id = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    await setMeta("deviceId", id);
  }
  return id;
}
