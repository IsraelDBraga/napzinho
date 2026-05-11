import { eq } from "drizzle-orm";
import { schema, type DB } from "../db";

export type Entitlement = typeof schema.deviceEntitlements.$inferSelect;
export type EffectiveTier = "trial" | "premium" | "lifetime" | "blocked";

const TRIAL_DAYS = 7;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Resolve the effective tier given the current entitlement row.
 * Trial: valid only while within TRIAL_DAYS from trial_start.
 * Premium: valid while expires_at is null or in the future.
 * Lifetime: always valid.
 */
export function getEffectiveTier(ent: Entitlement | null): EffectiveTier {
  if (!ent) return "blocked";
  const now = Date.now();
  if (ent.tier === "lifetime") return "lifetime";
  if (ent.tier === "premium") {
    if (!ent.expiresAt) return "premium";
    return ent.expiresAt.getTime() > now ? "premium" : "blocked";
  }
  if (ent.tier === "trial") {
    if (!ent.trialStart) return "blocked";
    const elapsed = now - ent.trialStart.getTime();
    return elapsed <= TRIAL_MS ? "trial" : "blocked";
  }
  return "blocked";
}

export async function getEntitlement(
  db: DB,
  deviceId: string,
): Promise<Entitlement | null> {
  const rows = await db
    .select()
    .from(schema.deviceEntitlements)
    .where(eq(schema.deviceEntitlements.deviceId, deviceId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Start a 7-day trial for the device.
 * Returns false if a trial was already used previously.
 */
export async function startTrial(db: DB, deviceId: string): Promise<boolean> {
  const ent = await getEntitlement(db, deviceId);
  if (!ent) return false; // device must be authenticated/registered first
  if (ent.trialUsed) return false;
  const now = new Date();
  await db
    .update(schema.deviceEntitlements)
    .set({
      tier: "trial",
      trialStart: now,
      trialUsed: true,
      updatedAt: now,
    })
    .where(eq(schema.deviceEntitlements.deviceId, deviceId));
  return true;
}
