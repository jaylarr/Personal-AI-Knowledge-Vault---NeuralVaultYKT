import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import pg from "pg";

// Explicit N01 target; never fall back to a different linked project or branch.
let stage = "target validation";
try {
  const link = JSON.parse(await readFile(".neon", "utf8"));
  const target = JSON.parse(await readFile("docs/neon-target.json", "utf8"));
  if (
    link.orgId !== target.organizationId ||
    link.projectId !== target.projectId ||
    link.branch !== target.branchName
  )
    throw new Error("Target mismatch");
  const file = ".env.local";
  const original = await readFile(file, "utf8");
  const env = parseEnv(original);
  if (
    ![target.branchName, target.branchId].includes(env.NEON_BRANCH) ||
    env.NEON_AUTH_BASE_URL !== target.authBaseUrl
  )
    throw new Error("Pulled branch mismatch");
  const direct = new URL(env.DATABASE_URL_UNPOOLED ?? "");
  const pooled = new URL(env.DATABASE_URL ?? "");
  if (
    direct.hostname !== target.endpointHost ||
    pooled.hostname !== target.endpointHost.replace(".c-", "-pooler.c-") ||
    direct.pathname !== "/neondb" ||
    pooled.pathname !== "/neondb"
  )
    throw new Error("Endpoint mismatch");
  direct.searchParams.set("sslmode", "verify-full");
  const admin = new pg.Client({ connectionString: direct.href, connectionTimeoutMillis: 10000 });
  let runtimeUrl = env.ATLAS_DATABASE_URL;
  stage = "restricted application role";
  try {
    await admin.connect();
    await admin.query("BEGIN");
    await admin.query("SELECT pg_advisory_xact_lock(4317, 1802)");
    const role = await admin.query("SELECT 1 FROM pg_roles WHERE rolname='atlas_api'");
    if (!role.rowCount) {
      const password = randomBytes(32).toString("hex");
      await admin.query(
        `CREATE ROLE atlas_api LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${pg.escapeLiteral(password)}`,
      );
      const url = new URL(pooled);
      url.username = "atlas_api";
      url.password = password;
      url.searchParams.set("sslmode", "verify-full");
      runtimeUrl = url.href;
    } else if (!runtimeUrl) {
      throw new Error("Existing role has no locally saved credential; no reset attempted");
    }
    if (!runtimeUrl) throw new Error("Missing runtime credential");
    const runtime = new URL(runtimeUrl);
    if (
      runtime.username !== "atlas_api" ||
      runtime.hostname !== pooled.hostname ||
      runtime.pathname !== pooled.pathname
    )
      throw new Error("Runtime target mismatch");
    const flags = await admin.query(
      "SELECT rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit FROM pg_roles WHERE rolname='atlas_api'",
    );
    const row = flags.rows[0];
    if (
      !row?.rolcanlogin ||
      row.rolsuper ||
      row.rolbypassrls ||
      row.rolcreatedb ||
      row.rolcreaterole ||
      row.rolinherit
    )
      throw new Error("Unexpected role privileges");
    const membership = await admin.query(
      "SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='atlas_api'",
    );
    if (membership.rowCount) throw new Error("Unexpected role membership");
    // Save generated credentials before committing role creation, allowing safe recovery.
    // The original Neon-managed values remain intact; deploy/env pull can refresh them.
    const additions: Record<string, string> = {
      ATLAS_DATABASE_URL: runtimeUrl,
      VITE_NEON_AUTH_URL: target.authBaseUrl,
      DATABASE_TARGET_ID: `${target.projectId}:${target.branchId}:${target.databaseName}`,
    };
    let updated = original;
    for (const [key, value] of Object.entries(additions)) {
      if (/[\r\n]/.test(value)) throw new Error("Invalid configuration value");
      const pattern = new RegExp(`^${key}=.*$`, "m");
      updated = pattern.test(updated)
        ? updated.replace(pattern, `${key}=${value}`)
        : `${updated.trimEnd()}\n${key}=${value}\n`;
    }
    await writeFile(file, updated, { mode: 0o600 });
    await admin.query("COMMIT");
  } catch (error) {
    await admin.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await admin.end();
  }
  stage = "application connection verification";
  const client = new pg.Client({ connectionString: runtimeUrl, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT current_user AS role, current_database() AS database",
    );
    if (result.rows[0]?.role !== "atlas_api" || result.rows[0]?.database !== "neondb")
      throw new Error("Connected identity mismatch");
  } finally {
    await client.end();
  }
  process.stdout.write(
    "Configured restricted atlas_api connection and public Vite Auth alias in ignored .env.local. Target verified; no credentials printed.\n",
  );
} catch (error) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]+$/.test(error.code)
      ? ` (${error.code})`
      : "";
  process.stderr.write(`Neon runtime setup failed during ${stage}${code}; credentials redacted.\n`);
  process.exitCode = 1;
}
