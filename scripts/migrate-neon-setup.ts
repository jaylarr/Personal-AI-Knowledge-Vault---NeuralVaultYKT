import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createPool, applyMigrations, inTransaction } from "@atlas/core";
import { createHash } from "node:crypto";

try {
  const target = JSON.parse(await readFile("docs/neon-target.json", "utf8"));
  const link = JSON.parse(await readFile(".neon", "utf8"));
  const env = parseEnv(await readFile(".env.local", "utf8"));
  const url = new URL(env.DATABASE_URL_UNPOOLED ?? "");
  if (
    link.projectId !== target.projectId ||
    link.orgId !== target.organizationId ||
    link.branch !== target.branchName ||
    env.DATABASE_TARGET_ID !== `${target.projectId}:${target.branchId}:${target.databaseName}` ||
    url.hostname !== target.endpointHost ||
    url.pathname !== "/neondb"
  )
    throw new Error("Authorized target mismatch");
  url.searchParams.set("sslmode", "verify-full");
  const pool = createPool(url.href, "atlas-neon-setup-migration");
  try {
    const sql = await readFile("database/setup/0001_neon_connection_checks.sql", "utf8");
    // Move only our own previously applied setup receipt into its separate journal.
    // This keeps the later vault migration sequence independent of N01.
    const checksum = createHash("sha256").update(sql).digest("hex");
    await inTransaction(pool, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(4317,1800)");
      const exists = await client.query(
        "SELECT to_regclass('public.schema_migrations') AS table_name",
      );
      if (!exists.rows[0]?.table_name) return;
      const prior = await client.query(
        "SELECT checksum FROM public.schema_migrations WHERE name=$1",
        ["n01_0001_connection_checks.sql"],
      );
      if (!prior.rowCount) return;
      if (prior.rows[0].checksum !== checksum) throw new Error("Setup migration checksum mismatch");
      await client.query(
        "CREATE TABLE IF NOT EXISTS public.atlas_setup_migrations (name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
      );
      await client.query("REVOKE ALL ON public.atlas_setup_migrations FROM PUBLIC");
      await client.query(
        "INSERT INTO public.atlas_setup_migrations SELECT * FROM public.schema_migrations WHERE name=$1 ON CONFLICT(name) DO NOTHING",
        ["n01_0001_connection_checks.sql"],
      );
      const saved = await client.query(
        "SELECT checksum FROM public.atlas_setup_migrations WHERE name=$1",
        ["n01_0001_connection_checks.sql"],
      );
      if (saved.rows[0]?.checksum !== checksum) throw new Error("Setup journal mismatch");
      await client.query("DELETE FROM public.schema_migrations WHERE name=$1 AND checksum=$2", [
        "n01_0001_connection_checks.sql",
        checksum,
      ]);
    });
    const completed = await applyMigrations(
      pool,
      [
        {
          name: "n01_0001_connection_checks.sql",
          sql,
          checksum,
        },
      ],
      "atlas_setup_migrations",
    );
    process.stdout.write(
      completed.length
        ? "Applied N01 isolated connection-check schema on authorized production branch.\n"
        : "N01 setup migration checksum verified; no changes.\n",
    );
  } finally {
    await pool.end();
  }
} catch {
  process.stderr.write("N01 setup migration failed; credentials and SQL details redacted.\n");
  process.exitCode = 1;
}
