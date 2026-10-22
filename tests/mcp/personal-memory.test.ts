import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, randomBytes } from "node:crypto";
import { serve } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { expect, it } from "vitest";
import { createLocalServices } from "../../apps/api/src/local-vault.js";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { z } from "@atlas/contracts";
it("requires explicit personal grants and retrieves a projectless preference through a fresh MCP process", async () => {
  const base = await mkdtemp(join(tmpdir(), "atlas-personal-mcp-")),
    home = join(base, "Codex"),
    vault = join(base, "Vault");
  await mkdir(join(home, "sessions"), { recursive: true });
  await writeFile(
    join(home, "sessions", "fixture.jsonl"),
    [
      {
        type: "session_meta",
        payload: { id: "fixture-session", cli_version: "0.163.0-alpha.11", source: "vscode" },
      },
      {
        type: "event_msg",
        payload: {
          type: "item_completed",
          turn_id: "t1",
          item: {
            type: "UserMessage",
            id: "m1",
            content: [
              {
                type: "text",
                text: "I prefer evidence-backed short progress updates for routine work.",
              },
            ],
          },
        },
      },
      { type: "event_msg", payload: { type: "task_complete", turn_id: "t1" } },
    ]
      .map((e) => JSON.stringify(e))
      .join("\n") + "\n",
  );
  const token = `atlas_${randomBytes(32).toString("base64url")}`,
    local = createLocalServices(vault, {
      agentId: "fixture-old",
      token,
      personalHosts: [
        {
          id: "mcp-pc",
          kind: "codex-local-jsonl",
          enabled: true,
          codex_home: home,
          skill_roots: [],
        },
      ],
    }),
    owner = { kind: "owner" as const, id: "owner" };
  const app = createApp(
    loadConfig({ NODE_ENV: "test", API_PORT: "4321" }),
    undefined,
    undefined,
    local,
  );
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 4321 });
  let client: Client | undefined;
  async function connect(value: string) {
    const c = new Client({ name: "personal-fixture", version: "1.0.0" });
    await c.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [resolve("apps/mcp-server/dist/index.js")],
        cwd: base,
        stderr: "pipe",
        env: {
          PATH: process.env.PATH ?? "",
          SystemRoot: process.env.SystemRoot ?? "C:\\Windows",
          TEMP: tmpdir(),
          ATLAS_API_URL: "http://127.0.0.1:4321",
          ATLAS_AGENT_TOKEN: value,
        },
      }),
    );
    return c;
  }
  async function call(name: string, input: Record<string, unknown>) {
    const r = await client!.callTool({ name, arguments: input });
    expect(r.isError, JSON.stringify(r.content)).not.toBe(true);
    return JSON.parse(
      z.array(z.object({ type: z.literal("text"), text: z.string() })).parse(r.content)[0]!.text,
    );
  }
  try {
    client = await connect(token);
    expect((await client.listTools()).tools).toHaveLength(25);
    expect((await client.callTool({ name: "atlas_personal_context", arguments: {} })).isError).toBe(
      true,
    );
    await client.close();
    await local.personal.policy.update(owner, {
      policy: { enabled: true, enabled_hosts: ["mcp-pc"] },
      expected_revision: 0,
      request_key: randomUUID(),
    });
    const capabilities = [
      "read_personal_memory",
      "capture_personal_memory",
      "review_personal_sessions",
    ];
    const enrolled = await local.domain.auth.create(owner, {
      request_key: randomUUID(),
      name: "Personal fixture reviewer",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      capabilities,
      project_ids: [],
      scopes: [],
    });
    await local.personal.policy.grant(owner, {
      agent_id: enrolled.agent_id,
      capabilities,
      host_ids: ["mcp-pc"],
      expected_revision: 0,
      request_key: randomUUID(),
    });
    client = await connect(String(enrolled.token));
    await call("atlas_personal_scan", { host_id: "mcp-pc" });
    const claim = await call("atlas_personal_review_next", {
      host_id: "mcp-pc",
      request_key: randomUUID(),
    });
    const req = { host_id: "mcp-pc", review_id: claim.review_id, lease_token: claim.lease_token };
    const page = await call("atlas_personal_review_page", { ...req, cursor: 0 }),
      ack = await call("atlas_personal_review_page", {
        ...req,
        cursor: page.next_cursor,
        acknowledge_previous: page.page_digest,
      });
    const saved = await call("atlas_capture_personal_knowledge", {
      title: "Concise evidence-backed updates",
      kind: "decision",
      markdown:
        "The fictional owner prefers evidence-backed short progress updates when discussing routine work.",
      request_key: randomUUID(),
      provenance: { paths: [], verification: "Read the exact fixture owner message." },
      knowledge: {
        type: "preference",
        scope: "owner",
        key: "workflow.short-updates",
        summary: "The fictional owner prefers evidence-backed short updates for routine work.",
        applies_when: "Discussing routine progress with this fictional owner.",
        topics: ["workflow"],
        basis: "owner_explicit",
        source_statement: "I prefer evidence-backed short progress updates for routine work.",
        source_refs: [page.messages[0].source_ref],
      },
    });
    expect(saved.agent_id).toBe(enrolled.agent_id);
    await call("atlas_personal_review_complete", {
      ...req,
      expected_revision: ack.revision,
      request_key: randomUUID(),
      outcome: "reviewed_saved",
      reason_code: "useful",
      note_refs: [{ id: saved.id, file_digest: saved.file_digest }],
    });
    expect((await call("atlas_personal_skills", {})).skills).toEqual([]);
    await client.close();
    client = await connect(String(enrolled.token));
    const ctx = await call("atlas_personal_context", { query: "updates" });
    expect(ctx.notes[0].id).toBe(saved.id);
    expect(ctx.project_notes).toEqual([]);
    await local.domain.auth.update(owner, String(enrolled.agent_id), {
      request_key: randomUUID(),
      expected_revision: 1,
      revoke: true,
    });
    expect((await client.callTool({ name: "atlas_personal_context", arguments: {} })).isError).toBe(
      true,
    );
  } finally {
    await client?.close();
    local.domain.close();
    await new Promise<void>((r) => server.close(() => r()));
    await rm(base, { recursive: true, force: true });
  }
});
