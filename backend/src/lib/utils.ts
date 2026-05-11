// Small, dependency-free helpers used across routes.

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

export function json(
  body: unknown,
  init: { status?: number; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(init.headers ?? {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

export function errorJson(
  status: number,
  error: string,
  extra: Record<string, unknown> = {},
): Response {
  return json({ error, ...extra }, { status });
}

export async function readJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function nowIso(): string {
  return new Date().toISOString();
}

// Recursively sort object keys and drop null/undefined values, for stable hashes.
export function stableNormalize(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const v of value) {
      const n = stableNormalize(v);
      if (n !== undefined) out.push(n);
    }
    return out;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const n = stableNormalize(obj[k]);
      if (n !== undefined) out[k] = n;
    }
    return out;
  }
  return value;
}

// Strip ASCII control characters (except basic whitespace) and clamp length.
export function sanitizeString(s: unknown, maxLen = 100): string {
  if (typeof s !== "string") return "";
  // eslint-disable-next-line no-control-regex
  const cleaned = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return cleaned.slice(0, maxLen);
}
