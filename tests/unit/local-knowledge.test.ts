import { mkdtemp, readFile, writeFile, rm, readdir, mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { createLocalVault, digest, encodeNote, decodeFrontmatter } from "@atlas/core/local-vault";
import { localCheckpointInputSchema, type KnowledgeFields } from "@atlas/contracts";
import { createLocalServices } from "../../apps/api/src/local-vault.js";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";

let root: string, vault: ReturnType<typeof createLocalVault>, p: { id: string; path: string };
const input = (
  overrides: Partial<KnowledgeFields> = {},
  markdown = "The screenshots in this project's homepage are frameless. Parent cards are a separate surface.",
) =>
  localCheckpointInputSchema.parse({
    title: "Frameless homepage screenshots",
    kind: overrides.type === "lesson" ? "lesson" : "decision",
    markdown,
    request_key: randomUUID(),
    provenance: {
      paths: ["src/styles/homepage.css"],
      verification: "Read the current screenshot CSS; parent card styling is separate.",
    },
    knowledge: {
      type: "project_fact",
      scope: "project",
      key: "homepage.screenshots",
      summary: "This homepage uses frameless screenshots; parent card styling remains separate.",
      applies_when: "Editing screenshots in this project's homepage cards.",
      exceptions: ["This does not remove parent card borders or rounded corners."],
      topics: ["screenshots", "homepage"],
      basis: "verified_observation",
      ...overrides,
    },
  });
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "atlas-knowledge-"));
  vault = createLocalVault(root, "fixture-agent");
  p = await vault.ensure({
    name: "Portfolio fixture",
    repository_digest: digest("knowledge-fixture"),
  });
});
afterEach(async () => {
  if (
    !resolve(root).startsWith(`${resolve(tmpdir())}\\atlas-knowledge-`) &&
    !resolve(root).startsWith(`${resolve(tmpdir())}/atlas-knowledge-`)
  )
    throw Error("Unexpected cleanup target");
  await rm(root, { recursive: true, force: true });
});
async function change(path: string, values: Record<string, unknown>, body?: string) {
  const raw = await readFile(join(root, path), "utf8"),
    match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw);
  if (!match) throw Error("Missing frontmatter");
  const metadata = decodeFrontmatter(raw).metadata;
  await writeFile(
    join(root, path),
    encodeNote({ ...metadata, ...values }, body ?? raw.slice(match[0].length).trim()),
  );
}
describe("durable owner/project knowledge", () => {
  it("enforces scope, evidence, kind and Unicode byte bounds", () => {
    expect(() => input({ scope: "owner", type: "preference", basis: "inference" })).toThrow();
    expect(() =>
      input({
        scope: "owner",
        type: "project_fact",
        basis: "owner_explicit",
        source_statement: "Owner said this",
      }),
    ).toThrow();
    expect(() => localCheckpointInputSchema.parse({ ...input(), kind: "progress" })).toThrow();
    expect(() => input({}, "漢".repeat(5000))).toThrow();
  });
  it("keeps legacy reports in explicit activity, not default knowledge", async () => {
    await vault.capture(p.id, {
      title: "Build completed",
      kind: "progress",
      markdown: "Routine successful edit",
      provenance: { paths: [], verification: "Build passed" },
      request_key: "legacy-progress-123",
    });
    expect((await vault.context(p.id, {})).notes).toHaveLength(0);
    expect((await vault.context(p.id, { context_mode: "activity" })).notes).toHaveLength(1);
  });
  it("writes only scalar/list frontmatter and returns full detail on demand", async () => {
    const v = input(),
      saved = await vault.capture(p.id, v),
      raw = await readFile(join(root, saved.path), "utf8");
    const metadata = decodeFrontmatter(raw).metadata;
    expect(
      Object.values(metadata).every(
        (value) =>
          value === null ||
          typeof value !== "object" ||
          (Array.isArray(value) && value.every((s) => typeof s === "string")),
      ),
    ).toBe(true);
    expect(saved.path).toContain("/Knowledge/");
    expect(saved.effective_state).toBe("active");
    const summary = (await vault.context(p.id, {})).notes[0];
    expect(summary?.context_excerpt).toBe(true);
    expect(summary?.markdown).toBe(v.knowledge?.summary);
    expect((await vault.context(p.id, { detail: "full" })).notes[0]?.markdown).toBe(v.markdown);
    expect(summary?.knowledge?.exceptions).toEqual(v.knowledge?.exceptions);
  });
  it("shares explicit owner context across repositories without project membership", async () => {
    const other = await vault.ensure({ name: "Other fixture", repository_digest: digest("other") });
    const saved = await vault.capture(
      p.id,
      input({
        type: "preference",
        scope: "owner",
        key: "workflow.automatic-projects",
        basis: "owner_explicit",
        source_statement: "The owner wants agents to create projects automatically.",
        summary:
          "The owner prefers automatic ATLAS project registration without manual setup forms.",
      }),
    );
    expect(saved.project_id).toBeNull();
    expect(saved.path).toMatch(/^Owner\/Knowledge\//);
    expect((await vault.context(other.id, {})).notes[0]?.id).toBe(saved.id);
    expect(
      (await vault.snapshot()).edges.some((e) => e.source === saved.id && e.target === p.id),
    ).toBe(false);
  });
  it("excludes other-project facts and unsupported candidates", async () => {
    const other = await vault.ensure({ name: "Other fixture", repository_digest: digest("other") });
    const saved = await vault.capture(p.id, input());
    await vault.capture(p.id, input({ key: "homepage.guess", basis: "historical_report" }));
    expect((await vault.context(other.id, {})).notes).toHaveLength(0);
    expect((await vault.context(p.id, {})).notes.map((n) => n.id)).toEqual([saved.id]);
    await writeFile(
      join(root, other.path.replace("Project.md", "private-unrelated.md")),
      "---\nbroken: [\n---\nPrivate project report",
    );
    expect(
      (await vault.context(p.id, {})).warnings.some((w) => w.includes("private-unrelated")),
    ).toBe(false);
  });
  it("replaces a claim immutably and excludes its prior version", async () => {
    const old = await vault.capture(p.id, input()),
      raw = await readFile(join(root, old.path), "utf8"),
      v = input(
        {
          summary:
            "This homepage now uses subtle screenshot frames while retaining its parent card styling.",
        },
        "Changed presentation after explicit current verification.",
      );
    if (!v.knowledge || !old.file_digest) throw Error("Missing knowledge");
    v.knowledge.replaces = { id: old.id, expected_file_digest: old.file_digest };
    const saved = await vault.capture(p.id, v);
    expect(await readFile(join(root, old.path), "utf8")).toBe(raw);
    expect(saved.knowledge?.supersedes).toEqual([old.id]);
    expect((await vault.context(p.id, {})).notes.map((n) => n.id)).toEqual([saved.id]);
  });
  it("refuses a changed claim without an explicit current replacement", async () => {
    await vault.capture(p.id, input());
    await expect(
      vault.capture(
        p.id,
        input({ summary: "Different screenshot presentation in the same homepage concept." }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("deduplicates concurrent owner captures across agents and project origins", async () => {
    const other = await vault.ensure({ name: "Other fixture", repository_digest: digest("other") }),
      v = input({
        scope: "owner",
        type: "constraint",
        key: "workflow.local-knowledge",
        basis: "owner_explicit",
        source_statement: "The owner wants one local folder for agent knowledge.",
      });
    const [a, b] = await Promise.all([
      vault.capture(p.id, v),
      createLocalVault(root, "second-agent").capture(other.id, v),
    ]);
    expect(a.id).toBe(b.id);
    expect((await vault.snapshot()).notes.filter((n) => n.knowledge)).toHaveLength(1);
  });
  it("allows only one concurrent replacement of the same prior digest", async () => {
    const old = await vault.capture(p.id, input());
    const a = input(
        { summary: "This homepage uses lightly framed screenshots after a current design update." },
        "One new observation.",
      ),
      b = input(
        { summary: "This homepage uses square framed screenshots after a current design update." },
        "Another new observation.",
      );
    for (const v of [a, b])
      if (v.knowledge && old.file_digest)
        v.knowledge.replaces = { id: old.id, expected_file_digest: old.file_digest };
    const results = await Promise.allSettled([vault.capture(p.id, a), vault.capture(p.id, b)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await vault.context(p.id, {})).notes).toHaveLength(1);
  });
  it("preserves retry aliases and recovers a published file without its receipt", async () => {
    const v = input(),
      saved = await vault.capture(p.id, v);
    await unlink(
      join(root, `.atlas/requests/${digest(`${p.id}:fixture-agent:${v.request_key}`)}.json`),
    );
    expect((await vault.capture(p.id, v)).id).toBe(saved.id);
    expect((await vault.capture(p.id, { ...v, request_key: "alias-request-123" })).id).toBe(
      saved.id,
    );
    await expect(
      vault.capture(p.id, {
        ...v,
        knowledge: {
          ...v.knowledge,
          summary: "Another different screenshot statement for this concept.",
        },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("detects body and frontmatter edits and avoids stale summary projection", async () => {
    const v = input(),
      old = await vault.capture(p.id, v);
    await change(
      old.path,
      { knowledge_summary: "A directly edited screenshot summary has more precise conditions." },
      "Directly edited current body; read this rather than the old summary.",
    );
    const context = await vault.context(p.id, {}),
      n = context.notes[0];
    expect(n?.modified_since_capture).toBe(true);
    expect(n?.context_excerpt).toBe(false);
    expect(n?.markdown).toContain("Directly edited current body");
    expect(context.warnings.some((w) => w.includes("source edited"))).toBe(true);
    expect((await vault.capture(p.id, v)).markdown).toBe(n?.markdown);
    const replacement = input({
      summary: "A subsequent change after the direct edit needs the current digest.",
    });
    if (replacement.knowledge && old.file_digest)
      replacement.knowledge.replaces = { id: old.id, expected_file_digest: old.file_digest };
    await expect(vault.capture(p.id, replacement)).rejects.toMatchObject({ code: "CONFLICT" });
    await change(old.path, {
      knowledge_summary: "A frontmatter-only edit also needs the current body to be read.",
    });
    expect((await vault.context(p.id, {})).notes[0]?.modified_since_capture).toBe(true);
  });
  it("never lets a candidate replace an active claim", async () => {
    const old = await vault.capture(p.id, input()),
      v = input({ basis: "inference" });
    if (v.knowledge && old.file_digest)
      v.knowledge.replaces = { id: old.id, expected_file_digest: old.file_digest };
    await expect(vault.capture(p.id, v)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("does not resurrect an archived replacement's superseded predecessor", async () => {
    const old = await vault.capture(p.id, input()),
      v = input({ summary: "A newer screenshot rule is authoritative until explicitly replaced." });
    if (v.knowledge && old.file_digest)
      v.knowledge.replaces = { id: old.id, expected_file_digest: old.file_digest };
    const saved = await vault.capture(p.id, v);
    await change(saved.path, { archived: true });
    expect((await vault.context(p.id, {})).notes).toHaveLength(0);
  });
  it("reports ambiguous heads and malformed metadata without overwriting files", async () => {
    const saved = await vault.capture(p.id, input()),
      raw = await readFile(join(root, saved.path), "utf8");
    await writeFile(join(root, "duplicate-concept.md"), raw.replace(saved.id, randomUUID()));
    expect((await vault.context(p.id, {})).notes).toHaveLength(0);
    expect((await vault.snapshot()).warnings.some((w) => w.includes("Conflicting knowledge"))).toBe(
      true,
    );
    await writeFile(
      join(root, "invalid-v2.md"),
      "---\natlas_schema: 2\nknowledge_type: preference\n---\nPreserved invalid note",
    );
    expect((await vault.snapshot()).warnings.some((w) => w.includes("invalid-v2"))).toBe(true);
    expect(await readFile(join(root, saved.path), "utf8")).toBe(raw);
  });
  it("detects missing targets and cycles instead of choosing by recency", async () => {
    const old = await vault.capture(p.id, input());
    await change(old.path, { supersedes: [randomUUID()] });
    expect((await vault.context(p.id, {})).notes).toHaveLength(0);
    await change(old.path, { supersedes: [old.id] });
    expect((await vault.snapshot()).notes.find((n) => n.id === old.id)?.effective_state).toBe(
      "conflict",
    );
  });
  it("bounds complete projections, searches topics and ignores templates", async () => {
    const saved = await vault.capture(p.id, input({}, "Useful detailed rationale. ".repeat(150)));
    const small = await vault.context(p.id, { character_budget: 1000 });
    expect(JSON.stringify(small.notes).length).toBeLessThanOrEqual(1000);
    expect(small.truncated).toBe(true);
    expect((await vault.context(p.id, { query: "screenshots" })).notes[0]?.id).toBe(saved.id);
    await mkdir(join(root, "Templates"));
    await writeFile(
      join(root, "Templates/Knowledge.md"),
      "---\natlas_schema: 2\n---\nUnfilled template",
    );
    expect((await vault.snapshot()).warnings.some((w) => w.includes("Templates"))).toBe(false);
  });
  it("rejects unknown sources and secrets in semantic fields", async () => {
    await expect(
      vault.capture(p.id, input({ source_note_ids: [randomUUID()] })),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      vault.capture(p.id, input({ rationale: `api_key=${"x".repeat(25)}` })),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await vault.snapshot()).notes.filter((n) => n.knowledge)).toHaveLength(0);
    expect(await readdir(join(root, ".atlas"))).not.toContain("requests");
  });
  it("passes knowledge through protected local HTTP and returns scoped context", async () => {
    const token = `atlas_${randomBytes(32).toString("base64url")}`,
      local = createLocalServices(root, { agentId: "fixture-agent", token }),
      app = createApp(loadConfig({}), undefined, undefined, local);
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      base = "http://localhost:4317/api/v1/agent/projects";
    const saved = await app.request(`${base}/${p.id}/checkpoints`, {
      method: "POST",
      headers,
      body: JSON.stringify(input()),
    });
    expect(saved.status).toBe(201);
    const context = await app.request(`${base}/${p.id}/context`, {
      method: "POST",
      headers,
      body: "{}",
    });
    expect((await context.json()).notes).toHaveLength(1);
    expect(
      (await app.request(`${base}/${p.id}/context`, { method: "POST", body: "{}" })).status,
    ).toBe(403);
  });
});
