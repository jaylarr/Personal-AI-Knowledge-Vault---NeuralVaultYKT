import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it, expect } from "vitest";
import { checkpointInputSchema } from "@atlas/contracts";
import { assertCheckpointContent } from "@atlas/core";
import { identifyRepository, normalizeRemote } from "../../apps/mcp-server/src/repository.js";
const note = {
  title: "A decision",
  kind: "decision" as const,
  markdown: "Observed choice with evidence.",
  provenance: { paths: ["src/app.ts"], verification: "Typecheck passed" },
  request_key: "request-12345",
};
describe("agent project workflow boundaries", () => {
  it("normalizes SSH/HTTPS without persisting remote credentials or query strings", () => {
    expect(normalizeRemote("git@github.com:Owner/Repository.git")).toBe(
      "remote:github.com/owner/repository",
    );
    expect(
      normalizeRemote("https://name:secret@github.com/Owner/Repository.git?token=secret#x"),
    ).toBe("remote:github.com/owner/repository");
    expect(normalizeRemote("file:///private/repo")).toBeUndefined();
  });
  it("identifies nested folders as one local Git project", async () => {
    const root = await mkdtemp(join(tmpdir(), "atlas-repo-"));
    try {
      execFileSync("git", ["init", root], { stdio: "ignore", windowsHide: true });
      await mkdir(join(root, "nested"));
      expect((await identifyRepository(join(root, "nested"))).repository_digest).toBe(
        (await identifyRepository(root)).repository_digest,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 35000);
  it("rejects relative or missing directories", async () => {
    await expect(identifyRepository("relative")).rejects.toThrow("absolute");
  });
  it("rejects secret evidence paths and traversal", () => {
    for (const path of [".env.local", "../config.ts", "secrets/id_rsa", "C:\\private\\file.ts"])
      expect(
        checkpointInputSchema.safeParse({
          ...note,
          provenance: { ...note.provenance, paths: [path] },
        }).success,
      ).toBe(false);
  });
  it("blocks recognizable credentials and private keys before persistence", () => {
    for (const markdown of [
      "postgresql://user:password@host/db",
      "-----BEGIN PRIVATE KEY-----",
      `atlas_${"a".repeat(43)}`,
      `api_key=${"a".repeat(25)}`,
    ])
      expect(() => assertCheckpointContent({ ...note, markdown })).toThrow();
    expect(() => assertCheckpointContent(note)).not.toThrow();
  });
  it("enforces a UTF8 byte limit as well as string bounds", () => {
    expect(() => assertCheckpointContent({ ...note, markdown: "漢".repeat(12000) })).toThrow();
  });
});
