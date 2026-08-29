// ═══════════════════════════════════════════════════════════
// محرك المزامنة (Sync Engine) — يشتغل داخل Electron Main Process
// يزامن قاعدة بيانات SQLite المحلية مع السحابة (Vercel + Postgres)
// ═══════════════════════════════════════════════════════════

const https = require("https");
const path = require("path");

// 🔑 استيراد PrismaClient من مجلد electron/prisma-client (نسخة مولّدة محلياً)
// هذا يتجنب مشكلة "Cannot find module prisma/client/default" التي تحدث
// عندما لا يُعبَّأ node_modules/.prisma (مجلد مخفي) بشكل صحيح في asar.
// fallback: @prisma/client (للتطوير المحلي حيث لم يُنسخ بعد)
let PrismaClient;
try {
  // في الإنتاج (مُعبأ): استخدم prisma-client المحلي
  const clientPath = path.join(__dirname, "prisma-client");
  PrismaClient = require(clientPath).PrismaClient;
} catch (e) {
  // في التطوير: استخدم @prisma/client العادي
  PrismaClient = require("@prisma/client").PrismaClient;
}

const prisma = new PrismaClient();
const CLOUD_BASE = "https://aladine-pool-manager.vercel.app";
const CLOUD_API = `${CLOUD_BASE}/api/sync`;

let syncTimer = null;
let syncing = false;

function isOnline() {
  return new Promise((resolve) => {
    const req = https.get(CLOUD_BASE, { timeout: 5000 }, (res) => {
      resolve(res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

async function pushChanges(apiKey) {
  const pending = await prisma.syncOutbox.findMany({
    where: { synced: false },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  if (pending.length === 0) return { applied: 0, skipped: 0 };

  const changes = pending.map((p) => ({
    modelName: p.modelName,
    recordId: p.recordId,
    operation: p.operation,
    payload: JSON.parse(p.payload),
  }));

  const res = await fetch(`${CLOUD_API}/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Club-Api-Key": apiKey },
    body: JSON.stringify({ changes }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`push failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const result = await res.json();

  await prisma.syncOutbox.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { synced: true, syncedAt: new Date() },
  });

  return result;
}

const APPEND_ONLY = ["payments", "renewals", "attendances"];

async function pullChanges(apiKey) {
  const meta = await prisma.syncMeta.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  const since = meta.lastPullAt ?? new Date(0);

  const res = await fetch(`${CLOUD_API}/pull?since=${since.toISOString()}`, {
    headers: { "X-Club-Api-Key": apiKey },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`pull failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();

  for (const s of data.subscribers || []) {
    const local = await prisma.subscriber.findUnique({ where: { id: s.id } });
    if (!local || new Date(s.updatedAt) > new Date(local.updatedAt)) {
      const { club, ...rest } = s;
      await prisma.subscriber.upsert({ where: { id: s.id }, create: rest, update: rest });
    }
  }

  for (const modelKey of APPEND_ONLY) {
    const modelName = modelKey.slice(0, -1);
    for (const record of data[modelKey] || []) {
      const { club, subscriber, ...rest } = record;
      await prisma[modelName].upsert({ where: { id: record.id }, create: rest, update: {} });
    }
  }

  await prisma.syncMeta.update({
    where: { id: "singleton" },
    data: { lastPullAt: new Date(data.serverTime) },
  });

  return data;
}

async function syncNow(apiKey, onStatus) {
  if (syncing) return { status: "already-syncing" };
  if (!apiKey) { onStatus?.("no-api-key"); return { status: "no-api-key" }; }

  syncing = true;
  try {
    if (!(await isOnline())) {
      onStatus?.("offline");
      return { status: "offline" };
    }
    onStatus?.("syncing");
    const pushResult = await pushChanges(apiKey);
    const pullResult = await pullChanges(apiKey);
    onStatus?.("synced");
    return { status: "synced", pushResult, pullResult };
  } catch (e) {
    console.error("[sync-engine] error:", e);
    onStatus?.("error");
    return { status: "error", error: String(e?.message || e) };
  } finally {
    syncing = false;
  }
}

function startAutoSync(getApiKey, onStatus, intervalMs = 5 * 60 * 1000) {
  const run = () => {
    const apiKey = getApiKey();
    if (apiKey) syncNow(apiKey, onStatus);
  };
  run();
  syncTimer = setInterval(run, intervalMs);
}

function stopAutoSync() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}

module.exports = { syncNow, startAutoSync, stopAutoSync, isOnline };
