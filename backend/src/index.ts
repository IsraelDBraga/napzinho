import { openDb, type DbHandle } from "./db";
import { withCors, preflight } from "./lib/cors";
import { errorJson, json } from "./lib/utils";
import { log } from "./lib/logger";
import { handleCopilot } from "./routes/copilot";
import { handleSyncPull, handleSyncPush } from "./routes/sync";
import {
  handleActivate,
  handleEntitlement,
  handleTrialStart,
} from "./routes/licenses";
import {
  handleAdminDeactivate,
  handleAdminGrantLifetime,
  handleAdminListLicenses,
  handleAdminSeed,
  handleAdminUsage,
} from "./routes/admin";

export interface Env {
  DATABASE_URL: string;
  ANTHROPIC_API_KEY: string;
  NAPZ_ADMIN_TOKEN: string;
  CORS_ORIGIN?: string;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = env.CORS_ORIGIN || "*";
    if (req.method === "OPTIONS") return preflight(origin);

    let handle: DbHandle | null = null;
    let response: Response;
    try {
      response = await route(req, env, () => {
        if (!handle) handle = openDb(env.DATABASE_URL);
        return handle.db;
      });
    } catch (err) {
      log("error", "unhandled", { message: (err as Error).message });
      response = errorJson(500, "internal_error");
    } finally {
      if (handle) {
        // Close the pool after the response is delivered.
        ctx.waitUntil(handle.pool.end().catch(() => undefined));
      }
    }
    return withCors(response, origin);
  },
};

type DbProvider = () => import("./db").DB;

async function route(req: Request, env: Env, getDb: DbProvider): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;
  const m = req.method;

  if (m === "GET" && pathname === "/health") {
    return json({ ok: true, ts: new Date().toISOString() });
  }

  if (!pathname.startsWith("/api/v1/")) {
    return errorJson(404, "not_found");
  }

  let db: import("./db").DB;
  try {
    db = getDb();
  } catch (err) {
    log("error", "db_init_failed", { message: (err as Error).message });
    return errorJson(503, "database_unavailable");
  }

  if (pathname === "/api/v1/trial/start" && m === "POST") {
    return handleTrialStart(req, db);
  }
  if (pathname === "/api/v1/copilot" && m === "POST") {
    return handleCopilot(req, db, { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY });
  }
  if (pathname === "/api/v1/sync/push" && m === "POST") {
    return handleSyncPush(req, db);
  }
  if (pathname === "/api/v1/sync/pull" && m === "GET") {
    return handleSyncPull(req, db);
  }
  if (pathname === "/api/v1/activate" && m === "POST") {
    return handleActivate(req, db);
  }
  if (pathname === "/api/v1/entitlement" && m === "GET") {
    return handleEntitlement(req, db);
  }

  // Admin
  if (pathname === "/api/v1/admin/seed" && m === "POST") {
    return handleAdminSeed(req, db, env.NAPZ_ADMIN_TOKEN);
  }
  if (pathname === "/api/v1/admin/licenses" && m === "GET") {
    return handleAdminListLicenses(req, db, env.NAPZ_ADMIN_TOKEN);
  }
  if (pathname === "/api/v1/admin/deactivate" && m === "POST") {
    return handleAdminDeactivate(req, db, env.NAPZ_ADMIN_TOKEN);
  }
  if (pathname === "/api/v1/admin/grant-lifetime" && m === "POST") {
    return handleAdminGrantLifetime(req, db, env.NAPZ_ADMIN_TOKEN);
  }
  if (pathname === "/api/v1/admin/usage" && m === "GET") {
    return handleAdminUsage(req, db, env.NAPZ_ADMIN_TOKEN);
  }

  return errorJson(404, "not_found");
}
