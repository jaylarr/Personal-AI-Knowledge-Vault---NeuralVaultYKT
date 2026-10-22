import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import { sha256 } from "@atlas/core/local-domain";
it("hooks require current-turn consent, never echo text, and publish duplicate-safe metadata only", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-hook-")),
    vault = join(root, "Vault"),
    home = join(root, "Codex"),
    source = join(home, "sessions", "test.jsonl");
  await mkdir(join(root, ".local"), { recursive: true });
  await mkdir(join(home, "sessions"), { recursive: true });
  await writeFile(source, "{}\n");
  await writeFile(join(root, ".local", "vault.json"), JSON.stringify({ root: vault }));
  await writeFile(
    join(root, ".local", "personal-hosts.json"),
    JSON.stringify({
      format_version: 1,
      hosts: [{ id: "hook-pc", kind: "codex-local-jsonl", enabled: true, codex_home: home }],
    }),
  );
  const input = {
    hook_event_name: "Stop",
    session_id: "test",
    turn_id: "turn",
    permission_mode: "default",
    transcript_path: source,
    last_assistant_message: "PRIVATE SENTINEL NOT TO BE ECHOED",
  };
  const durations: number[] = [];
  const run = (value: unknown) => {
    const started = performance.now();
    const r = spawnSync(
      process.execPath,
      [resolve("scripts/codex-personal-hook.mjs"), "--project-root", root],
      { input: JSON.stringify(value), encoding: "utf8", windowsHide: true },
    );
    durations.push(performance.now() - started);
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).not.toContain("PRIVATE SENTINEL");
    return JSON.parse(r.stdout);
  };
  try {
    expect(run(input)).toEqual({});
    await expect(readdir(join(vault, ".atlas", "personal", "spool"))).rejects.toThrow();
    const session = sha256("hook-pc:test"),
      turn = sha256("turn");
    await mkdir(join(vault, ".atlas", "personal", "consent"), { recursive: true });
    await writeFile(
      join(vault, ".atlas", "personal", "consent", `${session}-${turn}.json`),
      JSON.stringify({ mode: "allow", session_key: session, turn_id: "turn" }),
    );
    run({ ...input, permission_mode: "plan" });
    await expect(readdir(join(vault, ".atlas", "personal", "spool"))).rejects.toThrow();
    run(input);
    run(input);
    const files = await readdir(join(vault, ".atlas", "personal", "spool"));
    expect(files).toHaveLength(1);
    const text = await readFile(join(vault, ".atlas", "personal", "spool", files[0]!), "utf8");
    expect(text).not.toContain(source);
    expect(text).not.toContain("PRIVATE SENTINEL");
    expect(
      run({ ...input, hook_event_name: "SessionStart" }).hookSpecificOutput.hookEventName,
    ).toBe("SessionStart");
    durations.sort((a, b) => a - b);
    const result = {
      calls: durations.length,
      p95_ms: durations[Math.ceil(durations.length * 0.95) - 1],
      max_ms: Math.max(...durations),
    };
    await mkdir(".artifacts/personal-memory-execution-2026-10-22", { recursive: true });
    await writeFile(
      ".artifacts/personal-memory-execution-2026-10-22/hook-performance.json",
      JSON.stringify(result),
    );
    expect(result.p95_ms).toBeLessThan(1000);
    expect(result.max_ms).toBeLessThan(2000);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it("installer dry-run preserves unrelated hook groups and apply is repeatable in a fake home", async () => {
  const root = await mkdtemp(join(tmpdir(), "atlas-install-")),
    home = join(root, "Home"),
    project = join(root, "Project");
  await mkdir(home);
  await mkdir(join(project, "scripts"), { recursive: true });
  await mkdir(join(project, "docs"));
  await writeFile(join(project, "scripts", "codex-personal-hook.mjs"), "// fixture\n");
  await writeFile(
    join(project, "docs", "CODEX_GLOBAL_INSTRUCTIONS.md"),
    "<!-- ATLAS-WORKFLOW:BEGIN -->\nPersonal fixture instructions\n<!-- ATLAS-WORKFLOW:END -->",
  );
  const hooks = {
    custom: "preserve",
    hooks: { Stop: [{ hooks: [{ type: "command", command: "devdock-fixture" }] }] },
  };
  const hooksRaw = JSON.stringify(hooks, null, 2) + "\n";
  await writeFile(join(home, "hooks.json"), hooksRaw);
  await writeFile(join(home, "AGENTS.md"), "Unrelated owner instructions.\n");
  const pwsh =
    "C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe";
  const args = [
    "-NoProfile",
    "-File",
    resolve("scripts/install-personal-workflow.ps1"),
    "-CodexHome",
    home,
    "-ProjectRoot",
    project,
  ];
  try {
    execFileSync(pwsh, args, { windowsHide: true });
    expect(JSON.parse(await readFile(join(home, "hooks.json"), "utf8"))).toEqual(hooks);
    execFileSync(pwsh, [...args, "-Apply"], { windowsHide: true });
    execFileSync(pwsh, [...args, "-Apply"], { windowsHide: true });
    const after = JSON.parse(await readFile(join(home, "hooks.json"), "utf8"));
    expect(after.hooks.Stop).toHaveLength(2);
    expect(after.hooks.Stop[0]).toEqual(hooks.hooks.Stop[0]);
    expect(after.custom).toBe("preserve");
    const afterRaw = await readFile(join(home, "hooks.json"), "utf8");
    expect(afterRaw).toContain('"custom": "preserve"');
    expect(afterRaw).toContain(
      JSON.stringify(hooks.hooks.Stop[0], null, 2)
        .split("\n")
        .map((line, index) => (index ? `      ${line}` : line))
        .join("\n"),
    );
    expect(await readFile(join(home, "AGENTS.md"), "utf8")).toContain(
      "Unrelated owner instructions.",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
