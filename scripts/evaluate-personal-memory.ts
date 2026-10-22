import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createLocalServices } from "../apps/api/src/local-vault.js";
import { z } from "@atlas/contracts";
const allowed = z.enum(["owner", "project", "no_value", "candidate", "replace", "excluded"]);
const fixture = z
  .object({
    cases: z.array(
      z.object({
        id: z.string(),
        input: z.string(),
        expected: allowed,
        concept: z.string().optional(),
      }),
    ),
  })
  .passthrough()
  .parse(JSON.parse(await readFile("tests/fixtures/personal/expected-cases.json", "utf8")));
const path = process.argv[2] ?? "tests/fixtures/personal/agent-results.json";
const judgments = z
  .object({
    basis: z.literal("connected_agent_review"),
    cases: z
      .array(z.object({ id: z.string(), outcome: allowed, reason: z.string().min(10) }))
      .length(30),
  })
  .strict()
  .parse(JSON.parse(await readFile(path, "utf8")));
if (new Set(judgments.cases.map((x) => x.id)).size !== 30) throw Error("Duplicate judgment ids");
const misses = fixture.cases
  .filter((f) => judgments.cases.find((x) => x.id === f.id)?.outcome !== f.expected)
  .map((f) => f.id);
// Apply the connected agent's submitted subjects to a separate synthetic vault.
// This is deterministic persistence validation, not a test-only AI classifier.
const subjects = z
  .array(
    z
      .object({
        id: z.string(),
        key: z.string(),
        summary: z.string(),
        applies_when: z.string(),
        exceptions: z.array(z.string()),
      })
      .strict(),
  )
  .length(11)
  .parse(JSON.parse(await readFile("tests/fixtures/personal/reviewed-subjects.json", "utf8")));
const base = await mkdtemp(join(tmpdir(), "atlas-personal-oracle-"));
const local = createLocalServices(join(base, "Vault"), { agentId: "synthetic-oracle" }),
  owner = { kind: "owner" as const, id: "synthetic-owner" };
let retained = 0,
  corrected = 0;
try {
  await local.personal.policy.update(owner, {
    policy: { enabled: true, baseline_keys: [] },
    expected_revision: 0,
    request_key: randomUUID(),
  });
  const heads = new Map<string, { id: string; file_digest: string; path: string }>();
  for (const subject of subjects) {
    const source = fixture.cases.find((item) => item.id === subject.id);
    const outcome = judgments.cases.find((item) => item.id === subject.id)?.outcome;
    if (!source || !["owner", "replace"].includes(outcome ?? ""))
      throw Error("Only submitted explicit owner subjects may be applied");
    const previous = heads.get(subject.key),
      before = previous ? await readFile(join(base, "Vault", previous.path), "utf8") : null;
    const confirmation = await local.personal.policy.confirmation(owner, {
      request_key: randomUUID(),
      concept_key: subject.key,
      statement: source.input,
      summary: subject.summary,
      applies_when: subject.applies_when,
      exceptions: subject.exceptions,
    });
    const saved = await local.personal.capture(owner, {
      title: subject.key,
      kind: "decision",
      markdown: `${subject.summary}\n\nApplies when: ${subject.applies_when}\n\nSynthetic fixture only.`,
      request_key: randomUUID(),
      owner_confirmation_id: confirmation.id,
      provenance: {
        paths: [],
        verification:
          "Submitted connected-agent extraction from the fixed synthetic oracle, confirmed by the fictional fixture owner.",
      },
      knowledge: {
        type: "preference",
        scope: "owner",
        key: subject.key,
        summary: subject.summary,
        applies_when: subject.applies_when,
        exceptions: subject.exceptions,
        topics: ["workflow"],
        basis: "owner_explicit",
        source_statement: source.input,
        ...(previous
          ? { replaces: { id: previous.id, expected_file_digest: previous.file_digest } }
          : {}),
      },
    });
    if (!saved.file_digest) throw Error("Saved fixture is missing its file digest");
    heads.set(subject.key, { id: saved.id, file_digest: saved.file_digest, path: saved.path });
    if (previous) {
      if ((await readFile(join(base, "Vault", previous.path), "utf8")) !== before)
        throw Error("Original correction source changed");
      corrected++;
    }
  }
  const packet = await local.personal.context(owner, { limit: 20, character_budget: 24000 });
  retained = packet.notes.length;
  if (
    retained !== 8 ||
    corrected !== 3 ||
    packet.project_notes.length ||
    [...heads.values()].some((head) => !packet.notes.some((n) => n.id === head.id))
  )
    throw Error("Synthetic retention/current-head check failed");
} finally {
  local.domain.close();
  await rm(base, { recursive: true, force: true });
}
const report = {
  kind: "synthetic_agent_attestation",
  total: fixture.cases.length,
  correct: fixture.cases.length - misses.length,
  misses,
  explicit_subjects_retained: retained,
  corrections_current_and_originals_preserved: corrected,
  real_chat_acceptance: false,
  warning:
    "Measures submitted judgments on fixed synthetic cases. It does not prove real-history extraction or future-chat application.",
};
await mkdir(".artifacts/personal-memory-execution-2026-10-22", { recursive: true });
await writeFile(
  resolve(".artifacts/personal-memory-execution-2026-10-22/evaluation.json"),
  JSON.stringify(report, null, 2) + "\n",
);
process.stdout.write(JSON.stringify(report) + "\n");
if (misses.length) process.exitCode = 1;
