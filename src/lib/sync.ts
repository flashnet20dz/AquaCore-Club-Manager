"use client";

/**
 * Sync Engine — bidirectional sync between local IndexedDB and cloud API.
 *
 * Flow:
 *   1. Push: send outbox entries (pending mutations) to cloud
 *   2. Pull: fetch latest subscribers from cloud
 *   3. Update local cache + lastSyncAt
 *
 * Conflict resolution: last-write-wins (server timestamp is authoritative).
 */

import {
  getOutbox, removeFromOutbox, clearOutbox,
  cacheSubscribers, getCachedSubscribers,
  setMeta, getMeta, getDeviceId,
} from "./local-db";

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: number;
  lastSyncAt: number;
}

/**
 * Full sync: push local changes, then pull cloud changes.
 * Returns a summary of what happened.
 */
export async function syncNow(): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, errors: 0, lastSyncAt: 0 };

  if (!navigator.onLine) {
    console.log("📡 Offline — sync skipped");
    return result;
  }

  const deviceId = await getDeviceId();

  // ─── Step 1: Push outbox ───
  const outboxRaw = await getOutbox();
  const outbox = Array.isArray(outboxRaw) ? outboxRaw : [];
  for (const entry of outbox) {
    try {
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: { "Content-Type": "application/json", "X-Device-Id": deviceId },
        body: entry.body ? JSON.stringify(entry.body) : undefined,
      });
      if (res.ok) {
        await removeFromOutbox(entry.id!);
        result.pushed++;
      } else {
        console.error("Push failed:", entry.url, res.status);
        result.errors++;
        // Stop on auth errors (401/403) — user needs to re-login
        if (res.status === 401 || res.status === 403) break;
      }
    } catch (e) {
      console.error("Push error:", e);
      result.errors++;
      break; // Network error — stop trying
    }
  }

  // ─── Step 2: Pull latest ───
  try {
    const lastSync = await getMeta("lastSyncAt") || 0;
    const res = await fetch(`/api/subscribers?since=${lastSync}`, {
      headers: { "X-Device-Id": deviceId },
    });
    if (res.ok) {
      const data = await res.json();
      const cloudSubs = data.subscribers || [];

      // Merge: cloud is authoritative for records updated after our last sync
      if (cloudSubs.length > 0) {
        // 🛡️ دفاع: الكاش قد يعيد شيئاً غير مصفوفة في بعض بيئات IndexedDB
        const cachedRaw = await getCachedSubscribers();
        const localSubs = Array.isArray(cachedRaw) ? cachedRaw : [];
        const localMap = new Map(localSubs.map((s) => [s.id, s]));

        for (const cloudSub of cloudSubs) {
          const localSub = localMap.get(cloudSub.id);
          // If we don't have it locally, or cloud is newer → accept cloud
          if (!localSub || new Date(cloudSub.updatedAt) > new Date(localSub.updatedAt)) {
            localMap.set(cloudSub.id, cloudSub);
          }
        }

        await cacheSubscribers(Array.from(localMap.values()));
        result.pulled = cloudSubs.length;
      }
    }
  } catch (e) {
    console.error("Pull error:", e);
    result.errors++;
  }

  // ─── Step 3: Update meta ───
  result.lastSyncAt = Date.now();
  await setMeta("lastSyncAt", result.lastSyncAt);

  console.log("✅ Sync complete:", result);
  return result;
}

/**
 * Register a mutation in the outbox for later sync.
 * Also optimistically updates the local cache.
 */
export async function queueMutation(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body?: any
): Promise<void> {
  // Add to outbox
  const { addToOutbox } = await import("./local-db");
  await addToOutbox({ url, method, body });

  // If online, try immediate sync
  if (navigator.onLine) {
    syncNow().catch(console.error);
  }
}

/**
 * Auto-sync: runs every 5 minutes when online.
 * Also triggers on `online` event.
 */
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(onSync?: (result: SyncResult) => void): void {
  if (typeof window === "undefined") return;

  // Sync on "online" event
  window.addEventListener("online", () => {
    console.log("🌐 Back online — syncing...");
    syncNow().then(onSync).catch(console.error);
  });

  // Periodic sync every 5 minutes
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    if (navigator.onLine) {
      syncNow().then(onSync).catch(console.error);
    }
  }, 5 * 60 * 1000);

  // Initial sync on load
  if (navigator.onLine) {
    syncNow().then(onSync).catch(console.error);
  }
}

export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
