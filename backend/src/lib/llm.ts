import { sanitizeString } from "./utils";
import { log } from "./logger";
import type { EffectiveTier } from "./trial";

const SONNET = "claude-sonnet-4-20250514";
const HAIKU = "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 18_000;

const SYSTEM_PROMPT =
  "Você é um assistente especializado em sono infantil. Responda em português brasileiro, de forma direta, calorosa e prática. Máximo 3 parágrafos curtos. Nunca diagnostique — oriente e acolha. Use os dados de contexto para dar uma leitura situacional do momento atual do bebê e uma sugestão concreta de ação. Admita incerteza quando pertinente. Fale como alguém experiente e humano, não como manual médico.";

export type CopilotContext = {
  idade_meses?: number;
  acordado_ha_mins?: number;
  ultima_soneca_mins?: number;
  sonecas_hoje?: number;
  sono_total_hoje_mins?: number;
  ultima_mamada_ha_mins?: number;
  despertares_ultima_noite?: number;
  contextFlags?: unknown;
};

export type CopilotResult = {
  message: string;
  model: string;
  fallback: boolean;
  fallbackReason: string | null;
  shouldUseLocalCopilot: boolean;
  tokensInput: number;
  tokensOutput: number;
};

export function pickModel(
  tier: EffectiveTier,
  ctx: CopilotContext,
): string | null {
  if (tier === "trial" || tier === "blocked") return null;
  if (tier === "lifetime") return SONNET;
  // premium
  const flags = sanitizeContextFlags(ctx.contextFlags);
  const fragmented = (ctx.despertares_ultima_noite ?? 0) >= 3;
  return fragmented || flags.length > 0 ? SONNET : HAIKU;
}

function sanitizeContextFlags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const v of input) {
    const s = sanitizeString(v, 100);
    if (s) out.push(s);
    if (out.length >= 10) break;
  }
  return out;
}

function sanitizeContext(ctx: CopilotContext): Record<string, unknown> {
  const flags = sanitizeContextFlags(ctx.contextFlags);
  return {
    idade_meses: numOrNull(ctx.idade_meses),
    acordado_ha_mins: numOrNull(ctx.acordado_ha_mins),
    ultima_soneca_mins: numOrNull(ctx.ultima_soneca_mins),
    sonecas_hoje: numOrNull(ctx.sonecas_hoje),
    sono_total_hoje_mins: numOrNull(ctx.sono_total_hoje_mins),
    ultima_mamada_ha_mins: numOrNull(ctx.ultima_mamada_ha_mins),
    despertares_ultima_noite: numOrNull(ctx.despertares_ultima_noite),
    contexto: flags,
  };
}

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function fallback(reason: string, model: string): CopilotResult {
  return {
    message: "",
    model,
    fallback: true,
    fallbackReason: reason,
    shouldUseLocalCopilot: true,
    tokensInput: 0,
    tokensOutput: 0,
  };
}

/**
 * Call Anthropic Messages API. Returns a structured result with explicit
 * fallback signaling so the client can render its local copilot if needed.
 */
export async function callCopilot(
  context: CopilotContext,
  tier: EffectiveTier,
  apiKey: string,
): Promise<CopilotResult> {
  const model = pickModel(tier, context);
  if (!model) {
    return fallback("trial_or_blocked", "none");
  }
  if (!apiKey) {
    log("error", "anthropic_key_missing");
    return fallback("api_key_missing", model);
  }

  const payload = sanitizeContext(context);
  const userContent = JSON.stringify(payload);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      log("error", "anthropic_http_error", { status: res.status });
      return fallback("llm_unavailable", model);
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text =
      data.content
        ?.filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text as string)
        .join("\n")
        .trim() ?? "";

    if (!text) {
      log("warn", "anthropic_empty_response", { model });
      return fallback("llm_unavailable", model);
    }
    return {
      message: text,
      model,
      fallback: false,
      fallbackReason: null,
      shouldUseLocalCopilot: false,
      tokensInput: data.usage?.input_tokens ?? 0,
      tokensOutput: data.usage?.output_tokens ?? 0,
    };
  } catch (err) {
    const aborted = (err as Error)?.name === "AbortError";
    log("error", aborted ? "anthropic_timeout" : "anthropic_failure", {
      message: aborted ? "timeout" : (err as Error).message,
    });
    return fallback(aborted ? "timeout" : "llm_unavailable", model);
  } finally {
    clearTimeout(timer);
  }
}

export const MODELS = { SONNET, HAIKU };
