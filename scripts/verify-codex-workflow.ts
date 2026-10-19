import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { checkpointSchema, projectContextSchema, z } from "@atlas/contracts";
const root = resolve("."),
  pwsh =
    "C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe";
const names = ["atlas_start_project", "atlas_project_context", "atlas_save_checkpoint"];
async function connect() {
  const client = new Client({ name: "atlas-installed-client-verification", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: pwsh,
      args: ["-NoProfile", "-File", resolve("scripts/atlas-launch.ps1")],
      cwd: process.env.TEMP ?? root,
      stderr: "pipe",
    }),
  );
  assert.deepEqual(
    (await client.listTools()).tools.map((t) => t.name),
    names,
  );
  return client;
}
async function call(client: Client, name: string, args: Record<string, unknown>) {
  const r = await client.callTool({ name, arguments: args });
  assert.notEqual(r.isError, true, `Installed MCP tool ${name} failed`);
  const content = z.array(z.object({ type: z.literal("text"), text: z.string() })).parse(r.content);
  return JSON.parse(content[0]?.text ?? "null") as unknown;
}
let first: Client | undefined, second: Client | undefined;
try {
  first = await connect();
  const a = projectContextSchema.parse(
    await call(first, "atlas_start_project", { repository_path: root }),
  );
  const input = {
    title: "ATLAS agent-first workflow on this Windows PC",
    kind: "decision",
    markdown:
      "Owner decision: existing Codex agents perform the reasoning; ATLAS provides project knowledge persistence, without a separate AI API. Codex should automatically find/create the current repository project, load its context, and save concise decisions, lessons, verified progress and handoffs. A01 implements three scoped MCP tools and additive global AGENTS guidance. Records remain agent-recorded evidence, not verified canonical memories. Full source ingestion and broader vault features remain pending. The local API starts on demand at loopback port 4317; no Windows startup service or AI launcher is installed.",
    provenance: {
      paths: [
        "AGENTS.md",
        "docs/AGENT_WORKFLOW.md",
        "database/migrations/0017_agent_workflow.sql",
        "apps/mcp-server/src/index.ts",
      ],
      verification:
        "76 unit tests and 73 isolated SQL/HTTP/MCP tests passed. Migration 0017 passed child-branch rehearsal then deployed to the authorized ATLAS Neon production target; 42 tables have RLS and restricted runtime roles. Global Codex instructions/MCP registration and Windows DPAPI enrollment completed. Installed launcher automatically started the API and registered this real repository.",
    },
  };
  const request_key = `a01-${createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32)}`;
  const note = checkpointSchema.parse(
    await call(first, "atlas_save_checkpoint", { repository_path: root, ...input, request_key }),
  );
  const retry = checkpointSchema.parse(
    await call(first, "atlas_save_checkpoint", { repository_path: root, ...input, request_key }),
  );
  assert.equal(retry.id, note.id);
  await first.close();
  first = undefined;
  second = await connect();
  const fresh = projectContextSchema.parse(
    await call(second, "atlas_start_project", { repository_path: root }),
  );
  assert.equal(fresh.project.id, a.project.id);
  const matching = projectContextSchema.parse(
    await call(second, "atlas_project_context", {
      repository_path: root,
      query: "ATLAS agent-first workflow",
    }),
  );
  assert(matching.checkpoints.some((n) => n.id === note.id && n.markdown === input.markdown));
  await writeFile(
    ".local/codex-roundtrip.json",
    `${JSON.stringify({ passed: true, verifiedAt: new Date().toISOString(), projectId: a.project.id, checkpointId: note.id, tools: names, freshMcpProcess: true, retryDeduplicated: true }, null, 2)}\n`,
  );
  process.stdout.write(
    "PASS: installed Windows launcher exposes all 3 MCP tools from an unrelated working directory.\nPASS: real Neon project registration + checkpoint save + duplicate retry.\nPASS: a fresh MCP process finds the same project and retrieves the persisted checkpoint.\n",
  );
} catch {
  process.stderr.write(
    "Installed Codex workflow verification failed; credentials and returned knowledge redacted.\n",
  );
  process.exitCode = 1;
} finally {
  await first?.close();
  await second?.close();
}
