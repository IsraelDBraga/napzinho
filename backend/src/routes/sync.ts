import { eq } from "drizzle-orm";
import { schema, type DB } from "../db";
import { authenticateDevice, readDeviceCreds } from "../lib/auth";
import { errorJson, json, readJson } from "../lib/utils";
import { log } from "../lib/logger";

const MAX_BYTES = 512 * 1024;

type PushBody = {
  device_id?: string;
  device_secret?: string;
  data?: unknown;
};

export async function handleSyncPush(req: Request, db: DB): Promise<Response> {
  const body = await readJson<PushBody>(req);
  const creds = readDeviceCreds(req, body);
  const auth = await authenticateDevice(db, creds);
  if (!auth.ok) return auth.response;

  if (!body || body.data === undefined) {
    return errorJson(400, "data_missing");
  }
  // Stringify once, validate size, store as text.
  let serialized: string;
  try {
    serialized = JSON.stringify(body.data);
  } catch {
    return errorJson(400, "data_unserializable");
  }
  const size = new TextEncoder().encode(serialized).byteLength;
  if (size > MAX_BYTES) {
    return errorJson(413, "payload_muito_grande", { max_kb: 512 });
  }

  try {
    await db
      .insert(schema.cloudSync)
      .values({
        deviceId: auth.deviceId,
        data: serialized,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.cloudSync.deviceId,
        set: { data: serialized, updatedAt: new Date() },
      });
    return json({ ok: true, bytes: size });
  } catch (err) {
    log("error", "sync_push_db_error", { message: (err as Error).message });
    return errorJson(500, "sync_failed");
  }
}

export async function handleSyncPull(req: Request, db: DB): Promise<Response> {
  const url = new URL(req.url);
  const queryDeviceId = url.searchParams.get("device_id") ?? "";
  const queryDeviceSecret = url.searchParams.get("device_secret") ?? "";
  const fakeBody =
    queryDeviceId || queryDeviceSecret
      ? { device_id: queryDeviceId, device_secret: queryDeviceSecret }
      : null;

  const creds = readDeviceCreds(req, fakeBody);
  const auth = await authenticateDevice(db, creds);
  if (!auth.ok) return auth.response;

  try {
    const rows = await db
      .select()
      .from(schema.cloudSync)
      .where(eq(schema.cloudSync.deviceId, auth.deviceId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return json({ data: null, updated_at: null });
    }
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(row.data);
    } catch {
      parsed = row.data;
    }
    return json({ data: parsed, updated_at: row.updatedAt.toISOString() });
  } catch (err) {
    log("error", "sync_pull_db_error", { message: (err as Error).message });
    return errorJson(500, "sync_failed");
  }
}
