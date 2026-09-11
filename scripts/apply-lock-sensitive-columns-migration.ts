/**
 * Applies supabase/lock-sensitive-columns.sql when SUPABASE_DB_URL is set.
 * Or paste the SQL in Supabase → SQL Editor.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadGhlEnvFiles } from "./ghl-env";

loadGhlEnvFiles();

const sqlPath = resolve(process.cwd(), "supabase/lock-sensitive-columns.sql");
const dbUrl = process.env.SUPABASE_DB_URL?.trim();

async function main() {
  const sql = readFileSync(sqlPath, "utf8");

  if (!dbUrl) {
    console.error("Missing SUPABASE_DB_URL. Paste supabase/lock-sensitive-columns.sql in Supabase SQL Editor.");
    process.exit(1);
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Migration applied: lock sensitive columns from anon/authenticated");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
