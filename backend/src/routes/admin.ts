import { and, eq, gte, sql, desc } from "drizzle-orm";
import { schema, type DB } from "../db";
import { requireAdmin } from "../lib/auth";
import { errorJson, json, readJson } from "../lib/utils";
import { log } from "../lib/logger";

type SeedBody = {
  code?: string;
  tier?: "premium" | "lifetime";
  expires_at?: string | null;
  max_activations?: number;
  internal_only?: boolean;
  note?: string | null;
};

export async function handleAdminSeed(
  req: Request,
  db: DB,
  adminToken: string,
): Promise<Response> {
  const blocked = requireAdmin(req, adminToken);
  if (blocked) return blocked;

  const body = await readJson<SeedBody>(req);
  if (!body || typeof body.code !== "string" || !body.code.trim()) {
    return errorJson(400, "code_missing");
  }
  if (body.tier !== "premium" && body.tier !== "lifetime") {
    return errorJson(400, "tier_invalid");
  }
  const code = body.code.trim();
  const max = Math.max(1, Math.floor(Number(body.max_activations ?? 1)));
  const expiresAt =
    body.expires_at && typeof body.expires_at === "string"
      ? new Date(body.expires_at)
      : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return errorJson(400, "expires_at_invalid");
  }

  try {
    await db
      .insert(schema.licenses)
      .values({
        code,
        tier: body.tier,
        expiresAt,
        maxActivations: max,
        internalOnly: !!body.internal_only,
        note: body.note ?? null,
      })
      .onConflictDoUpdate({
        target: schema.licenses.code,
        set: {
          tier: body.tier,
          expiresAt,
          maxActivations: max,
          internalOnly: !!body.internal_only,
          note: body.note ?? null,
          updatedAt: new Date(),
        },
      });
    return json({ ok: true, code });
  } catch (err) {
    log("error", "admin_seed_failed", { message: (err as Error).message });
    return errorJson(500, "seed_failed");
  }
}

export async function handleAdminListLicenses(
  req: Request,
  db: DB,
  adminToken: string,
): Promise<Response> {
  const blocked = requireAdmin(req, adminToken);
  if (blocked) return blocked;
  try {
    const items = await db
      .select()
      .from(schema.licenses)
      .orderBy(desc(schema.licenses.createdAt))
      .limit(500);
    return json({
      items: items.map((l) => ({
        code: l.code,
        tier: l.tier,
        expires_at: l.expiresAt ? l.expiresAt.toISOString() : null,
        max_activations: l.maxActivations,
        activations: l.activations,
        active: l.active,
        internal_only: l.internalOnly,
        note: l.note,
        last_used_at: l.lastUsedAt ? l.lastUsedAt.toISOString() : null,
        created_at: l.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    log("error", "admin_list_failed", { message: (err as Error).message });
    return errorJson(500, "list_failed");
  }
}

type DeactivateBody = { code?: string };

export async function handleAdminDeactivate(
  req: Request,
  db: DB,
  adminToken: string,
): Promise<Response> {
  const blocked = requireAdmin(req, adminToken);
  if (blocked) return blocked;
  const body = await readJson<DeactivateBody>(req);
  if (!body?.code) return errorJson(400, "code_missing");
  try {
    await db
      .update(schema.licenses)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(schema.licenses.code, body.code.trim()));
    return json({ ok: true });
  } catch (err) {
    log("error", "admin_deactivate_failed", { message: (err as Error).message });
    return errorJson(500, "deactivate_failed");
  }
}

type GrantBody = { device_id?: string; note?: string };

export async function handleAdminGrantLifetime(
  req: Request,
  db: DB,
  adminToken: string,
): Promise<Response> {
  const blocked = requireAdmin(req, adminToken);
  if (blocked) return blocked;
  const body = await readJson<GrantBody>(req);
  if (!body?.device_id) return errorJson(400, "device_id_missing");
  const deviceId = body.device_id.trim();
  try {
    await db
      .insert(schema.deviceEntitlements)
      .values({
        deviceId,
        tier: "lifetime",
        sourceCode: "admin_grant",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.deviceEntitlements.deviceId,
        set: {
          tier: "lifetime",
          expiresAt: null,
          sourceCode: "admin_grant",
          updatedAt: new Date(),
        },
      });
    return json({ ok: true, device_id: deviceId, tier: "lifetime" });
  } catch (err) {
    log("error", "admin_grant_failed", { message: (err as Error).message });
    return errorJson(500, "grant_failed");
  }
}

export async function handleAdminUsage(
  req: Request,
  db: DB,
  adminToken: string,
): Promise<Response> {
  const blocked = requireAdmin(req, adminToken);
  if (blocked) return blocked;
  const url = new URL(req.url);
  const days = Math.max(1, Math.min(180, Number(url.searchParams.get("days") ?? 30)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    const totalsRows = await db
      .select({
        total: sql<number>`count(*)::int`,
        dedup: sql<number>`sum(case when dedup_hit then 1 else 0 end)::int`,
        tokens_in: sql<number>`coalesce(sum(tokens_input),0)::int`,
        tokens_out: sql<number>`coalesce(sum(tokens_output),0)::int`,
      })
      .from(schema.copilotUsage)
      .where(gte(schema.copilotUsage.createdAt, since));

    const byTierRows = await db
      .select({
        tier: schema.copilotUsage.tier,
        c: sql<number>`count(*)::int`,
      })
      .from(schema.copilotUsage)
      .where(gte(schema.copilotUsage.createdAt, since))
      .groupBy(schema.copilotUsage.tier);

    const byModelRows = await db
      .select({
        model: schema.copilotUsage.modelUsed,
        c: sql<number>`count(*)::int`,
      })
      .from(schema.copilotUsage)
      .where(gte(schema.copilotUsage.createdAt, since))
      .groupBy(schema.copilotUsage.modelUsed);

    const topDevicesRows = await db
      .select({
        device_id: schema.copilotUsage.deviceId,
        c: sql<number>`count(*)::int`,
      })
      .from(schema.copilotUsage)
      .where(
        and(gte(schema.copilotUsage.createdAt, since)),
      )
      .groupBy(schema.copilotUsage.deviceId)
      .orderBy(sql`count(*) desc`)
      .limit(20);

    const t = totalsRows[0] ?? { total: 0, dedup: 0, tokens_in: 0, tokens_out: 0 };
    return json({
      window_days: days,
      total_requests: t.total,
      dedup_hits: t.dedup,
      tokens_input: t.tokens_in,
      tokens_output: t.tokens_out,
      by_tier: byTierRows,
      by_model: byModelRows,
      top_devices: topDevicesRows,
    });
  } catch (err) {
    log("error", "admin_usage_failed", { message: (err as Error).message });
    return errorJson(500, "usage_failed");
  }
}
