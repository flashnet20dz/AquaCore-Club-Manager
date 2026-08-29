import { db, isDesktopMode } from "@/lib/db";

/**
 * يسجّل تغييراً محلياً في جدول SyncOutbox — يُستدعى بعد كل create/update/delete
 * ناجح على موديل قابل للمزامنة. لا يفعل شيئاً في وضع الويب.
 */
export async function recordSyncOutbox(params: {
  clubId: string;
  modelName: string;
  recordId: string;
  operation: "create" | "update" | "delete";
  payload: Record<string, any>;
}) {
  if (!isDesktopMode()) return;

  try {
    await (db as any).syncOutbox.create({
      data: {
        clubId: params.clubId,
        modelName: params.modelName,
        recordId: params.recordId,
        operation: params.operation,
        payload: JSON.stringify(params.payload),
      },
    });
  } catch (e) {
    console.warn("[sync-outbox] failed to record change:", e);
  }
}
