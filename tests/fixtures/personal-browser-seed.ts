import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { createLocalServices } from "../../apps/api/src/local-vault.js";
export async function seedPersonal(local: ReturnType<typeof createLocalServices>, base: string) {
  const owner = { kind: "owner" as const, id: "controlled-browser-owner" };
  await local.personal.policy.update(owner, {
    policy: { enabled: true, enabled_hosts: ["browser-pc"], candidates_enabled: true },
    expected_revision: 0,
    request_key: randomUUID(),
  });
  const statement = "For this fictional test, I prefer concise progress updates with evidence.";
  const summary = "Use concise progress updates with evidence for this fictional owner.";
  const applies_when = "When reporting routine implementation progress in this fictional fixture.";
  const confirmation = await local.personal.policy.confirmation(owner, {
    request_key: randomUUID(),
    concept_key: "workflow.fixture-updates",
    statement,
    summary,
    applies_when,
    exceptions: ["Explain complex failures in more detail."],
  });
  await local.personal.capture(owner, {
    title: "Concise progress with evidence",
    kind: "decision",
    markdown: summary,
    request_key: randomUUID(),
    provenance: {
      paths: [],
      verification: "Synthetic owner-confirmed browser fixture, not a real preference.",
    },
    owner_confirmation_id: confirmation.id,
    knowledge: {
      type: "preference",
      scope: "owner",
      key: "workflow.fixture-updates",
      summary,
      applies_when,
      exceptions: ["Explain complex failures in more detail."],
      topics: ["workflow"],
      basis: "owner_explicit",
      source_statement: statement,
    },
  });
  const home = join(base, "Codex"),
    skills = join(base, "Skills", "review");
  await mkdir(join(home, "sessions"), { recursive: true });
  await mkdir(skills, { recursive: true });
  await writeFile(
    join(skills, "SKILL.md"),
    "---\nname: fixture-review\ndescription: Review a fictional plan with its evidence.\n---\nPreserve originals and read the plan.\n",
  );
  await local.personal.skills.scan(owner, { host_id: "browser-pc", request_key: randomUUID() });
  await writeFile(
    join(home, "sessions", "fixture.jsonl"),
    [
      {
        type: "session_meta",
        payload: { id: "browser-session", cli_version: "0.163.0-alpha.11", source: "vscode" },
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
              { type: "text", text: "Maybe a compact comparison would help this fictional task." },
            ],
          },
        },
      },
      { type: "event_msg", payload: { type: "task_complete", turn_id: "turn" } },
    ]
      .map((e) => JSON.stringify(e))
      .join("\n") + "\n",
  );
  await local.personal.sessions.scan(owner, { host_id: "browser-pc" });
  const claim = await local.personal.sessions.claim(owner, {
    host_id: "browser-pc",
    request_key: randomUUID(),
  });
  const req = { host_id: "browser-pc", review_id: claim.review_id, lease_token: claim.lease_token };
  const page = await local.personal.sessions.page(owner, { ...req, cursor: 0 });
  const ack = await local.personal.sessions.page(owner, {
    ...req,
    cursor: page.next_cursor,
    acknowledge_previous: page.page_digest,
  });
  await local.personal.sessions.complete(owner, {
    ...req,
    expected_revision: ack.revision,
    request_key: randomUUID(),
    outcome: "reviewed_candidates",
    reason_code: "uncertain",
    candidates: [
      {
        concept_key: "workflow.fixture-comparisons",
        title: "Compact comparisons",
        claim: "Compact comparisons may help this fictional owner choose an option.",
        applies_when: "Comparing options in a fictional planning task.",
        basis: "inference",
        rationale: "The source only describes one task; generality is unconfirmed.",
        source_refs: [page.messages[0]!.source_ref],
      },
    ],
  });
}
