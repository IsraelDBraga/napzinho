import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  serial,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

export const licenses = pgTable("licenses", {
  code: text("code").primaryKey(),
  tier: text("tier").notNull(), // 'premium' | 'lifetime'
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maxActivations: integer("max_activations").notNull().default(1),
  activations: integer("activations").notNull().default(0),
  active: boolean("active").notNull().default(true),
  internalOnly: boolean("internal_only").notNull().default(false),
  note: text("note"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const redemptions = pgTable(
  "redemptions",
  {
    code: text("code")
      .notNull()
      .references(() => licenses.code),
    deviceId: text("device_id").notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.code, t.deviceId] }),
  }),
);

export const deviceEntitlements = pgTable("device_entitlements", {
  deviceId: text("device_id").primaryKey(),
  secretHash: text("secret_hash"),
  tier: text("tier").notNull().default("no_plan"), // 'no_plan'|'trial'|'premium'|'lifetime'
  trialStart: timestamp("trial_start", { withTimezone: true }),
  trialUsed: boolean("trial_used").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  sourceCode: text("source_code"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cloudSync = pgTable("cloud_sync", {
  deviceId: text("device_id").primaryKey(),
  data: text("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const copilotUsage = pgTable(
  "copilot_usage",
  {
    id: serial("id").primaryKey(),
    deviceId: text("device_id").notNull(),
    tier: text("tier").notNull(),
    modelUsed: text("model_used").notNull(),
    tokensInput: integer("tokens_input").notNull().default(0),
    tokensOutput: integer("tokens_output").notNull().default(0),
    dedupHit: boolean("dedup_hit").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    deviceCreatedIdx: index("copilot_usage_device_created_idx").on(
      t.deviceId,
      t.createdAt,
    ),
  }),
);

export const copilotDedupCache = pgTable("copilot_dedup_cache", {
  cacheKey: text("cache_key").primaryKey(),
  response: text("response").notNull(),
  modelUsed: text("model_used").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
