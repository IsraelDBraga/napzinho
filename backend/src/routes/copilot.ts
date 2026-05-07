import { schema, type DB } from "../db";
import {
  authenticateDevice,
  readDeviceCreds,
} from "../lib/auth";
import { errorJson, json, readJson } from "../lib/utils";
import { getEffectiveTier, getEntitlement } from "../lib/trial";
import {
  checkHourlyHardCap,
  checkMonthlyLimit,
} from "../lib/ratelimit";
import { checkDedup, dedupKey, saveDedup } from "../lib/dedup";
import { callCopilot, type CopilotContext } from "../lib/llm";
import { log } from "../lib/logger";

type Body = {
  device_id?: string;
  device_secret?: string;
  context?: CopilotContext;
};

export async function handleCopilot(
  req: Request,
  db: DB,
  env: { ANTHROPIC_API_KEY: string },
): Promise<Response> {
  const body = await readJson<Body>(req);
  const creds = readDeviceCreds(req, body);
  const auth = await authenticateDevice(db, creds);
  if (!auth.ok) return auth.response;
  const { deviceId } = auth;

  const ent = await getEntitlement(db, deviceId);
  const tier = getEffectiveTier(ent);

  if (tier === "trial") {
    return errorJson(403, "copiloto_bloqueado", {
      reason: "trial_sem_copilot",
      message_pt: "O Copiloto IA faz parte do plano Premium.",
    });
  }
  if (tier === "blocked") {
    return errorJson(403, "copiloto_bloqueado", {
      reason: "sem_plano",
      message_pt: "O Copiloto IA faz parte do plano Premium.",
    });
  }

  // Hard cap first (cheaper to deny abusive bursts).
  const hard = await checkHourlyHardCap(db, deviceId);
  if (!hard.ok) {
    log("warn", "rate_limit_hourly", { deviceId });
    return errorJson(hard.status, hard.error, { message_pt: hard.messagePt });
  }

  const monthly = await checkMonthlyLimit(db, deviceId, tier);
  if (!monthly.ok) {
    log("warn", "rate_limit_monthly", { deviceId, tier });
    return errorJson(monthly.status, monthly.error, {
      message_pt: monthly.messagePt,
      reason:
        monthly.error === "limite_mensal_atingido"
          ? "limite_mensal_atingido"
          : "sem_plano",
    });
  }

  const ctx: CopilotContext = (body?.context ?? {}) as CopilotContext;

  // Dedup
  const cacheKey = await dedupKey(deviceId, ctx);
  const hit = await checkDedup(db, cacheKey);
  if (hit) {
    await db.insert(schema.copilotUsage).values({
      deviceId,
      tier,
      modelUsed: hit.modelUsed,
      tokensInput: 0,
      tokensOutput: 0,
      dedupHit: true,
    });
    return json({
      message: hit.response,
      model: hit.modelUsed,
      fallback: false,
      fallbackReason: null,
      shouldUseLocalCopilot: false,
      cached: true,
    });
  }

  const result = await callCopilot(ctx, tier, env.ANTHROPIC_API_KEY);

  // Always log usage (even fallbacks) so quotas reflect attempts.
  await db.insert(schema.copilotUsage).values({
    deviceId,
    tier,
    modelUsed: result.model,
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
    dedupHit: false,
  });

  if (!result.fallback && result.message) {
    await saveDedup(db, cacheKey, result.message, result.model);
  }

  return json({
    message: result.message,
    model: result.model,
    fallback: result.fallback,
    fallbackReason: result.fallbackReason,
    shouldUseLocalCopilot: result.shouldUseLocalCopilot,
    cached: false,
  });
}
