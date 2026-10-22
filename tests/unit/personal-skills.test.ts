import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { createLocalServices } from "../../apps/api/src/local-vault.js";
const owner = { kind: "owner" as const, id: "owner" },
  key = () => randomUUID();
it("discovers metadata, rechecks changed sources, and backs up only selected custom sources into a separate restore", async () => {
  const base = await mkdtemp(join(tmpdir(), "atlas-skill-")),
    skills = join(base, "Skills"),
    folder = join(skills, "review");
  await mkdir(folder, { recursive: true });
  const local = createLocalServices(join(base, "Vault"), {
    agentId: "fixture",
    personalHosts: [
      {
        id: "skill-pc",
        kind: "codex-local-jsonl",
        enabled: true,
        codex_home: join(base, "Codex"),
        skill_roots: [skills],
      },
    ],
  });
  const body =
    "---\nname: review-work\ndescription: Review an explicit implementation plan.\n---\nCheck inputs and preserve original files.\n";
  await writeFile(join(folder, "SKILL.md"), body);
  await writeFile(join(folder, "reference.md"), "Useful reference with no personal transcript.");
  try {
    await local.personal.skills.scan(owner, { host_id: "skill-pc", request_key: key() });
    const items = (await local.personal.skills.list(owner)).skills;
    expect(items).toHaveLength(1);
    const skill = items[0]!;
    expect(skill.state).toBe("discovered");
    expect((await local.personal.context(owner, { query: "review" })).skills).toEqual([]);
    const record = (await local.personal.skills.records())[0]!;
    await local.personal.skills.curate(owner, skill.id, {
      state: "curated",
      kind: "owner_custom",
      triggers: ["review"],
      expected_revision: record.revision,
      request_key: key(),
    });
    const curated = (await local.personal.skills.records())[0]!;
    await expect(
      local.personal.skills.backup(owner, skill.id, {
        files: ["../secret.md"],
        expected_revision: curated.revision,
        request_key: key(),
      }),
    ).rejects.toThrow();
    await local.personal.skills.backup(owner, skill.id, {
      files: ["SKILL.md", "reference.md"],
      expected_revision: curated.revision,
      request_key: key(),
    });
    const target = join(base, "RestoredSkill");
    await local.personal.skills.restore(owner, skill.id, { destination: target });
    expect(await readFile(join(target, "SKILL.md"), "utf8")).toBe(body);
    await expect(
      local.personal.skills.restore(owner, skill.id, { destination: folder }),
    ).rejects.toThrow("SKILL_RESTORE_TARGET_DENIED");
    if (process.platform === "win32")
      await expect(
        local.personal.skills.restore(owner, skill.id, {
          destination: join(base, "Vault", "NestedRestore").toUpperCase(),
        }),
      ).rejects.toThrow("SKILL_RESTORE_TARGET_DENIED");
    await writeFile(join(folder, "SKILL.md"), body + "New version.\n");
    expect((await local.personal.skills.list(owner)).skills[0]?.availability).toBe("changed");
    await expect(
      local.personal.skills.list(owner, {
        skill_id: skill.id,
        read_body: true,
        expected_digest: skill.sha256,
      }),
    ).rejects.toThrow("SKILL_SOURCE_CHANGED");
  } finally {
    local.domain.close();
    if (resolve(base).startsWith(resolve(tmpdir())))
      await rm(base, { recursive: true, force: true });
  }
});
