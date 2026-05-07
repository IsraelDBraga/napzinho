import { eq } from "drizzle-orm";
import { schema, type DB } from "../db";
import { errorJson, sha256Hex } from "./utils";
import { log } from "./logger";

export type DeviceCreds = { deviceId: string; deviceSecret: string };

const VALID_ID = /^[A-Za-z0-9_-]{8,128}$/;
const VALID_SECRET = /^[A-Za-z0-9_-]{16,256}$/;

export function readDeviceCreds(req: Request, body: unknown): DeviceCreds | null {
  const headerId = req.headers.get("x-device-id") ?? "";
  const headerSecret = req.headers.get("x-device-secret") ?? "";
  let bodyId = "";
  let bodySecret = "";
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.device_id === "string") bodyId = b.device_id;
    if (typeof b.device_secret === "string") bodySecret = b.device_secret;
  }
  const deviceId = (headerId || bodyId).trim();
  const deviceSecret = (headerSecret || bodySecret).trim();
  if (!VALID_ID.test(deviceId) || !VALID_SECRET.test(deviceSecret)) return null;
  return { deviceId, deviceSecret };
}

export type AuthResult =
  | { ok: true; deviceId: string; isFirstUse: boolean }
  | { ok: false; response: Response };

/**
 * Validate device credentials.
 * - First use: stores SHA-256(secret).
 * - Subsequent use: validates existing hash.
 */
export async function authenticateDevice(
  db: DB,
  creds: DeviceCreds | null,
): Promise<AuthResult> {
  if (!creds) {
    return { ok: false, response: errorJson(401, "device_auth_failed") };
  }
  const { deviceId, deviceSecret } = creds;
  try {
    const hash = await sha256Hex(deviceSecret);
    const rows = await db
      .select()
      .from(schema.deviceEntitlements)
      .where(eq(schema.deviceEntitlements.deviceId, deviceId))
      .limit(1);
    const existing = rows[0];
    if (!existing) {
      await db.insert(schema.deviceEntitlements).values({
        deviceId,
        secretHash: hash,
        tier: "no_plan",
        lastUsedAt: new Date(),
      });
      return { ok: true, deviceId, isFirstUse: true };
    }
    if (!existing.secretHash) {
      await db
        .update(schema.deviceEntitlements)
        .set({ secretHash: hash, lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.deviceEntitlements.deviceId, deviceId));
      return { ok: true, deviceId, isFirstUse: true };
    }
    if (existing.secretHash !== hash) {
      log("warn", "auth_failed_secret_mismatch", { deviceId });
      return { ok: false, response: errorJson(401, "device_auth_failed") };
    }
    await db
      .update(schema.deviceEntitlements)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.deviceEntitlements.deviceId, deviceId));
    return { ok: true, deviceId, isFirstUse: false };
  } catch (err) {
    log("error", "auth_db_error", { message: (err as Error).message });
    return { ok: false, response: errorJson(500, "auth_unavailable") };
  }
}

export function requireAdmin(req: Request, expected: string): Response | null {
  if (!expected) {
    log("error", "admin_token_unset");
    return errorJson(503, "admin_disabled");
  }
  const got = (req.headers.get("x-admin-token") ?? "").trim();
  if (got !== expected) {
    log("warn", "admin_auth_failed");
    return errorJson(401, "unauthorized");
  }
  return null;
}
