// Minimal CORS helper. Allows configured origin (or "*") and the verbs we use.
const ALLOW_METHODS = "GET,POST,OPTIONS";
const ALLOW_HEADERS =
  "Content-Type, X-Admin-Token, X-Device-Id, X-Device-Secret";

export function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function withCors(res: Response, origin: string): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) {
    headers.set(k, v as string);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export function preflight(origin: string): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
