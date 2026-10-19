import { randomUUID, randomBytes, createHash } from "node:crypto";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { serve } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import {
  createPool,
  assertLocalTestTarget,
  readMigrations,
  applyMigrations,
  inTransaction,
  withPrincipal,
} from "@atlas/core";
import { projectContextSchema } from "@atlas/contracts";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { createVaultServices } from "../../apps/api/src/vault.js";
const connection = (key: string) => {
  const v = process.env[key] ?? "";
  assertLocalTestTarget(v, process.env.DATABASE_TARGET_ID);
  return v;
};
const admin = createPool(connection("ATLAS_TEST_ADMIN_URL"), "atlas-agent-fixture"),
  api = createPool(connection("ATLAS_TEST_API_URL"), "atlas-agent-api");
const w = randomUUID(),
  owner = randomUUID(),
  agent = randomUUID(),
  credential = randomUUID(),
  otherAgent = randomUUID(),
  otherCredential = randomUUID();
const token = `atlas_${randomBytes(32).toString("base64url")}`,
  otherToken = `atlas_${randomBytes(32).toString("base64url")}`;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const identity = { issuer: "https://agent-workflow.fixture.example", subject: owner };
const principal = {
  kind: "agent" as const,
  workspaceId: w,
  agentId: agent,
  credentialId: credential,
};
const vault = createVaultServices(
  api,
  async () => {
    throw Error("No human fixture token used");
  },
  identity,
  "fixture",
);
const app = createApp(loadConfig({ NODE_ENV: "test", API_PORT: "4319" }), undefined, vault);
const note = {
  title: "Observed agent workflow",
  kind: "decision",
  markdown: "Observed: project registration and checkpoints use scoped credentials.",
  provenance: { paths: ["AGENTS.md"], verification: "Controlled PostgreSQL/HTTP fixture" },
  request_key: "test-request-12345",
};
async function post(path: string, body: unknown, bearer = token) {
  return app.request(`http://127.0.0.1:4319/api/v1/agent${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function ensure(key: string) {
  const r = await post("/projects/ensure", {
    repository_digest: hash(key),
    name: "Agent workflow fixture",
  });
  expect(r.status).toBe(200);
  return (await r.json()) as { id: string };
}
beforeAll(async () => {
  await applyMigrations(admin, await readMigrations(resolve("database/migrations")));
  await inTransaction(admin, async (c) => {
    await c.query("SET LOCAL ROLE atlas_owner");
    await c.query("INSERT INTO atlas.app_users(id,issuer,subject) VALUES($1,$2,$3)", [
      owner,
      identity.issuer,
      owner,
    ]);
    await c.query(
      "INSERT INTO atlas.workspaces(id,owner_user_id,name) VALUES($1,$2,'Agent workflow fixture')",
      [w, owner],
    );
    await c.query(
      "INSERT INTO atlas_private.workspace_members(workspace_id,user_id) VALUES($1,$2)",
      [w, owner],
    );
    for (const [a, id, t, ops] of [
      [agent, credential, token, ["read", "manage_projects", "capture_checkpoint"]],
      [otherAgent, otherCredential, otherToken, ["read"]],
    ] as const) {
      await c.query(
        "INSERT INTO atlas.agents(workspace_id,id,name,type) VALUES($1,$2,'Fixture agent','codex')",
        [w, a],
      );
      await c.query(
        "INSERT INTO atlas_private.agent_credentials(workspace_id,id,agent_id,token_digest,display_prefix,expires_at,operations) VALUES($1,$2,$3,$4,$5,now()+interval '1 hour',$6)",
        [w, id, a, hash(t), t.slice(0, 14), ops],
      );
    }
  });
});
afterAll(async () => {
  await Promise.all([admin.end(), api.end()]);
});
describe("agent-first project knowledge", () => {
  it("concurrent ensures create one project with true agent provenance", async () => {
    const key = randomUUID(),
      projects = await Promise.all(Array.from({ length: 6 }, () => ensure(key)));
    expect(new Set(projects.map((p) => p.id)).size).toBe(1);
    const p = (
      await admin.query(
        "SELECT created_by_user_id,created_by_agent_id FROM atlas.projects WHERE workspace_id=$1 AND id=$2",
        [w, projects[0]?.id],
      )
    ).rows[0];
    expect(p).toEqual({ created_by_user_id: null, created_by_agent_id: agent });
  });
  it("append-only capture persists, deduplicates content and binds every retry alias", async () => {
    const p = await ensure(randomUUID());
    const a = await post(`/projects/${p.id}/checkpoints`, note),
      first = (await a.json()) as { id: string };
    expect(a.status).toBe(201);
    const retry = await post(`/projects/${p.id}/checkpoints`, {
      ...note,
      request_key: "alternate-key-123",
    });
    expect(((await retry.json()) as { id: string }).id).toBe(first.id);
    expect(
      (
        await post(`/projects/${p.id}/checkpoints`, {
          ...note,
          request_key: "alternate-key-123",
          markdown: "Changed",
        })
      ).status,
    ).toBe(409);
    const read = await post(`/projects/${p.id}/context`, {}),
      context = projectContextSchema.parse(await read.json());
    expect(context.checkpoints).toHaveLength(1);
    expect(context.checkpoints[0]?.markdown).toBe(note.markdown);
    await expect(
      withPrincipal(api, principal, w, (c) =>
        c.query("UPDATE atlas.project_checkpoints SET title='changed' WHERE id=$1", [first.id]),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    const human = { kind: "human" as const, userId: owner, ...identity };
    const own = await withPrincipal(api, human, w, (c) =>
      c.query("SELECT id FROM atlas.project_checkpoints WHERE id=$1", [first.id]),
    );
    expect(own.rowCount).toBe(1);
  });
  it("denies project creation without its explicit capability", async () => {
    expect(
      (
        await post(
          "/projects/ensure",
          { repository_digest: hash(randomUUID()), name: "Denied" },
          otherToken,
        )
      ).status,
    ).toBe(403);
  });
  it("denies another agent direct reads and capture into a known UUID", async () => {
    const p = await ensure(randomUUID());
    await post(`/projects/${p.id}/checkpoints`, note);
    expect((await post(`/projects/${p.id}/context`, {}, otherToken)).status).toBe(404);
    expect((await post(`/projects/${p.id}/checkpoints`, note, otherToken)).status).toBe(404);
    const rows = await withPrincipal(
      api,
      { ...principal, agentId: otherAgent, credentialId: otherCredential },
      w,
      (c) => c.query("SELECT id FROM atlas.project_checkpoints WHERE project_id=$1", [p.id]),
    );
    expect(rows.rowCount).toBe(0);
  });
  it("blocks credentials before saving any checkpoint", async () => {
    const p = await ensure(randomUUID());
    expect(
      (
        await post(`/projects/${p.id}/checkpoints`, {
          ...note,
          markdown: `atlas_${"a".repeat(43)}`,
        })
      ).status,
    ).toBe(400);
    expect(
      projectContextSchema.parse(await (await post(`/projects/${p.id}/context`, {})).json())
        .checkpoints,
    ).toHaveLength(0);
  });
  it("respects revoked project grants and never regrants them via ensure", async () => {
    const key = randomUUID(),
      p = await ensure(key);
    await admin.query(
      "UPDATE atlas_private.agent_project_grants SET read=false,propose=false WHERE workspace_id=$1 AND project_id=$2 AND agent_id=$3",
      [w, p.id, agent],
    );
    expect(
      (await post("/projects/ensure", { repository_digest: hash(key), name: "Same project" }))
        .status,
    ).toBe(403);
    expect((await post(`/projects/${p.id}/context`, {})).status).toBe(404);
    expect(
      (
        await admin.query(
          "SELECT read,propose FROM atlas_private.agent_project_grants WHERE workspace_id=$1 AND project_id=$2",
          [w, p.id],
        )
      ).rows[0],
    ).toEqual({ read: false, propose: false });
  });
  it("does not duplicate or restore archived repositories", async () => {
    const key = randomUUID(),
      p = await ensure(key);
    await admin.query(
      "UPDATE atlas.projects SET archived_at=now() WHERE workspace_id=$1 AND id=$2",
      [w, p.id],
    );
    expect(
      (await post("/projects/ensure", { repository_digest: hash(key), name: "Same project" }))
        .status,
    ).toBe(403);
  });
  it("enforces the mandatory workspace predicate", async () => {
    await expect(
      withPrincipal(api, principal, randomUUID(), async () => undefined),
    ).rejects.toThrow("mismatch");
    expect((await api.query("SELECT id FROM atlas.project_checkpoints")).rowCount).toBe(0);
    await expect(
      api.query("SELECT * FROM atlas_private.checkpoint_requests"),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("serves real SDK discovery/save and fresh MCP-process retrieval", async () => {
    const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 4319 });
    const connect = async () => {
      const client = new Client({ name: "atlas-acceptance", version: "1.0.0" });
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [resolve("apps/mcp-server/dist/index.js")],
          env: { ATLAS_API_URL: "http://127.0.0.1:4319", ATLAS_AGENT_TOKEN: token },
          stderr: "pipe",
        }),
      );
      return client;
    };
    let first: Client | undefined, second: Client | undefined;
    try {
      first = await connect();
      expect((await first.listTools()).tools.map((t) => t.name)).toEqual([
        "atlas_start_project",
        "atlas_project_context",
        "atlas_save_checkpoint",
      ]);
      const start = await first.callTool({
        name: "atlas_start_project",
        arguments: { repository_path: resolve(".") },
      });
      expect(start.isError).not.toBe(true);
      const saved = await first.callTool({
        name: "atlas_save_checkpoint",
        arguments: { repository_path: resolve("."), ...note, request_key: randomUUID() },
      });
      expect(saved.isError).not.toBe(true);
      await first.close();
      first = undefined;
      second = await connect();
      const fresh = await second.callTool({
        name: "atlas_project_context",
        arguments: { repository_path: resolve("."), query: "Observed agent workflow" },
      });
      expect(fresh.isError).not.toBe(true);
      expect(JSON.stringify(fresh.content)).toContain("Observed agent workflow");
    } finally {
      await first?.close();
      await second?.close();
      await new Promise<void>((done, fail) => server.close((e) => (e ? fail(e) : done())));
    }
  });
  it("rejects revoked and expired credentials before project access", async () => {
    await admin.query(
      "UPDATE atlas_private.agent_credentials SET revoked_at=now() WHERE workspace_id=$1 AND id=$2",
      [w, otherCredential],
    );
    expect(
      (
        await post(
          "/projects/ensure",
          { repository_digest: hash(randomUUID()), name: "Denied" },
          otherToken,
        )
      ).status,
    ).toBe(403);
    await admin.query(
      "UPDATE atlas_private.agent_credentials SET issued_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE workspace_id=$1 AND id=$2",
      [w, credential],
    );
    expect(
      (await post("/projects/ensure", { repository_digest: hash(randomUUID()), name: "Denied" }))
        .status,
    ).toBe(403);
  });
});
