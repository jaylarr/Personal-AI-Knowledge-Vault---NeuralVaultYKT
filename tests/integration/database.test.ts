import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyMigrations,
  assertLocalTestTarget,
  createPool,
  inTransaction,
  readMigrations,
  withPrincipal,
} from "@atlas/core";

function configured(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing isolated test configuration: ${key}`);
  assertLocalTestTarget(value, process.env.DATABASE_TARGET_ID);
  return value;
}
const admin = createPool(configured("ATLAS_TEST_ADMIN_URL"), "atlas-harness-admin");
const api = createPool(configured("ATLAS_TEST_API_URL"), "atlas-harness-api");
api.options.max = 1;
const worker = createPool(configured("ATLAS_TEST_WORKER_URL"), "atlas-harness-worker");
const workspace = "00000000-0000-4000-8000-000000000001";
const ownerA = "00000000-0000-4000-8000-000000000002";
const ownerB = "00000000-0000-4000-8000-000000000003";
const human = (userId: string) => ({
  kind: "human" as const,
  userId,
  issuer: "https://fixture.example",
  subject: userId,
});

beforeAll(async () => {
  await applyMigrations(admin, await readMigrations(resolve("database/migrations")));
  await admin.query(`CREATE SCHEMA IF NOT EXISTS atlas_harness;
    CREATE TABLE IF NOT EXISTS atlas_harness.context_probe(owner_id uuid NOT NULL,value text NOT NULL);
    TRUNCATE atlas_harness.context_probe;
    ALTER TABLE atlas_harness.context_probe ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS probe_owner ON atlas_harness.context_probe;
    CREATE POLICY probe_owner ON atlas_harness.context_probe USING (
      owner_id = nullif(current_setting('app.user_id',true),'')::uuid
      AND current_setting('app.principal_kind',true)='human'
    ) WITH CHECK (owner_id = nullif(current_setting('app.user_id',true),'')::uuid);
    GRANT USAGE ON SCHEMA atlas_harness TO atlas_api,atlas_worker;
    GRANT SELECT,INSERT ON atlas_harness.context_probe TO atlas_api,atlas_worker;`);
  await admin.query(
    "INSERT INTO atlas_harness.context_probe VALUES($1,'owner-a-only'),($2,'owner-b-only')",
    [ownerA, ownerB],
  );
});
afterAll(async () => {
  await Promise.all([api.end(), worker.end(), admin.end()]);
});

describe("guarded real PostgreSQL foundation", () => {
  it("uses PostgreSQL 18 and actual restricted application roles", async () => {
    const version = await admin.query<{ server_version_num: string }>("SHOW server_version_num");
    expect(Number(version.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(180000);
    expect(Number(version.rows[0]?.server_version_num)).toBeLessThan(190000);
    for (const pool of [api, worker]) {
      const flags = await pool.query(
        "SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user",
      );
      expect(Object.values(flags.rows[0])).toEqual([false, false, false, false]);
    }
  });
  it("replays checksummed migrations without change", async () => {
    expect(
      await applyMigrations(admin, await readMigrations(resolve("database/migrations"))),
    ).toEqual([]);
  });
  it("rejects altered applied migration content", async () => {
    const migrations = await readMigrations(resolve("database/migrations"));
    const first = migrations[0];
    if (!first) throw new Error("Foundation migration missing");
    await expect(applyMigrations(admin, [{ ...first, checksum: "0".repeat(64) }])).rejects.toThrow(
      "Migration history mismatch",
    );
  });
  it("rolls back an entire failed migration including journal entry", async () => {
    const sql =
      "CREATE TABLE atlas_harness.must_rollback(id int); SELECT missing_column FROM atlas_harness.must_rollback;";
    await expect(
      applyMigrations(admin, [
        ...(await readMigrations(resolve("database/migrations"))),
        {
          name: "9999_failure_probe.sql",
          sql,
          checksum: createHash("sha256").update(sql).digest("hex"),
        },
      ]),
    ).rejects.toThrow();
    const check = await admin.query(
      "SELECT to_regclass('atlas_harness.must_rollback') AS relation",
    );
    expect(check.rows[0].relation).toBeNull();
    expect(
      (
        await admin.query(
          "SELECT 1 FROM public.schema_migrations WHERE name='9999_failure_probe.sql'",
        )
      ).rowCount,
    ).toBe(0);
  });
  it("denies missing principal context", async () => {
    expect((await api.query("SELECT value FROM atlas_harness.context_probe")).rows).toEqual([]);
  });
  it("keeps identity on the same client and clears it across pooled owner requests", async () => {
    const rowsA = await withPrincipal(
      api,
      human(ownerA),
      workspace,
      async (client) => (await client.query("SELECT value FROM atlas_harness.context_probe")).rows,
    );
    const rowsB = await withPrincipal(
      api,
      human(ownerB),
      workspace,
      async (client) => (await client.query("SELECT value FROM atlas_harness.context_probe")).rows,
    );
    expect(rowsA).toEqual([{ value: "owner-a-only" }]);
    expect(rowsB).toEqual([{ value: "owner-b-only" }]);
    expect((await api.query("SELECT value FROM atlas_harness.context_probe")).rows).toEqual([]);
  });
  it("clears principal and rolls back mutations after callback failure", async () => {
    await expect(
      withPrincipal(api, human(ownerA), workspace, async (client) => {
        await client.query("INSERT INTO atlas_harness.context_probe VALUES($1,'must-rollback')", [
          ownerA,
        ]);
        throw new Error("intentional failure");
      }),
    ).rejects.toThrow("intentional failure");
    expect(
      (await admin.query("SELECT 1 FROM atlas_harness.context_probe WHERE value='must-rollback'"))
        .rowCount,
    ).toBe(0);
    expect((await api.query("SELECT value FROM atlas_harness.context_probe")).rows).toEqual([]);
  });
  it("rejects cross-owner writes and releases failed clients", async () => {
    await expect(
      withPrincipal(api, human(ownerA), workspace, (client) =>
        client.query("INSERT INTO atlas_harness.context_probe VALUES($1,'forged')", [ownerB]),
      ),
    ).rejects.toThrow();
    expect(
      await inTransaction(api, async (client) => (await client.query("SELECT 1 AS ok")).rows[0].ok),
    ).toBe(1);
  });
  it("does not grant worker human identity or approval access", async () => {
    expect((await worker.query("SELECT value FROM atlas_harness.context_probe")).rows).toEqual([]);
    await expect(worker.query("SELECT * FROM public.schema_migrations")).rejects.toThrow();
  });
  it("rejects agent workspace mismatch before checking out a client", async () => {
    await expect(
      withPrincipal(
        api,
        { kind: "agent", agentId: ownerA, credentialId: ownerB, workspaceId: workspace },
        ownerB,
        async () => true,
      ),
    ).rejects.toThrow("Agent workspace mismatch");
  });
});
