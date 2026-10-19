import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { serve } from "@hono/node-server";
import { digest } from "@atlas/core/local-vault";
import { createApp } from "../../apps/api/src/app.js";
import { createLocalServices } from "../../apps/api/src/local-vault.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { attachStatic } from "../../apps/api/src/static.js";
const root = await mkdtemp(join(tmpdir(), "atlas-local-browser-"));
const local = createLocalServices(root, {
  agentId: "controlled-local-agent",
  token: `atlas_${randomBytes(32).toString("base64url")}`,
});
const p = await local.vault.ensure({
    name: "Controlled Alpha",
    repository_digest: digest("controlled-alpha"),
  }),
  p2 = await local.vault.ensure({
    name: "Controlled Beta",
    repository_digest: digest("controlled-beta"),
  });
const beta = await local.vault.capture(p2.id, {
  title: "Beta evidence",
  kind: "lesson",
  markdown: "Controlled local evidence from a Markdown file.",
  provenance: { paths: ["test.md"], verification: "Local browser fixture" },
  request_key: "browser-beta-12345",
  knowledge: {
    type: "lesson",
    scope: "project",
    key: "fixture.beta",
    summary: "Controlled Beta evidence is kept in a local Markdown file for reuse.",
    applies_when: "Retrieving evidence for the controlled Beta project.",
    topics: ["evidence"],
    basis: "verified_observation",
  },
});
const alpha = await local.vault.capture(p.id, {
  title: "Alpha observed decision",
  kind: "decision",
  markdown: "Observed fixture decision connected to [[Beta evidence]].",
  provenance: { paths: ["test.md"], verification: "Local browser fixture" },
  request_key: "browser-alpha-12345",
  knowledge: {
    type: "decision",
    scope: "project",
    key: "fixture.alpha",
    summary: "Alpha retains local observations and an explicit connection to Beta evidence.",
    applies_when: "Working with the controlled Alpha knowledge fixture.",
    topics: ["alpha"],
    basis: "owner_explicit",
    source_statement:
      "Fixture owner explicitly chose local observations and the evidence connection.",
  },
});
await local.vault.capture(p.id, {
  title: "Routine build report",
  kind: "progress",
  markdown: "A routine edit completed and its build passed.",
  provenance: { paths: ["test.md"], verification: "Local activity fixture" },
  request_key: "browser-activity-12345",
});
await local.vault.capture(p.id, {
  title: "Unconfirmed visual preference",
  kind: "decision",
  markdown:
    "A historical report might imply a visual preference; human intent has not been established.",
  provenance: { paths: ["test.md"], verification: "Historical report only" },
  request_key: "browser-candidate-12345",
  knowledge: {
    type: "preference",
    scope: "project",
    key: "fixture.guess",
    summary: "A historical report suggests a visual preference that remains unconfirmed.",
    applies_when: "Inspecting this candidate during the controlled fixture.",
    topics: ["visual"],
    basis: "historical_report",
  },
});
const app = createApp(
  loadConfig({ NODE_ENV: "test", API_PORT: "4320" }),
  undefined,
  undefined,
  local,
);
app.get("/fixture/details", (c) => c.json({ root, alpha: alpha.id, beta: beta.id }));
app.post("/fixture/direct-edit", async (c) => {
  const path = join(root, alpha.path),
    raw = await readFile(path, "utf8");
  await writeFile(
    path,
    raw.replace(
      "Observed fixture decision connected to",
      "Edited directly in Markdown; connected to",
    ),
  );
  return c.json({ ok: true });
});
attachStatic(app, resolve("apps/web/dist"));
const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 4320 });
const close = async () => {
  server.close();
  if (root.startsWith(join(tmpdir(), "atlas-local-browser-")))
    await rm(root, { recursive: true, force: true });
};
process.once("SIGINT", () => {
  void close();
});
process.once("SIGTERM", () => {
  void close();
});
