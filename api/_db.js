import { neon } from "@neondatabase/serverless";

let sqlClient;
let schemaReady;

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
}

export async function ensureSchema() {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = Promise.all([
      sql`
        CREATE TABLE IF NOT EXISTS blackbox_users (
          email TEXT PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
      sql`
        CREATE TABLE IF NOT EXISTS blackbox_listings (
          id TEXT PRIMARY KEY,
          owner_address TEXT,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          public_tease TEXT NOT NULL,
          price_label TEXT NOT NULL,
          weirdness TEXT NOT NULL,
          vault_uuid BIGINT,
          allocate_tx TEXT,
          write_tx TEXT,
          configure_tx TEXT,
          buy_tx TEXT,
          condition_contract TEXT,
          price_wei TEXT,
          access_mode TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `,
    ]);
  }

  await schemaReady;
}

export async function upsertUserEmail(email) {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO blackbox_users (email, last_seen_at)
    VALUES (${email}, NOW())
    ON CONFLICT (email)
    DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
  `;
}
