import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { createLocalServices } from "../../apps/api/src/local-vault.js";
import {
  backupLocalVault,
  restoreLocalVault,
  createLocalStore,
  sha256,
} from "@atlas/core/local-domain";
import { createLocalVault } from "@atlas/core/local-vault";
it("restores coverage independently, disables personal capture, and rejects a corrupted journal even in a valid backup", async () => {
  const base = await mkdtemp(join(tmpdir(), "atlas-personal-restore-")),
    home = join(base, "Codex"),
    root = join(base, "Vault");
  await mkdir(join(home, "sessions"), { recursive: true });
  await writeFile(
    join(home, "sessions", "fixture.jsonl"),
    [
      {
        type: "session_meta",
        payload: { id: "restore", cli_version: "0.163.0-alpha.11", source: "vscode" },
      },
      {
        type: "event_msg",
        payload: {
          type: "item_completed",
          turn_id: "turn",
          item: {
            type: "UserMessage",
            id: "message",
            content: [{ type: "text", text: "A synthetic routine task." }],
          },
        },
      },
      { type: "event_msg", payload: { type: "task_complete", turn_id: "turn" } },
    ]
      .map((e) => JSON.stringify(e))
      .join("\n") + "\n",
  );
  const local = createLocalServices(root, {
      agentId: "fixture",
      personalHosts: [
        {
          id: "restore-pc",
          enabled: true,
          kind: "codex-local-jsonl",
          codex_home: home,
          skill_roots: [],
        },
      ],
    }),
    owner = { kind: "owner" as const, id: "owner" };
  try {
    await local.personal.policy.update(owner, {
      policy: { enabled: true, enabled_hosts: ["restore-pc"] },
      expected_revision: 0,
      request_key: randomUUID(),
    });
    await local.personal.sessions.scan(owner, { host_id: "restore-pc" });
    const pack = join(base, "Backup"),
      copy = join(base, "Restored");
    await backupLocalVault(local.domain.store, pack);
    await restoreLocalVault(pack, copy);
    const restored = createLocalStore(createLocalVault(copy, "restored"));
    try {
      expect(
        (await restored.catalog()).heads.get("settings:personal-policy-v1")?.data.policy,
      ).toMatchObject({ enabled: false, enabled_hosts: [] });
    } finally {
      restored.close();
    }
    const coverage = join(
      root,
      ".atlas",
      "personal",
      "coverage",
      "restore-pc",
      sha256("restore-pc:restore"),
    );
    const file = join(coverage, (await readdir(coverage))[0]!);
    const event = JSON.parse(await readFile(file, "utf8"));
    event.previous_event_sha256 = "a".repeat(64);
    await writeFile(file, JSON.stringify(event));
    const broken = join(base, "BrokenBackup");
    await backupLocalVault(local.domain.store, broken);
    await expect(restoreLocalVault(broken, join(base, "BrokenRestored"))).rejects.toThrow(
      "PERSONAL_JOURNAL_INTEGRITY",
    );
  } finally {
    local.domain.close();
    await rm(base, { recursive: true, force: true });
  }
}, 15000);
