import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type { Pool } from "pg";
import { inTransaction } from "./transaction.js";

export type Migration = { name: string; sql: string; checksum: string };

export async function readMigrations(directory: string): Promise<Migration[]> {
  const files = (await readdir(directory))
    .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  return Promise.all(
    files.map(async (name) => {
      const sql = await readFile(`${directory}/${name}`, "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    }),
  );
}

export async function applyMigrations(
  pool: Pool,
  migrations: readonly Migration[],
  journal: "schema_migrations" | "atlas_setup_migrations" = "schema_migrations",
) {
  if (!["schema_migrations", "atlas_setup_migrations"].includes(journal))
    throw new Error("Invalid migration journal");
  if (new Set(migrations.map((m) => m.name)).size !== migrations.length) {
    throw new Error("Duplicate migration names");
  }
  return inTransaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(4317, 1800)");
    await client.query(`CREATE TABLE IF NOT EXISTS public.${journal} (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`REVOKE ALL ON public.${journal} FROM PUBLIC`);
    const applied = await client.query<{ name: string; checksum: string }>(
      `SELECT name,checksum FROM public.${journal} ORDER BY name`,
    );
    const byName = new Map(migrations.map((migration) => [migration.name, migration]));
    for (const row of applied.rows) {
      if (byName.get(row.name)?.checksum !== row.checksum) {
        throw new Error(`Migration history mismatch: ${row.name}`);
      }
    }
    const seen = new Set(applied.rows.map((row) => row.name));
    const completed: string[] = [];
    for (const migration of migrations) {
      if (seen.has(migration.name)) continue;
      if (applied.rows.some((row) => row.name > migration.name)) {
        throw new Error(`Out-of-order migration: ${migration.name}`);
      }
      await client.query(migration.sql);
      await client.query(`INSERT INTO public.${journal}(name,checksum) VALUES($1,$2)`, [
        migration.name,
        migration.checksum,
      ]);
      completed.push(migration.name);
    }
    return completed;
  });
}
