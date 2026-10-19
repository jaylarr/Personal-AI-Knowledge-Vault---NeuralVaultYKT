import { randomBytes, createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import pg from "pg";
import {
  createPool,
  readMigrations,
  applyMigrations,
  inTransaction,
  bindOwner,
  withPrincipal,
  createOwnerWorkspace,
} from "@atlas/core";
import { collectionSeedSchema } from "@atlas/contracts";
import { readNeonSetup, assertNeonMigrationTarget, updateEnv } from "./neon-target.js";
let stage = "target validation";
try {
  const mode = process.argv[2];
  if (!["rehearsal", "production"].includes(mode ?? ""))
    throw Error("Choose an explicit Neon setup mode");
  const { target, env, original } = await readNeonSetup();
  const rehearsal = mode === "rehearsal",
    host = rehearsal ? target.rehearsal.endpointHost : target.endpointHost;
  const direct = new URL(assertNeonMigrationTarget(env));
  direct.hostname = host;
  const apiUrl = new URL(env.ATLAS_DATABASE_URL ?? "");
  if (
    apiUrl.username !== "atlas_api" ||
    apiUrl.hostname !== target.endpointHost.replace(".c-", "-pooler.c-") ||
    apiUrl.pathname !== "/neondb"
  )
    throw Error("Runtime URL mismatch");
  apiUrl.hostname = host.replace(".c-", "-pooler.c-");
  apiUrl.searchParams.set("sslmode", "verify-full");
  const migrations = await readMigrations(resolve("database/migrations"));
  const checksum = createHash("sha256")
    .update(JSON.stringify(migrations.map((m) => [m.name, m.checksum])))
    .digest("hex");
  if (!rehearsal) {
    const receipt = JSON.parse(await readFile(".local/neon-schema-rehearsal.json", "utf8")) as {
      checksum: string;
      branchId: string;
      passed: boolean;
    };
    if (
      receipt.checksum !== checksum ||
      receipt.branchId !== target.rehearsal.branchId ||
      !receipt.passed
    )
      throw Error("Matching rehearsal required");
  }
  const admin = createPool(direct.href, "atlas-neon-domain-setup");
  let workerUrl: string | undefined;
  const outputFile = rehearsal ? ".local/neon-rehearsal.env" : ".env.local";
  let saved: Record<string, string | undefined> = {};
  try {
    saved = parseEnv(await readFile(outputFile, "utf8"));
  } catch {
    /* First rehearsal. */
  }
  try {
    stage = "role bootstrap";
    await inTransaction(admin, async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(4317,1801)");
      const identity = (await c.query("SELECT current_user AS role,current_database() AS db"))
        .rows[0];
      if (identity.role !== "neondb_owner" || identity.db !== "neondb")
        throw Error("Migration login mismatch");
      const owner = await c.query("SELECT 1 FROM pg_roles WHERE rolname='atlas_owner'");
      if (!owner.rowCount)
        await c.query(
          "CREATE ROLE atlas_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS",
        );
      const flags = (
        await c.query(
          "SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolbypassrls FROM pg_roles WHERE rolname='atlas_owner'",
        )
      ).rows[0];
      if (!flags || Object.values(flags).some(Boolean)) throw Error("Unexpected owner privileges");
      await c.query("GRANT atlas_owner TO neondb_owner WITH SET TRUE");
      const worker = await c.query("SELECT 1 FROM pg_roles WHERE rolname='atlas_worker'");
      if (!worker.rowCount) {
        const password = randomBytes(32).toString("hex");
        await c.query(
          `CREATE ROLE atlas_worker LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${pg.escapeLiteral(password)}`,
        );
        const url = new URL(apiUrl);
        url.username = "atlas_worker";
        url.password = password;
        workerUrl = url.href;
      } else {
        workerUrl = saved.WORKER_DATABASE_URL;
        if (!workerUrl)
          throw Error("Existing worker credential missing; no password reset attempted");
      }
      for (const role of ["atlas_api", "atlas_worker"]) {
        const row = (
          await c.query(
            "SELECT rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit FROM pg_roles WHERE rolname=$1",
            [role],
          )
        ).rows[0];
        if (
          !row?.rolcanlogin ||
          row.rolsuper ||
          row.rolbypassrls ||
          row.rolcreatedb ||
          row.rolcreaterole ||
          row.rolinherit
        )
          throw Error("Unexpected runtime privileges");
        if (
          (
            await c.query(
              "SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=$1",
              [role],
            )
          ).rowCount
        )
          throw Error("Unexpected runtime memberships");
      }
      const checked = new URL(workerUrl ?? "");
      if (
        checked.username !== "atlas_worker" ||
        checked.hostname !== apiUrl.hostname ||
        checked.pathname !== "/neondb"
      )
        throw Error("Worker target mismatch");
      const content = rehearsal ? "" : original;
      await writeFile(
        outputFile,
        updateEnv(content, { ATLAS_DATABASE_URL: apiUrl.href, WORKER_DATABASE_URL: checked.href }),
        { mode: 0o600 },
      );
    });
    stage = "domain migrations";
    const completed = await applyMigrations(admin, migrations);
    process.stdout.write(
      `${mode}: ${completed.length} domain migration(s) applied; checksums verified.\n`,
    );
    stage = "catalog and restricted-role verification";
    const tables = await admin.query(
      "SELECT count(*)::int AS count,bool_and(c.relrowsecurity AND r.rolname='atlas_owner') AS isolated FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname IN ('atlas','atlas_private') AND c.relkind='r'",
    );
    if (tables.rows[0]?.count !== 42 || !tables.rows[0]?.isolated)
      throw Error("Domain catalog mismatch");
    const api = createPool(apiUrl.href, "atlas-neon-api-verification"),
      worker = createPool(workerUrl ?? "", "atlas-neon-worker-verification");
    try {
      for (const pool of [api, worker]) {
        if ((await pool.query("SELECT id FROM atlas.knowledge_items")).rowCount)
          throw Error("Missing context exposed knowledge");
        let denied = false;
        try {
          await pool.query("SELECT token_digest FROM atlas_private.agent_credentials");
        } catch (e) {
          denied = (e as { code?: string }).code === "42501";
        }
        if (!denied) throw Error("Private ACL exposed");
      }
      if (rehearsal) {
        const seeds = collectionSeedSchema.parse(
          JSON.parse(await readFile("database/seeds/collections.json", "utf8")),
        );
        const fixture = {
          issuer: "https://rehearsal.example.invalid",
          subject: "schema-rehearsal-owner",
        };
        const owner = await inTransaction(admin, async (c) => {
          await c.query("SET LOCAL ROLE atlas_owner");
          const existing = await c.query(
            'SELECT u.id AS "userId",w.id AS "workspaceId" FROM atlas.app_users u JOIN atlas.workspaces w ON w.owner_user_id=u.id WHERE u.issuer=$1 AND u.subject=$2',
            [fixture.issuer, fixture.subject],
          );
          if (existing.rows[0]) return existing.rows[0] as { userId: string; workspaceId: string };
          return bindOwner(c, fixture, seeds);
        });
        if (!owner.workspaceId) throw Error("Rehearsal binding failed");
        const other = randomUUID();
        await inTransaction(admin, async (c) => {
          await c.query("SET LOCAL ROLE atlas_owner");
          if (
            (
              await c.query("SELECT id FROM atlas.app_users WHERE issuer=$1 AND subject=$2", [
                fixture.issuer,
                "other-owner",
              ])
            ).rowCount
          )
            return;
          await c.query("INSERT INTO atlas.app_users(id,issuer,subject) VALUES($1,$2,$3)", [
            other,
            fixture.issuer,
            "other-owner",
          ]);
          await createOwnerWorkspace(c, {
            ownerUserId: other,
            workspaceId: randomUUID(),
            name: "Isolation rehearsal",
            collections: seeds,
          });
        });
        const own = await withPrincipal(
          api,
          { kind: "human", userId: owner.userId, ...fixture },
          owner.workspaceId,
          async (c) => ({
            workspaces: (await c.query("SELECT id FROM atlas.workspaces")).rowCount,
            collections: (await c.query("SELECT id FROM atlas.collections")).rowCount,
          }),
        );
        if (own.workspaces !== 1 || own.collections !== 72)
          throw Error("Rehearsal owner isolation failed");
        await writeFile(
          ".local/neon-schema-rehearsal.json",
          JSON.stringify(
            {
              checksum,
              branchId: target.rehearsal.branchId,
              passed: true,
              verifiedAt: new Date().toISOString(),
            },
            null,
            2,
          ),
        );
        process.stdout.write(
          "Rehearsal: real non-owner connections enforce workspace isolation (1 workspace / 72 own collections), missing-context denial and private credential denial.\n",
        );
      }
    } finally {
      await Promise.all([api.end(), worker.end()]);
    }
    process.stdout.write(
      `${mode}: 42 atlas_owner tables have RLS; API/worker are restricted logins; private credentials denied.\n`,
    );
  } finally {
    await admin.end();
  }
} catch (e) {
  const code = (e as { code?: string }).code;
  process.stderr.write(
    `Neon domain setup failed at ${stage}${code && /^[A-Z0-9]+$/.test(code) ? ` (${code})` : ""}; credentials/details redacted.\n`,
  );
  process.exitCode = 1;
}
