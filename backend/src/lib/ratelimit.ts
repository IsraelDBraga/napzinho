import { and, eq, gte, sql } from "drizzle-orm";
import { schema, type DB } from "../db";
import type { EffectiveTier } from "./trial";

const HOURLY_HARD_CAP = 30;
const PREMIUM_MONTHLY_LIMIT = 200;

export type LimitDecision =
  | { ok: true }
  | { ok: false; status: number; error: string; messagePt: string };

function startOfMonth(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function hourAgo(): Date {
  return new Date(Date.now() - 60 * 60 * 1000);
}

async function countUsage(
  db: DB,
  deviceId: string,
  since: Date,
): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.copilotUsage)
    .where(
      and(
        eq(schema.copilotUsage.deviceId, deviceId),
        gte(schema.copilotUsage.createdAt, since),
      ),
    );
  return rows[0]?.c ?? 0;
}

/** Hard, invisible per-device cap of 30 requests/hour. */
export async function checkHourlyHardCap(
  db: DB,
  deviceId: string,
): Promise<LimitDecision> {
  const used = await countUsage(db, deviceId, hourAgo());
  if (used >= HOURLY_HARD_CAP) {
    return {
      ok: false,
      status: 429,
      error: "muitas_requisicoes",
      messagePt: "Muitas requisições em pouco tempo. Aguarde alguns minutos.",
    };
  }
  return { ok: true };
}

/** Monthly visible limit per tier (premium: 200; lifetime: unlimited). */
export async function checkMonthlyLimit(
  db: DB,
  deviceId: string,
  tier: EffectiveTier,
): Promise<LimitDecision> {
  if (tier === "lifetime") return { ok: true };
  if (tier !== "premium") {
    return {
      ok: false,
      status: 403,
      error: "sem_plano",
      messagePt: "O Copiloto IA faz parte do plano Premium.",
    };
  }
  const used = await countUsage(db, deviceId, startOfMonth());
  if (used >= PREMIUM_MONTHLY_LIMIT) {
    return {
      ok: false,
      status: 429,
      error: "limite_mensal_atingido",
      messagePt: "Você usou suas 200 orientações deste mês.",
    };
  }
  return { ok: true };
}

export const LIMITS = {
  HOURLY_HARD_CAP,
  PREMIUM_MONTHLY_LIMIT,
};
