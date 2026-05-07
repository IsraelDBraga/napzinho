import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// In Cloudflare Workers, use the global WebSocket. neonConfig auto-detects
// in modern versions, but set it explicitly to avoid surprises.
// (It is also safe to set in Node, where WebSocket is provided by undici.)
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  neonConfig.webSocketConstructor = (globalThis as any).WebSocket;
} catch {
  /* noop */
}

export type DB = NeonDatabase<typeof schema>;

export type DbHandle = {
  db: DB;
  pool: Pool;
};

/**
 * Open a fresh connection pool per request and return both the drizzle handle
 * and the underlying pool so the caller can `pool.end()` via ctx.waitUntil.
 * Required for transactions, which neon-http does not support.
 */
export function openDb(databaseUrl: string): DbHandle {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_missing");
  }
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export { schema };
