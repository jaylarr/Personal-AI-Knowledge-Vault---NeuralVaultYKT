import { mkdtemp, readFile, writeFile, rm, readdir, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { createLocalVault, encodeNote, digest } from "@atlas/core/local-vault";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { createLocalServices } from "../../apps/api/src/local-vault.js";
let root: string;
const v = () => createLocalVault(root, "fixture-agent");
const note = {
  title: "Local observation",
  kind: "lesson" as const,
  markdown: "Observed local result.",
  provenance: { paths: ["src/main.ts"], verification: "Controlled local test" },
  request_key: "local-request-12345",
};
const project = () =>
  v().ensure({ name: "Local project", repository_digest: digest("local-project") });
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "atlas-local-"));
});
afterEach(async () => {
  if (
    !resolve(root).startsWith(`${resolve(tmpdir())}\\atlas-local-`) &&
    !resolve(root).startsWith(`${resolve(tmpdir())}/atlas-local-`)
  )
    throw Error("Unexpected fixture cleanup target");
  await rm(root, { recursive: true, force: true });
});
describe("local Markdown source of truth", () => {
  it("serializes independent Node processes through the same vault lock", async () => {
    const code = `import {createLocalVault,digest} from '@atlas/core/local-vault'; const v=createLocalVault(process.argv[1],'fixture-agent'); const p=await v.ensure({name:'Process project',repository_digest:digest('process-project')}); const n=await v.capture(p.id,JSON.parse(process.argv[2])); console.log(n.id);`;
    const run = () =>
      promisify(execFile)(
        process.execPath,
        ["--input-type=module", "-e", code, root, JSON.stringify(note)],
        { cwd: resolve("."), windowsHide: true, timeout: 15000 },
      );
    const [a, b] = await Promise.all([run(), run()]);
    expect(a.stdout.trim()).toBe(b.stdout.trim());
    expect((await v().snapshot()).notes).toHaveLength(2);
  }, 20000);
  it("concurrent project ensures create one portable Markdown file", async () => {
    const p = await Promise.all(Array.from({ length: 6 }, () => project()));
    expect(new Set(p.map((x) => x.id)).size).toBe(1);
    const data = await v().snapshot();
    expect(data.notes).toHaveLength(1);
    expect(await readFile(join(root, p[0]?.path ?? ""), "utf8")).toContain("repository_digest:");
  });
  it("deduplicates concurrent captures and preserves request aliases/conflicts", async () => {
    const p = await project(),
      saved = await Promise.all([
        v().capture(p.id, note),
        v().capture(p.id, { ...note, request_key: "second-request-12345" }),
      ]);
    expect(saved[0]?.id).toBe(saved[1]?.id);
    await expect(
      v().capture(p.id, { ...note, request_key: "second-request-12345", markdown: "Changed" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await v().context(p.id, { context_mode: "activity" })).notes).toHaveLength(1);
  });
  it("a fresh store reads committed files without a database", async () => {
    const p = await project(),
      saved = await v().capture(p.id, note);
    const fresh = createLocalVault(root, "fixture-agent");
    expect((await fresh.context(p.id, { context_mode: "activity" })).notes[0]?.id).toBe(saved.id);
  });
  it("sees direct edits and never overwrites them on retry; retains observed versions", async () => {
    const p = await project(),
      saved = await v().capture(p.id, note),
      path = join(root, saved.path),
      raw = await readFile(path, "utf8");
    await writeFile(path, raw.replace(note.markdown, "Deliberate direct edit."));
    const retried = await v().capture(p.id, note);
    expect(retried.markdown).toBe("Deliberate direct edit.");
    expect(retried.modified_since_capture).toBe(true);
    const history = await readdir(join(root, ".atlas/history", digest(saved.id).slice(0, 32)));
    expect(history.length).toBe(2);
  });
  it("includes plain Markdown and infers project membership from its folder", async () => {
    const p = await project(),
      path = p.path.replace("Project.md", "plain.md");
    await writeFile(join(root, path), "# Plain note\n\nKept directly in the project folder.");
    const context = await v().context(p.id, { context_mode: "activity" });
    expect(context.notes[0]?.title).toBe("Plain note");
    expect(context.notes[0]?.agent_id).toBeNull();
    expect(context.notes[0]?.status).toBe("local_file");
  });
  it("builds actual wikilinks, aliases and Markdown links while ignoring code", async () => {
    await v().initialize();
    await writeFile(
      join(root, "alpha.md"),
      encodeNote({ atlas_id: "alpha", title: "Alpha", aliases: ["One"] }, "# Alpha"),
    );
    await writeFile(
      join(root, "beta.md"),
      encodeNote(
        { atlas_id: "beta", title: "Beta", links: ["[[Alpha]]"] },
        "[[One|alias]] and [Alpha](alpha.md)\n\n```\n[[Missing in code]]\n```",
      ),
    );
    const data = await v().snapshot();
    expect(data.edges).toEqual([{ source: "beta", target: "alpha", kind: "wikilink" }]);
    expect(data.warnings).toHaveLength(0);
  });
  it("reports unresolved/ambiguous links without inventing nodes", async () => {
    await v().initialize();
    await writeFile(join(root, "a.md"), "# Same\n\n[[Missing]]");
    await writeFile(join(root, "b.md"), "# Same\n\n[[Same]]");
    const data = await v().snapshot();
    expect(data.notes).toHaveLength(2);
    expect(data.edges).toHaveLength(0);
    expect(data.warnings.some((w) => w.includes("unresolved"))).toBe(true);
    expect(data.warnings.some((w) => w.includes("ambiguous"))).toBe(true);
  });
  it("rejects path traversal, absolute paths and Windows device names", async () => {
    await v().initialize();
    for (const path of [
      "../outside.md",
      "/outside.md",
      "C:/outside.md",
      "CON.md",
      "safe/../bad.md",
    ])
      await expect(v().writeExclusive(path, "unsafe")).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
  });
  it("refuses to overwrite an existing file", async () => {
    await v().initialize();
    await v().writeExclusive("kept.md", "Original");
    await expect(v().writeExclusive("kept.md", "Replacement")).rejects.toMatchObject({
      code: "EEXIST",
    });
    expect(await readFile(join(root, "kept.md"), "utf8")).toBe("Original");
  });
  it("skips junctions/symlinks and refuses writes through them", async () => {
    await v().initialize();
    const outer = join(root, ".outside");
    await mkdir(outer);
    await writeFile(join(outer, "private.md"), "Private fixture");
    await symlink(outer, join(root, "redirect"), process.platform === "win32" ? "junction" : "dir");
    const data = await v().snapshot();
    expect(data.notes).toHaveLength(0);
    expect(data.warnings.some((w) => w.includes("symbolic link"))).toBe(true);
    await expect(v().writeExclusive("redirect/created.md", "Denied")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
  it("preserves malformed metadata and excludes duplicate IDs", async () => {
    await v().initialize();
    const bad = "---\nvalue: [unterminated\n---\nKept";
    await writeFile(join(root, "bad.md"), bad);
    for (const path of ["one.md", "two.md"])
      await writeFile(join(root, path), encodeNote({ atlas_id: "duplicate" }, "Some note"));
    const data = await v().snapshot();
    expect(data.notes).toHaveLength(0);
    expect(data.warnings.length).toBeGreaterThan(1);
    expect(await readFile(join(root, "bad.md"), "utf8")).toBe(bad);
  });
  it("respects archived projects, secret filters and byte limits", async () => {
    const p = await project();
    await expect(
      v().capture(p.id, { ...note, markdown: `atlas_${"a".repeat(43)}` }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      v().capture(p.id, { ...note, markdown: "漢".repeat(12000) }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await writeFile(
      join(root, p.path),
      encodeNote(
        {
          atlas_id: p.id,
          atlas_type: "project",
          repository_digest: digest("local-project"),
          archived: true,
        },
        "# Archived",
      ),
    );
    await expect(project()).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("recovers a dead process lock without stealing a live writer", async () => {
    await v().initialize();
    await writeFile(
      join(root, ".atlas/write.lock"),
      JSON.stringify({ pid: 2147483647, id: randomUUID() }),
    );
    expect((await project()).id).toBeTruthy();
  });
  it.each(["size", "depth"])(
    "refuses automatic writes when the %s bound hides files",
    async (bound) => {
      const p = await project(),
        original = await readFile(join(root, p.path), "utf8");
      if (bound === "size") {
        await writeFile(join(root, "oversized.md"), "x".repeat(2 * 1024 * 1024 + 1));
      } else {
        const nested = join(root, ...Array.from({ length: 13 }, (_, i) => `level-${i}`));
        await mkdir(nested, { recursive: true });
        await writeFile(join(nested, "hidden.md"), "# Hidden project evidence");
      }
      expect((await v().snapshot()).truncated).toBe(true);
      await expect(project()).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(v().capture(p.id, note)).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await readFile(join(root, p.path), "utf8")).toBe(original);
      expect((await v().snapshot()).notes.filter((n) => n.kind === "project")).toHaveLength(1);
      await expect(readdir(join(root, ".atlas/requests"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
  );
  it("protects local HTTP reads/writes and rejects cross-site/rebinding", async () => {
    const token = `atlas_${randomBytes(32).toString("base64url")}`,
      local = createLocalServices(root, { token, agentId: "fixture-agent" }),
      app = createApp(loadConfig({}), undefined, undefined, local),
      base = "http://localhost:4317";
    expect((await app.request(`${base}/api/v1/local/vault`)).status).toBe(401);
    const cookie = (await app.request(`${base}/`)).headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(
      (await app.request(`${base}/api/v1/local/vault`, { headers: { Cookie: cookie } })).status,
    ).toBe(200);
    expect(
      (
        await app.request(`${base}/api/v1/local/vault`, {
          headers: { Cookie: cookie, Origin: "https://evil.example" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request(`${base}/api/v1/local/vault`, {
          headers: { Cookie: cookie, Host: "evil.example" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request(`${base}/api/v1/agent/projects/ensure`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "API fixture", repository_digest: digest("api") }),
        })
      ).status,
    ).toBe(200);
    expect(
      (await app.request(`${base}/api/v1/agent/projects/ensure`, { method: "POST", body: "{}" }))
        .status,
    ).toBe(403);
    expect((await app.request(`${base}/ready`)).status).toBe(200);
  });
});
