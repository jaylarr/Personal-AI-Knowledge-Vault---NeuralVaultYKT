import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { digest } from "@atlas/core/local-vault";
import { createLocalServices } from "../../apps/api/src/local-vault.js";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { attachStatic } from "../../apps/api/src/static.js";
const container = await mkdtemp(join(tmpdir(), "atlas-domain-browser-")),
  root = join(container, "Vault");
const local = createLocalServices(root, {
  agentId: "controlled-domain-installation",
  token: `atlas_${randomBytes(32).toString("base64url")}`,
});
const project = await local.vault.ensure({
  repository_digest: digest("domain-browser-project"),
  name: "Controlled source project",
});
const owner = { kind: "owner" as const, id: "controlled-browser-owner" };
const seed = await local.domain.sources.capture(owner, {
  request_key: randomUUID(),
  title: "Fictional source for owner review",
  scope: "project",
  project_id: project.id,
  content: "The fictional clinic uses SQLite for offline records. 🧠",
});
const readyUntil = Date.now() + 10000;
while (local.domain.runner.status().running && Date.now() < readyUntil)
  await new Promise((r) => setTimeout(r, 20));
const packet = await local.domain.retrieval.readSource(owner, String(seed.source_id), {
    token_budget: 8192,
  }),
  evidence = packet.items[0]?.source_refs[0];
if (!evidence) throw Error("Missing fixture evidence");
const agent = await local.domain.auth.create(owner, {
  request_key: randomUUID(),
  name: "Controlled review fixture",
  expires_at: new Date(Date.now() + 3600000).toISOString(),
  capabilities: ["read", "propose", "process_knowledge"],
  project_ids: [project.id],
});
await local.domain.tasks.propose(
  { kind: "agent", id: String(agent.agent_id) },
  {
    request_key: randomUUID(),
    title: "Fictional storage proposal",
    subject_key: "fixture.browser.storage",
    type: "project",
    summary: "The fictional clinic uses SQLite for offline records.",
    claim_kind: "explicit_fact",
    scope: "project",
    project_id: project.id,
    evidence: [evidence],
  },
);
const app = createApp(
  loadConfig({ NODE_ENV: "test", API_PORT: "4323" }),
  undefined,
  undefined,
  local,
);
attachStatic(app, resolve("apps/web/dist"));
const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 4323 });
async function close() {
  local.domain.close();
  server.close();
  const until = Date.now() + 5000;
  while (local.domain.runner.status().running && Date.now() < until)
    await new Promise((r) => setTimeout(r, 20));
  if (container.startsWith(join(tmpdir(), "atlas-domain-browser-")))
    await rm(container, { recursive: true, force: true });
}
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
