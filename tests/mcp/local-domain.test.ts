import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes, randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { expect, it } from "vitest";
import { z, localContextPacketSchema } from "@atlas/contracts";
import { sha256, head, sourceData } from "@atlas/core/local-domain";
import { createLocalServices } from "../../apps/api/src/local-vault.js";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";

const owner = { kind: "owner" as const, id: "fixture-owner" };
const key = () => randomUUID();
async function listen(local: ReturnType<typeof createLocalServices>) {
  const app = createApp(
    loadConfig({ API_PORT: "4321", NODE_ENV: "test" }),
    undefined,
    undefined,
    local,
  );
  return new Promise<ReturnType<typeof serve>>((resolve, reject) => {
    const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 4321 }, () =>
      resolve(server),
    );
    server.once("error", reject);
  });
}
async function connect(token: string, cwd: string) {
  const client = new Client({ name: "controlled-local-domain", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve("apps/mcp-server/dist/index.js")],
      cwd,
      stderr: "pipe",
      env: {
        PATH: process.env.PATH ?? "",
        SystemRoot: process.env.SystemRoot ?? "C:\\Windows",
        TEMP: tmpdir(),
        ATLAS_API_URL: "http://127.0.0.1:4321",
        ATLAS_AGENT_TOKEN: token,
      },
    }),
  );
  return client;
}
async function call(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError, `${name} failed`).not.toBe(true);
  const content = z
    .array(z.object({ type: z.literal("text"), text: z.string() }))
    .parse(result.content);
  expect(content).toHaveLength(1);
  return z.record(z.string(), z.unknown()).parse(JSON.parse(content[0]?.text ?? "null"));
}
it("lists twenty-five schemas, preserves the three automatic tools, and completes a fresh MCP process round trip", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-domain-mcp-")),
    installedToken = `atlas_${randomBytes(32).toString("base64url")}`;
  let local = createLocalServices(root, { agentId: "fixture-installed", token: installedToken }),
    server = await listen(local),
    client: Client | undefined,
    automatic: Client | undefined;
  try {
    await writeFile(
      join(root, "fixture.md"),
      "A stable fixture marker for the local MCP protocol.",
    );
    automatic = await connect(installedToken, root);
    const tools = (await automatic.listTools()).tools;
    expect(tools).toHaveLength(25);
    expect(new Set(tools.map((t) => t.name)).size).toBe(25);
    for (const tool of tools) expect(tool.inputSchema.type).toBe("object");
    const started = await call(automatic, "atlas_start_project", { repository_path: root }),
      project = z.object({ project: z.object({ id: z.string() }) }).parse(started).project;
    const note = {
      repository_path: root,
      title: "Controlled file fact",
      kind: "decision",
      markdown: "The controlled fixture file contains a stable local MCP protocol marker.",
      provenance: {
        paths: ["fixture.md"],
        verification: "Read the disposable fixture.md file before this controlled protocol test.",
      },
      request_key: key(),
      knowledge: {
        type: "project_fact",
        scope: "project",
        key: "fixture.mcp.protocol",
        summary: "The controlled fixture file contains a stable local MCP protocol marker.",
        applies_when: "Running the controlled local MCP compatibility fixture.",
        topics: ["fixture"],
        basis: "verified_observation",
      },
    };
    const first = await call(automatic, "atlas_save_checkpoint", note),
      retry = await call(automatic, "atlas_save_checkpoint", note);
    expect(retry.id).toBe(first.id);
    const oldContext = await call(automatic, "atlas_project_context", {
      repository_path: root,
      query: "protocol",
      detail: "full",
    });
    expect(JSON.stringify(oldContext)).toContain("stable local MCP protocol marker");
    await automatic.close();
    automatic = undefined;
    const enrolled = await local.domain.auth.create(owner, {
        request_key: key(),
        name: "Fixture domain reader",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        capabilities: ["read", "propose", "process_knowledge"],
        project_ids: [project.id],
      }),
      token = z.string().parse(enrolled.token);
    const source = await local.domain.sources.capture(owner, {
      request_key: key(),
      title: "Fictional clinic source",
      scope: "project",
      project_id: project.id,
      content: "The fictional clinic uses SQLite for its offline records.",
    });
    const deadline = Date.now() + 10000;
    while (
      sourceData(await local.domain.store.catalog(), String(source.source_id)).processing_state ===
        "indexing" &&
      Date.now() < deadline
    )
      await new Promise((r) => setTimeout(r, 25));
    client = await connect(token, root);
    const read = localContextPacketSchema.parse(
        await call(client, "read_source", { source_id: source.source_id, token_budget: 8192 }),
      ),
      ref = read.items[0]?.source_refs[0];
    if (!ref) throw Error("Missing exact fixture evidence");
    const proposal = await call(client, "propose_decision", {
        idempotency_key: key(),
        title: "Fictional offline storage",
        summary: "The fictional clinic uses SQLite for its offline records.",
        project_id: project.id,
        decision: {
          problem: "Offline record storage",
          choice: "SQLite",
          rationale: "The supplied fictional source states this choice.",
          consequences: ["Keep the fictional records available offline."],
        },
        evidence: [ref],
      }),
      memoryId = z.string().parse(proposal.memory_id);
    const record = head(await local.domain.store.catalog(), "memory", memoryId);
    await local.domain.tasks.review(owner, "memory", memoryId, {
      request_key: key(),
      expected_revision: record.revision,
      action: "approve",
      reason: "Checked the exact fictional source span",
    });
    const packet = localContextPacketSchema.parse(
      await call(client, "get_project_context", { project: project.id, token_budget: 8192 }),
    );
    expect(packet.items.some((item) => item.id === memoryId)).toBe(true);
    const direct = await call(client, "propose_memory", {
      idempotency_key: key(),
      title: "Additional fixture observation",
      type: "project",
      summary: "The fictional source describes offline records.",
      structured_content: {},
      scope: "project",
      project_id: project.id,
      evidence: [ref],
      claim_kind: "explicit_fact",
    });
    expect(direct.status).toBe("proposed");
    const relation = await call(client, "propose_relationship", {
        idempotency_key: key(),
        from_item_id: memoryId,
        to_item_id: source.source_id,
        relationship_type: "DOCUMENTS",
        evidence: [ref],
        claim_kind: "explicit_fact",
      }),
      relationshipId = z.string().parse(relation.relationship_id),
      relationship = head(await local.domain.store.catalog(), "relationship", relationshipId);
    await local.domain.tasks.review(owner, "relationship", relationshipId, {
      request_key: key(),
      expected_revision: relationship.revision,
      action: "approve",
      reason: "Checked the fictional source relationship",
    });
    const related = localContextPacketSchema.parse(
      await call(client, "get_related_knowledge", {
        item_id: memoryId,
        depth: 1,
        token_budget: 8192,
      }),
    );
    expect(related.items.some((i) => i.id === source.source_id)).toBe(true);
    const personal = await local.domain.sources.capture(owner, {
      request_key: key(),
      title: "Private processing fixture",
      content: "This explicitly selected fictional source uses local file storage.",
    });
    const readyUntil = Date.now() + 10000;
    while (
      sourceData(await local.domain.store.catalog(), String(personal.source_id))
        .processing_state === "indexing" &&
      Date.now() < readyUntil
    )
      await new Promise((r) => setTimeout(r, 25));
    const personalRecord = head(
      await local.domain.store.catalog(),
      "source",
      String(personal.source_id),
    );
    await local.domain.tasks.grant(owner, personalRecord.entity_id, {
      request_key: key(),
      expected_revision: personalRecord.revision,
      agent_id: enrolled.agent_id,
      source_version_id: personal.version_id,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    expect(
      (await client.callTool({ name: "read_source", arguments: { source_id: personal.source_id } }))
        .isError,
    ).toBe(true);
    const listed = z
      .object({ tasks: z.array(z.object({ task_id: z.string() })) })
      .parse(await call(client, "list_knowledge_tasks", {}));
    const taskId = listed.tasks[0]?.task_id;
    if (!taskId) throw Error("Missing explicitly granted task");
    const claimed = await call(client, "claim_knowledge_task", {
        task_id: taskId,
        token_budget: 8192,
      }),
      oldLease = z.string().parse(claimed.lease_token);
    await call(client, "read_processing_source", {
      task_id: taskId,
      lease_token: oldLease,
      token_budget: 8192,
    });
    const renewed = await call(client, "renew_knowledge_task", {
        task_id: taskId,
        lease_token: oldLease,
      }),
      renewedLease = z.string().parse(renewed.lease_token);
    expect(
      (
        await client.callTool({
          name: "release_knowledge_task",
          arguments: { task_id: taskId, lease_token: oldLease },
        })
      ).isError,
    ).toBe(true);
    await call(client, "release_knowledge_task", {
      task_id: taskId,
      lease_token: renewedLease,
      reason: "interrupted",
    });
    const reclaimed = await call(client, "claim_knowledge_task", {
        task_id: taskId,
        token_budget: 8192,
      }),
      activeLease = z.string().parse(reclaimed.lease_token),
      delivered = z
        .object({
          chunks: z.array(
            z.object({
              id: z.string(),
              start_offset: z.number(),
              end_offset: z.number(),
              text_sha256: z.string(),
            }),
          ),
        })
        .parse(
          await call(client, "read_processing_source", {
            task_id: taskId,
            lease_token: activeLease,
            token_budget: 8192,
          }),
        ),
      chunk = delivered.chunks[0];
    if (!chunk) throw Error("Missing delivered fixture chunk");
    const organized = await call(client, "submit_knowledge_organization", {
      task_id: taskId,
      lease_token: activeLease,
      idempotency_key: key(),
      organization: {
        contract_version: 1,
        source_version_id: personal.version_id,
        expected_source_revision: 1,
        coverage_chunk_ids: reclaimed.chunk_ids,
        classifications: [],
        tags: [],
        entities: [],
        relationships: [],
        memories: [
          {
            candidate_id: "private-observation",
            type: "project",
            title: "Private fixture storage",
            subject_key: "fixture.private.storage",
            summary: "The selected fictional source uses local file storage.",
            structured_content: {},
            claim_kind: "explicit_fact",
            confidence: 0.8,
            evidence: [
              {
                source_version_id: personal.version_id,
                chunk_id: chunk.id,
                start_offset: chunk.start_offset,
                end_offset: chunk.end_offset,
                quote_sha256: chunk.text_sha256,
              },
            ],
          },
        ],
      },
    });
    expect(organized.status).toBe("review_pending");
    await client.close();
    client = undefined;
    local.domain.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    local = createLocalServices(root, { agentId: "fixture-installed", token: installedToken });
    server = await listen(local);
    client = await connect(token, root);
    const fresh = localContextPacketSchema.parse(
      await call(client, "get_memory", { memory_id: memoryId, token_budget: 8192 }),
    );
    expect(fresh.items[0]?.id).toBe(memoryId);
    expect(fresh.items[0]?.source_refs[0]?.source_version_id).toBe(source.version_id);
    const searched = localContextPacketSchema.parse(
      await call(client, "search_knowledge", {
        query: "SQLite",
        project_id: project.id,
        token_budget: 8192,
      }),
    );
    expect(searched.items.some((i) => i.id === memoryId)).toBe(true);
    automatic = await connect(installedToken, root);
    const narrow = await call(automatic, "atlas_project_context", {
      repository_path: root,
      query: "SQLite",
    });
    expect(narrow.reviewed_context).toBeUndefined();
    const installed = head(await local.domain.store.catalog(), "agent", "fixture-installed");
    await local.domain.auth.update(owner, "fixture-installed", {
      request_key: key(),
      expected_revision: installed.revision,
      capabilities: ["capture_project_knowledge", "read"],
      project_ids: [project.id],
    });
    const supplemented = await call(automatic, "atlas_project_context", {
      repository_path: root,
      query: "SQLite",
      character_budget: 8000,
    });
    const reviewed = localContextPacketSchema.parse(supplemented.reviewed_context);
    expect(reviewed.items.some((i) => i.id === memoryId)).toBe(true);
    expect(reviewed.items.every((i) => i.type === "memory")).toBe(true);
    expect(
      JSON.stringify(supplemented.notes).length + JSON.stringify(reviewed).length,
    ).toBeLessThanOrEqual(8000);
    const changes = await call(client, "get_recent_changes", {
      project_id: project.id,
      limit: 25,
      token_budget: 8192,
    });
    expect(changes.schema_version).toBe(1);
    const agentId = z.string().parse(enrolled.agent_id),
      agent = head(await local.domain.store.catalog(), "agent", agentId);
    await local.domain.auth.update(owner, agentId, {
      request_key: key(),
      expected_revision: agent.revision,
      revoke: true,
    });
    expect(
      (await client.callTool({ name: "get_memory", arguments: { memory_id: memoryId } })).isError,
    ).toBe(true);
    await local.domain.organization.updateProject(owner, project.id, {
      request_key: key(),
      expected_revision: 0,
      archived: true,
    });
    expect(
      (
        await automatic.callTool({
          name: "atlas_project_context",
          arguments: { repository_path: root },
        })
      ).isError,
    ).toBe(true);
  } finally {
    await automatic?.close();
    await client?.close();
    local.domain.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const until = Date.now() + 5000;
    while (local.domain.runner.status().running && Date.now() < until)
      await new Promise((r) => setTimeout(r, 20));
    if (root.startsWith(join(tmpdir(), "atlas-domain-mcp-")))
      await rm(root, { recursive: true, force: true });
  }
});
