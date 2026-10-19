import { generateKeyPairSync, sign, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  assertLocalTestTarget,
  createPool,
  applyMigrations,
  readMigrations,
  inTransaction,
  bindOwner,
  createOwnerWorkspace,
  createIdentityVerifier,
} from "@atlas/core";
import { collectionSeedSchema } from "@atlas/contracts";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { createVaultServices } from "../../apps/api/src/vault.js";

const connection = (key: string) => {
  const value = process.env[key] ?? "";
  assertLocalTestTarget(value, process.env.DATABASE_TARGET_ID);
  return value;
};
const admin = createPool(connection("ATLAS_TEST_ADMIN_URL"), "atlas-owner-fixtures");
const api = createPool(connection("ATLAS_TEST_API_URL"), "atlas-owner-api");
const identity = { issuer: "https://owner.fixture.example", subject: "bound-owner" };
const keys = generateKeyPairSync("ed25519");
const otherKeys = generateKeyPairSync("ed25519");
function token(claims: Record<string, unknown> = {}, wrong = false) {
  const now = Math.floor(Date.now() / 1000);
  const parts = [
    { alg: "EdDSA", typ: "JWT" },
    { iss: identity.issuer, sub: identity.subject, iat: now, exp: now + 3600, ...claims },
  ].map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"));
  const body = parts.join(".");
  return `${body}.${sign(null, Buffer.from(body), wrong ? otherKeys.privateKey : keys.privateKey).toString("base64url")}`;
}
const vault = createVaultServices(
  api,
  createIdentityVerifier(identity.issuer, keys.publicKey),
  identity,
  "fixture",
);
const app = createApp(loadConfig({ NODE_ENV: "test" }), undefined, vault);
let workspace: string, user: string;
const otherWorkspace = randomUUID(),
  otherUser = randomUUID();
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  key = randomUUID(),
  bearer = token(),
) {
  return app.request(`http://localhost:4317/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function create(kind: "projects" | "collections", body: unknown) {
  const response = await request(`/workspaces/${workspace}/${kind}`, "POST", body);
  expect(response.status).toBe(201);
  return response.json();
}
async function setup<T>(work: Parameters<typeof inTransaction<T>>[1]) {
  return inTransaction(admin, async (c) => {
    await c.query("SET LOCAL ROLE atlas_owner");
    return work(c);
  });
}
beforeAll(async () => {
  await applyMigrations(admin, await readMigrations(resolve("database/migrations")));
  await admin.query("TRUNCATE atlas.app_users CASCADE");
  const seeds = collectionSeedSchema.parse(
    JSON.parse(await readFile("database/seeds/collections.json", "utf8")),
  );
  const first = await setup((c) => bindOwner(c, identity, seeds));
  workspace = first.workspaceId ?? "";
  user = first.userId;
  expect(await setup((c) => bindOwner(c, identity, seeds))).toEqual(first);
  await expect(
    setup((c) => bindOwner(c, { ...identity, subject: "another-owner" }, seeds)),
  ).rejects.toThrow("Access denied");
  await setup(async (c) => {
    await c.query("INSERT INTO atlas.app_users(id,issuer,subject) VALUES($1,$2,$3)", [
      otherUser,
      identity.issuer,
      "other-owner",
    ]);
    await createOwnerWorkspace(c, {
      ownerUserId: otherUser,
      workspaceId: otherWorkspace,
      name: "Other private workspace",
      collections: seeds,
    });
  });
});
afterAll(async () => {
  await admin.query("TRUNCATE atlas.app_users CASCADE");
  await Promise.all([admin.end(), api.end()]);
});

describe("bound owner HTTP and signed JWTs", () => {
  it("binds idempotently with 72 collections and resolves only the configured owner", async () => {
    const me = await request("/me");
    expect(me.status).toBe(200);
    expect((await me.json()).workspace.id).toBe(workspace);
    const snapshot = await request(`/workspaces/${workspace}/organization`);
    expect(snapshot.status).toBe(200);
    expect((await snapshot.json()).collections).toHaveLength(72);
    expect(
      (await request("/me", "GET", undefined, randomUUID(), token({ sub: "other-owner" }))).status,
    ).toBe(403);
    expect((await request(`/workspaces/${otherWorkspace}/organization`)).status).toBe(404);
  });
  it("rejects missing/invalid signatures, wrong issuer, expired/future tokens and missing subjects", async () => {
    expect((await app.request("http://localhost:4317/api/v1/me")).status).toBe(401);
    for (const bearer of [
      token({}, true),
      token({ iss: "https://wrong.example" }),
      token({ exp: 1 }),
      token({ iat: Math.floor(Date.now() / 1000) + 300 }),
      token({ sub: undefined }),
      "atlas_forged",
    ])
      expect((await request("/me", "GET", undefined, randomUUID(), bearer)).status).toBe(401);
  });
  it("rechecks disabled owner and membership on every HTTP request", async () => {
    await admin.query("UPDATE atlas.app_users SET disabled_at=now() WHERE id=$1", [user]);
    try {
      expect((await request("/me")).status).toBe(403);
    } finally {
      await admin.query("UPDATE atlas.app_users SET disabled_at=NULL WHERE id=$1", [user]);
    }
    await admin.query("DELETE FROM atlas_private.workspace_members WHERE workspace_id=$1", [
      workspace,
    ]);
    try {
      expect((await request("/me")).status).toBe(403);
    } finally {
      await admin.query(
        "INSERT INTO atlas_private.workspace_members(workspace_id,user_id,created_by_user_id) VALUES($1,$2,$2)",
        [workspace, user],
      );
    }
    expect((await request("/me")).headers.get("cache-control")).toBe("no-store");
  });
  it("refuses fixture authentication in production and caller-supplied identity fields", async () => {
    expect(() => createApp(loadConfig({ NODE_ENV: "production" }), undefined, vault)).toThrow(
      "Fixture",
    );
    const r = await request(`/workspaces/${workspace}/projects`, "POST", {
      name: "Forged",
      slug: "forged",
      user_id: otherUser,
    });
    expect(r.status).toBe(400);
    expect(await r.text()).not.toContain(otherUser);
  });
});
describe("persistent projects and collections via authorized HTTP", () => {
  it("persists a committed project across two separate Node processes and connection pools", async () => {
    const execute = promisify(execFile);
    const probe = async (mode: string) =>
      JSON.parse(
        (
          await execute(
            process.execPath,
            ["--import", "tsx", "tests/fixtures/organization-process.ts", mode, workspace],
            { env: { ...process.env, NODE_ENV: "test" }, timeout: 10000 },
          )
        ).stdout,
      );
    const first = await probe("write"),
      second = await probe("read");
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(first.pid).not.toBe(second.pid);
    expect(second.data.find((p: { id: string }) => p.id === first.data.id)?.slug).toBe(
      "restart-persistence",
    );
  });
  it("creates once with idempotency, rejects key reuse with different content and stale edits", async () => {
    const key = randomUUID(),
      path = `/workspaces/${workspace}/projects`,
      payload = { name: "Clinic", slug: "clinic" };
    const a = await request(path, "POST", payload, key),
      b = await request(path, "POST", payload, key);
    expect(a.status).toBe(201);
    expect(await b.json()).toEqual(await a.clone().json());
    expect((await request(path, "POST", { ...payload, name: "Changed" }, key)).status).toBe(409);
    const project = await a.json();
    expect(
      (
        await request(`/projects/${project.id}`, "PATCH", {
          expected_revision: 1,
          name: "Clinic renamed",
        })
      ).status,
    ).toBe(200);
    expect(
      (await request(`/projects/${project.id}`, "PATCH", { expected_revision: 1, name: "Stale" }))
        .status,
    ).toBe(409);
    expect(
      (await request(`/projects/${project.id}`, "PATCH", { expected_revision: 2, archived: true }))
        .status,
    ).toBe(200);
    const fresh = createApp(
      loadConfig({ NODE_ENV: "test" }),
      undefined,
      createVaultServices(api, vault.verify, identity, "fixture"),
    );
    const reloaded = await fresh.request(
      `http://localhost:4317/api/v1/workspaces/${workspace}/projects`,
      { headers: { Authorization: `Bearer ${token()}` } },
    );
    expect(
      (await reloaded.json()).find((p: { id: string }) => p.id === project.id).archived_at,
    ).toBeTruthy();
  });
  it("serializes conflicting revision updates so exactly one concurrent edit wins", async () => {
    const p = await create("projects", { name: "Concurrent", slug: "concurrent" });
    const results = await Promise.all(
      ["One", "Two"].map((name) =>
        request(`/projects/${p.id}`, "PATCH", { name, expected_revision: 1 }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });
  it("requires mutation keys and bounds project/collection fields", async () => {
    expect(
      (
        await request(`/projects/${randomUUID()}`, "PATCH", {
          name: "Hidden",
          expected_revision: 1,
        })
      ).status,
    ).toBe(404);
    const r = await app.request(`http://localhost:4317/api/v1/workspaces/${workspace}/projects`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No key", slug: "no-key" }),
    });
    expect(r.status).toBe(400);
    expect(
      (await request(`/workspaces/${workspace}/collections`, "POST", { name: "x".repeat(161) }))
        .status,
    ).toBe(400);
    expect(
      (
        await request(`/workspaces/${workspace}/collections`, "POST", {
          name: "Foreign",
          parent_id: randomUUID(),
        })
      ).status,
    ).toBe(400);
  });
  it("renames/moves nested collections and rejects cycles and duplicate sibling names atomically", async () => {
    const a = await create("collections", { name: "Move A" }),
      b = await create("collections", { name: "Move B", parent_id: a.id });
    expect(
      (await request(`/collections/${a.id}`, "PATCH", { expected_revision: 1, parent_id: b.id }))
        .status,
    ).toBe(409);
    expect(
      (
        await request(`/collections/${b.id}`, "PATCH", {
          expected_revision: 1,
          name: "Moved",
          parent_id: null,
        })
      ).status,
    ).toBe(200);
    expect(
      (await request(`/workspaces/${workspace}/collections`, "POST", { name: " moved " })).status,
    ).toBe(409);
    expect(
      (await request(`/collections/${b.id}`, "PATCH", { expected_revision: 2, archived: true }))
        .status,
    ).toBe(200);
  });
  it("preserves manual exclusions and refuses contradictory manual overrides during merges", async () => {
    const source = await create("collections", { name: "Exclusion source" }),
      target = await create("collections", { name: "Exclusion target" }),
      item = randomUUID();
    await setup(async (c) => {
      await c.query(
        "INSERT INTO atlas.knowledge_items(workspace_id,id,kind,title,scope,access_partition,created_by_user_id) VALUES($1,$2,'source','Excluded note','personal','personal:'||$3::uuid::text,$3::uuid)",
        [workspace, item, user],
      );
      await c.query(
        "INSERT INTO atlas.sources(workspace_id,id,input_type,created_by_user_id) VALUES($1,$2,'note',$3)",
        [workspace, item, user],
      );
      await c.query(
        "INSERT INTO atlas.classification_overrides(workspace_id,source_id,collection_id,decision,actor_user_id,created_by_user_id) VALUES($1,$2,$3,'exclude',$4,$4),($1,$2,$5,'include',$4,$4)",
        [workspace, item, source.id, user, target.id],
      );
    });
    const payload = { target_id: target.id, expected_revision: 1, target_revision: 1 };
    expect((await request(`/collections/${source.id}/merge`, "POST", payload)).status).toBe(409);
    await admin.query(
      "UPDATE atlas.classification_overrides SET decision='exclude' WHERE workspace_id=$1 AND collection_id=$2",
      [workspace, target.id],
    );
    expect((await request(`/collections/${source.id}/merge`, "POST", payload)).status).toBe(200);
    expect(
      (
        await admin.query(
          "SELECT collection_id,decision FROM atlas.classification_overrides WHERE workspace_id=$1 AND source_id=$2",
          [workspace, item],
        )
      ).rows,
    ).toEqual([{ collection_id: target.id, decision: "exclude" }]);
  });
  it("requires explicit child collision mapping and preserves children and canonical item identity during merge", async () => {
    const source = await create("collections", { name: "Merge source" }),
      target = await create("collections", { name: "Merge target" });
    const child = await create("collections", { name: "Same child", parent_id: source.id }),
      other = await create("collections", { name: "Same child", parent_id: target.id }),
      unique = await create("collections", { name: "Unique child", parent_id: source.id });
    const item = randomUUID();
    await setup(async (c) => {
      await c.query(
        "INSERT INTO atlas.knowledge_items(workspace_id,id,kind,title,scope,access_partition,created_by_user_id) VALUES($1,$2,'source','Original source','personal','personal:'||$3::uuid::text,$3::uuid)",
        [workspace, item, user],
      );
      await c.query(
        "INSERT INTO atlas.collection_items(workspace_id,collection_id,item_id,origin,locked,created_by_user_id) VALUES($1,$2,$3,'manual',true,$4),($1,$5,$3,'ai',false,$4)",
        [workspace, source.id, item, user, target.id],
      );
    });
    const payload = { target_id: target.id, expected_revision: 1, target_revision: 1 };
    expect((await request(`/collections/${source.id}/merge`, "POST", payload)).status).toBe(409);
    const response = await request(`/collections/${source.id}/merge`, "POST", {
      ...payload,
      child_conflicts: { [child.id]: other.id },
    });
    expect(response.status).toBe(200);
    expect((await response.json()).merged_into_id).toBe(target.id);
    const memberships = await admin.query(
      "SELECT collection_id,item_id,origin,locked FROM atlas.collection_items WHERE workspace_id=$1 AND item_id=$2",
      [workspace, item],
    );
    expect(memberships.rows).toEqual([
      { collection_id: target.id, item_id: item, origin: "manual", locked: true },
    ]);
    expect(
      (
        await admin.query(
          "SELECT parent_id FROM atlas.collections WHERE workspace_id=$1 AND id=$2",
          [workspace, unique.id],
        )
      ).rows[0].parent_id,
    ).toBe(target.id);
    expect(
      (
        await admin.query(
          "SELECT count(*)::int AS count FROM atlas.knowledge_items WHERE workspace_id=$1 AND id=$2",
          [workspace, item],
        )
      ).rows[0].count,
    ).toBe(1);
  });
});
