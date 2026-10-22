import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createLocalServices } from "../apps/api/src/local-vault.js";
import { encodeNote, digest } from "@atlas/core/local-vault";
import { sha256, type Mutation } from "@atlas/core/local-domain";
const base = await mkdtemp(join(tmpdir(), "atlas-personal-perf-")),
  home = join(base, "Codex"),
  root = join(base, "Vault"),
  skills = join(base, "Skills");
const local = createLocalServices(root, {
  agentId: "performance-fixture",
  personalHosts: [
    {
      id: "perf-pc",
      kind: "codex-local-jsonl",
      enabled: true,
      codex_home: home,
      skill_roots: [skills],
    },
  ],
});
const owner = { kind: "owner" as const, id: "performance-fixture" };
try {
  await mkdir(join(home, "sessions"), { recursive: true });
  await mkdir(join(root, "Owner", "Knowledge"), { recursive: true });
  await mkdir(skills);
  await local.personal.policy.update(owner, {
    policy: { enabled: true, enabled_hosts: ["perf-pc"], baseline_keys: [] },
    expected_revision: 0,
    request_key: randomUUID(),
  });
  for (let i = 0; i < 1000; i++)
    await writeFile(
      join(home, "sessions", `${i}.jsonl`),
      [
        {
          type: "session_meta",
          payload: { id: `fixture-${i}`, cli_version: "0.163.0-alpha.11", source: "vscode" },
        },
        {
          type: "event_msg",
          payload: {
            type: "item_completed",
            turn_id: "turn",
            item: {
              type: "UserMessage",
              id: "message",
              content: [
                { type: "text", text: `Synthetic routine edit ${i} contains no reusable subject.` },
              ],
            },
          },
        },
        { type: "event_msg", payload: { type: "task_complete", turn_id: "turn" } },
      ]
        .map((x) => JSON.stringify(x))
        .join("\n") + "\n",
    );
  const scanTimes = [],
    scanStart = performance.now();
  let cursor = 0,
    scope: string | undefined;
  do {
    const start = performance.now();
    const page = await local.personal.sessions.scan(owner, {
      host_id: "perf-pc",
      cursor,
      ...(scope ? { scope_digest: scope } : {}),
    });
    scanTimes.push(performance.now() - start);
    process.stdout.write(
      JSON.stringify({
        stage: "scan",
        cursor: page.next_cursor,
        elapsed_ms: scanTimes.at(-1),
        timings_ms: page.timings_ms,
      }) + "\n",
    );
    scope = page.scope_digest;
    cursor = page.next_cursor ?? -1;
  } while (cursor >= 0);
  const scanMs = performance.now() - scanStart;
  const mutations: Mutation[] = [];
  for (let i = 0; i < 200; i++) {
    const text = `Synthetic preference for uniquetopic${i} under its stated condition.`;
    await writeFile(
      join(root, "Owner", "Knowledge", `fixture-${i}.md`),
      encodeNote(
        {
          atlas_schema: 2,
          atlas_id: randomUUID(),
          atlas_type: "decision",
          title: `uniquetopic${i}`,
          knowledge_type: "preference",
          knowledge_scope: "owner",
          knowledge_key: `workflow.fixture-${i}`,
          knowledge_summary: text,
          knowledge_applies_when: "Only the synthetic performance fixture.",
          knowledge_exceptions: [],
          knowledge_topics: [`uniquetopic${i}`],
          knowledge_basis: "owner_explicit",
          knowledge_source_statement: "Synthetic owner statement.",
          knowledge_state: "active",
          knowledge_source_note_ids: [],
          supersedes: [],
          body_digest: digest(text),
        },
        text,
      ),
    );
    const path = join(skills, `${i}`);
    await mkdir(path);
    const body = `---\nname: fixture-${i}\ndescription: Procedure for uniquetopic${i}.\n---\nRead its instructions.\n`;
    await writeFile(join(path, "SKILL.md"), body);
    const id = randomUUID();
    mutations.push({
      kind: "skill_ref",
      entity_id: id,
      expected_revision: 0,
      body: "Synthetic skill reference.",
      data: {
        canonical_path: join(path, "SKILL.md"),
        skill: {
          id,
          name: `fixture-${i}`,
          description: `Procedure for uniquetopic${i}.`,
          triggers: [`uniquetopic${i}`],
          kind: "owner_custom",
          state: "curated",
          locator_id: sha256(path),
          sha256: sha256(body),
          duplicate_locators: [],
          availability: "available",
          host_id: "perf-pc",
          source: "fixture",
          last_checked_at: new Date().toISOString(),
          backup_manifest: null,
        },
      },
    });
  }
  await local.domain.store.transaction(owner, randomUUID(), { fixture: true }, () => ({
    mutations,
    result: {},
  }));
  await local.personal.context(owner, { query: "uniquetopic199" });
  const times = [];
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    const packet = await local.personal.context(owner, { query: "uniquetopic199" });
    if (!packet.notes.length || JSON.stringify(packet).length > 10000)
      throw Error("Context budget/retrieval failed");
    times.push(performance.now() - start);
    process.stdout.write(
      JSON.stringify({ stage: "context", call: i, elapsed_ms: times.at(-1) }) + "\n",
    );
  }
  times.sort((a, b) => a - b);
  const result = {
    fixture: "1000 synthetic sessions; 200 owner subjects; 200 curated local skill refs",
    scan_total_ms: scanMs,
    scan_request_max_ms: Math.max(...scanTimes),
    scan_requests: scanTimes.length,
    context_calls: 30,
    context_p95_ms: times[28],
    passed: scanMs <= 30000 && Math.max(...scanTimes) <= 4000 && times[28]! <= 500,
  };
  await mkdir(".artifacts/personal-memory-execution-2026-10-22", { recursive: true });
  await writeFile(
    ".artifacts/personal-memory-execution-2026-10-22/performance.json",
    JSON.stringify(result, null, 2),
  );
  process.stdout.write(JSON.stringify(result) + "\n");
  if (!result.passed) process.exitCode = 1;
} finally {
  local.domain.close();
  await rm(base, { recursive: true, force: true });
}
