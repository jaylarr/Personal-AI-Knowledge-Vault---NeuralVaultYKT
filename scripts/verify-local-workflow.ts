import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { localNoteSchema, localContextSchema, z } from "@atlas/contracts";
import { seedInputs } from "./distill-local-knowledge.js";
const root = resolve("."),
  vault = resolve("Vault"),
  pwsh =
    "C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe";
async function connect() {
  const c = new Client({ name: "atlas-local-roundtrip", version: "1.0.0" });
  await c.connect(
    new StdioClientTransport({
      command: pwsh,
      args: ["-NoProfile", "-File", resolve("scripts/atlas-launch.ps1")],
      cwd: process.env.TEMP ?? root,
      stderr: "pipe",
    }),
  );
  assert.equal((await c.listTools()).tools.length, 18);
  return c;
}
async function call(c: Client, name: string, args: Record<string, unknown>) {
  const result = await c.callTool({ name, arguments: args });
  assert.notEqual(result.isError, true, `${name} failed`);
  const blocks = z
    .array(z.object({ type: z.literal("text"), text: z.string() }))
    .parse(result.content);
  return JSON.parse(blocks[0]?.text ?? "null") as unknown;
}
let first: Client | undefined, second: Client | undefined;
try {
  first = await connect();
  const started = localContextSchema.parse(
    await call(first, "atlas_start_project", { repository_path: root }),
  );
  assert.equal(started.vault_root, vault);
  const seed = (await seedInputs()).find(
    (s) => s.input.knowledge?.key === "workflow.knowledge-quality",
  );
  assert(seed);
  const input = seed.input;
  assert(started.notes.every((n) => n.knowledge && n.effective_state === "active"));
  const saved = localNoteSchema.parse(
    await call(first, "atlas_save_checkpoint", { repository_path: root, ...input }),
  );
  assert.equal(saved.project_id, null);
  const raw = await readFile(join(vault, saved.path), "utf8");
  assert(raw.includes(input.markdown));
  const retried = localNoteSchema.parse(
    await call(first, "atlas_save_checkpoint", { repository_path: root, ...input }),
  );
  assert.equal(retried.id, saved.id);
  await first.close();
  first = undefined;
  second = await connect();
  const fresh = localContextSchema.parse(
    await call(second, "atlas_project_context", {
      repository_path: root,
      query: "knowledge quality",
    }),
  );
  assert.equal(fresh.project.id, started.project.id);
  assert(
    fresh.notes.some(
      (n) => n.id === saved.id && n.context_excerpt && n.markdown === input.knowledge?.summary,
    ),
  );
  const full = localContextSchema.parse(
    await call(second, "atlas_project_context", {
      repository_path: root,
      query: "knowledge quality",
      detail: "full",
    }),
  );
  assert(
    full.notes.some(
      (n) => n.id === saved.id && !n.context_excerpt && n.markdown === input.markdown,
    ),
  );
  await writeFile(
    ".local/knowledge-roundtrip.json",
    `${JSON.stringify({ passed: true, at: new Date().toISOString(), projectId: started.project.id, noteId: saved.id, notePath: saved.path, vault, freshProcess: true, deduplicated: true }, null, 2)}\n`,
  );
  process.stdout.write(
    "PASS: installed MCP finds the migrated local project with its original ID.\nPASS: durable knowledge is exact local Markdown; retry deduplicates.\nPASS: a fresh MCP process retrieves scoped summaries and full detail, excluding activity.\n",
  );
} catch {
  process.stderr.write("Local workflow verification failed; secrets/knowledge redacted.\n");
  process.exitCode = 1;
} finally {
  await first?.close();
  await second?.close();
}
