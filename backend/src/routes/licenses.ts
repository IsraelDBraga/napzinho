import { and, eq, sql } from "drizzle-orm";
import { schema, type DB } from "../db";
import { authenticateDevice, readDeviceCreds } from "../lib/auth";
import { errorJson, json, readJson } from "../lib/utils";
import { getEffectiveTier, getEntitlement, startTrial } from "../lib/trial";
import { log } from "../lib/logger";

type ActivateBody = {
  device_id?: string;
  device_secret?: string;
  code?: string;
};

export async function handleTrialStart(req: Request, db: DB): Promise<Response> {
  const body = await readJson<ActivateBody>(req);
  const creds = readDeviceCreds(req, body);
  const auth = await authenticateDevice(db, creds);
  if (!auth.ok) return auth.response;

  const ok = await startTrial(db, auth.deviceId);
  if (!ok) {
    return errorJson(409, "trial_indisponivel", {
      reason: "trial_ja_utilizado",
      message_pt: "Você já utilizou o teste gratuito.",
    });
  }
  const ent = await getEntitlement(db, auth.deviceId);
  return json({
    ok: true,
    tier: getEffectiveTier(ent),
    trial_start: ent?.trialStart?.toISOString() ?? null,
  });
}

export async function handleEntitlement(req: Request, db: DB): Promise<Response> {
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

  const ent = await getEntitlement(db, auth.deviceId);
  const tier = getEffectiveTier(ent);
  return json({
    device_id: auth.deviceId,
    tier,
    raw_tier: ent?.tier ?? "no_plan",
    trial_used: ent?.trialUsed ?? false,
    trial_start: ent?.trialStart?.toISOString() ?? null,
    expires_at: ent?.expiresAt?.toISOString() ?? null,
    source_code: ent?.sourceCode ?? null,
  });
}

export async function handleActivate(req: Request, db: DB): Promise<Response> {
  const body = await readJson<ActivateBody>(req);
  const creds = readDeviceCreds(req, body);
  const auth = await authenticateDevice(db, creds);
  if (!auth.ok) return auth.response;

  const code = (body?.code ?? "").trim();
  if (!code) return errorJson(400, "code_missing");

  try {
    // Idempotent activation in a single transaction.
    const result = await db.transaction(async (tx) => {
      const licRows = await tx
        .select()
        .from(schema.licenses)
        .where(eq(schema.licenses.code, code))
        .limit(1);
      const lic = licRows[0];
      if (!lic) return { kind: "not_found" as const };
      if (!lic.active) return { kind: "inactive" as const };
      if (lic.expiresAt && lic.expiresAt.getTime() < Date.now()) {
        return { kind: "expired" as const };
      }

      const existingRedemption = await tx
        .select()
        .from(schema.redemptions)
        .where(
          and(
            eq(schema.redemptions.code, code),
            eq(schema.redemptions.deviceId, auth.deviceId),
          ),
        )
        .limit(1);

      const isFirstRedemption = existingRedemption.length === 0;

      if (isFirstRedemption) {
        if (lic.activations >= lic.maxActivations) {
          return { kind: "max_activations" as const };
        }
        await tx.insert(schema.redemptions).values({
          code,
          deviceId: auth.deviceId,
        });
        await tx
          .update(schema.licenses)
          .set({
            activations: sql`${schema.licenses.activations} + 1`,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.licenses.code, code));
      } else {
        await tx
          .update(schema.licenses)
          .set({ lastUsedAt: new Date() })
          .where(eq(schema.licenses.code, code));
      }

      await tx
        .insert(schema.deviceEntitlements)
        .values({
          deviceId: auth.deviceId,
          tier: lic.tier,
          expiresAt: lic.expiresAt ?? null,
          sourceCode: code,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.deviceEntitlements.deviceId,
          set: {
            tier: lic.tier,
            expiresAt: lic.expiresAt ?? null,
            sourceCode: code,
            updatedAt: new Date(),
          },
        });

      return { kind: "ok" as const, tier: lic.tier, expiresAt: lic.expiresAt };
    });

    if (result.kind === "not_found")
      return errorJson(404, "codigo_invalido", {
        message_pt: "Código não encontrado.",
      });
    if (result.kind === "inactive")
      return errorJson(410, "codigo_inativo", {
        message_pt: "Esta chave foi desativada.",
      });
    if (result.kind === "expired")
      return errorJson(410, "codigo_expirado", {
        message_pt: "Esta chave está expirada.",
      });
    if (result.kind === "max_activations")
      return errorJson(409, "limite_ativacoes", {
        message_pt: "Esta chave já atingiu o número máximo de ativações.",
      });

    return json({
      ok: true,
      tier: result.tier,
      expires_at: result.expiresAt ? result.expiresAt.toISOString() : null,
    });
  } catch (err) {
    log("error", "activate_failed", { message: (err as Error).message });
    return errorJson(500, "activate_failed");
  }
}
