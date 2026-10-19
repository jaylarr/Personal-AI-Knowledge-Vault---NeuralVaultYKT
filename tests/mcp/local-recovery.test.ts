import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { it, expect } from "vitest";
import { localContextPacketSchema } from "@atlas/contracts";
import { backupLocalVault, restoreLocalVault, head, versionData } from "@atlas/core/local-domain";
import { createLocalServices } from "../../apps/api/src/local-vault.js";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";

it("restores portable Markdown/originals/history and retrieves via a fresh API and stdio MCP process", async () => {
  const container = await mkdtemp(join(tmpdir(), "atlas-domain-restore-process-")),
    original = join(container, "Original"),
    target = join(container, "Restored"),
    owner = { kind: "owner" as const, id: "recovery-owner" },
    token = `atlas_${randomBytes(32).toString("base64url")}`;
  let local = createLocalServices(original, { agentId: "recovery-installed", token }),
    client: Client | undefined,
    server: ReturnType<typeof serve> | undefined;
  try {
    const project = await local.vault.ensure({
        repository_digest: "a".repeat(64),
        name: "Recovery process fixture",
      }),
      source = await local.domain.sources.capture(owner, {
        request_key: randomUUID(),
        title: "Fictional recovery source",
        scope: "project",
        project_id: project.id,
        content: "The fictional recovery project preserves originals. 🧠\r\n",
      });
    await local.domain.auth.bootstrap();
    await expect
      .poll(
        async () =>
          head(await local.domain.store.catalog(), "job", String(source.job_id)).data.state,
        { timeout: 10000 },
      )
      .toBe("completed");
    const evidence = await local.domain.retrieval.readSource(owner, String(source.source_id), {
        token_budget: 8192,
      }),
      ref = evidence.items[0]?.source_refs[0];
    if (!ref) throw Error("Missing exact evidence");
    const proposal = await local.domain.tasks.propose(owner, {
        request_key: randomUUID(),
        subject_key: "fixture.recovery",
        title: "Recovery decision",
        type: "project",
        summary: "The fictional project preserves originals.",
        claim_kind: "explicit_fact",
        evidence: [ref],
        scope: "project",
        project_id: project.id,
      }),
      memory = head(await local.domain.store.catalog(), "memory", String(proposal.memory_id));
    await local.domain.tasks.review(owner, "memory", memory.entity_id, {
      request_key: randomUUID(),
      expected_revision: memory.revision,
      action: "approve",
      reason: "Checked the supplied fictional recovery source.",
    });
    const oldVersion = versionData(await local.domain.store.catalog(), String(source.version_id)),
      before = await local.domain.store.read(oldVersion.original_path);
    await mkdir(join(container, "Exports"));
    const exported = await backupLocalVault(
      local.domain.store,
      join(container, "Exports", "Portable"),
    );
    expect(exported.complete).toBe(true);
    local.domain.close();
    await restoreLocalVault(exported.path, target);
    local = createLocalServices(target, { agentId: "restored-installation" });
    await expect(local.domain.auth.authenticate(token)).rejects.toMatchObject({
      code: "AGENT_ACCESS_DENIED",
    });
    const fresh = await local.domain.auth.create(owner, {
      request_key: randomUUID(),
      name: "Explicit fresh recovery credential",
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      capabilities: ["read"],
      project_ids: [project.id],
    });
    const app = createApp(
      loadConfig({ API_PORT: "4322", NODE_ENV: "test" }),
      undefined,
      undefined,
      local,
    );
    server = await new Promise<ReturnType<typeof serve>>((done, reject) => {
      const s = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 4322 }, () => done(s));
      s.once("error", reject);
    });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve("apps/mcp-server/dist/index.js")],
      cwd: resolve("."),
      env: {
        PATH: process.env.PATH ?? "",
        SystemRoot: process.env.SystemRoot ?? "C:\\Windows",
        ATLAS_STORAGE_MODE: "local",
        ATLAS_API_URL: "http://localhost:4322",
        ATLAS_AGENT_TOKEN: String(fresh.token),
      },
    });
    client = new Client({ name: "controlled-recovery", version: "1.0.0" });
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(18);
    const result = await client.callTool({
      name: "get_memory",
      arguments: { memory_id: memory.entity_id, token_budget: 8192 },
    });
    expect(result.isError).not.toBe(true);
    const text = result.content.find((c) => c.type === "text");
    if (!text || text.type !== "text") throw Error("Missing MCP packet");
    const packet = localContextPacketSchema.parse(JSON.parse(text.text));
    expect(packet.items[0]?.id).toBe(memory.entity_id);
    expect(packet.items[0]?.source_refs).toEqual([ref]);
    expect(
      await local.domain.store.read(
        versionData(await local.domain.store.catalog(), String(source.version_id)).original_path,
      ),
    ).toEqual(before);
    const originalServices = createLocalServices(original, {
      agentId: "recovery-installed",
      token,
    });
    expect(
      head(await originalServices.domain.store.catalog(), "agent", "recovery-installed").data
        .revoked_at,
    ).toBeNull();
    originalServices.domain.close();
  } finally {
    await client?.close();
    local.domain.close();
    if (server) await new Promise<void>((r) => server?.close(() => r()));
    if (container.startsWith(join(tmpdir(), "atlas-domain-restore-process-")))
      await rm(container, { recursive: true, force: true });
  }
});
