import { eq, lt, sql } from "drizzle-orm";
import { schema, type DB } from "../db";
import { sha256Hex, stableNormalize } from "./utils";
import { log } from "./logger";

const TTL_MS = 60 * 1000; // 60s
const CLEANUP_EVERY = 100; // lazy cleanup cadence

let callCounter = 0;

export type DedupHit = {
  response: string;
  modelUsed: string;
};

export async function dedupKey(
  deviceId: string,
  context: unknown,
): Promise<string> {
  const normalized = stableNormalize(context) ?? {};
  const payload = deviceId + "|" + JSON.stringify(normalized);
  return sha256Hex(payload);
}

/** Returns cached entry if newer than TTL, otherwise null. */
export async function checkDedup(
  db: DB,
  cacheKey: string,
): Promise<DedupHit | null> {
  const cutoff = new Date(Date.now() - TTL_MS);
  const rows = await db
    .select()
    .from(schema.copilotDedupCache)
    .where(eq(schema.copilotDedupCache.cacheKey, cacheKey))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.createdAt.getTime() < cutoff.getTime()) return null;
  return { response: row.response, modelUsed: row.modelUsed };
}

export async function saveDedup(
  db: DB,
  cacheKey: string,
  response: string,
  modelUsed: string,
): Promise<void> {
  // Upsert by primary key
  await db
    .insert(schema.copilotDedupCache)
    .values({ cacheKey, response, modelUsed, createdAt: new Date() })
    .onConflictDoUpdate({
      target: schema.copilotDedupCache.cacheKey,
      set: { response, modelUsed, createdAt: new Date() },
    });
  scheduleLazyCleanup(db);
}

function scheduleLazyCleanup(db: DB): void {
  callCounter += 1;
  if (callCounter % CLEANUP_EVERY !== 0) return;
  // Fire-and-forget; don't block the request.
  cleanupDedup(db).catch((err) => {
    log("warn", "dedup_cleanup_failed", { message: (err as Error).message });
  });
}

export async function cleanupDedup(db: DB): Promise<void> {
  const cutoff = new Date(Date.now() - TTL_MS);
  await db
    .delete(schema.copilotDedupCache)
    .where(lt(schema.copilotDedupCache.createdAt, cutoff));
}

/** Periodic retention cleanup for usage rows. Lazy; safe to call often. */
export async function cleanupOldUsage(db: DB, days = 180): Promise<void> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  await db.execute(
    sql`delete from copilot_usage where created_at < ${cutoff}`,
  );
}
