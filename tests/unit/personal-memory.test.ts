import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, randomBytes } from "node:crypto";
import { beforeEach, afterEach, expect, it } from "vitest";
import { createLocalServices } from "../../apps/api/src/local-vault.js";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { sha256, canonical } from "@atlas/core/local-domain";
import {
  personalContextPacketSchema,
  personalCaptureInputSchema,
  type LocalActor,
} from "@atlas/contracts";

let base: string, home: string, root: string, local: ReturnType<typeof createLocalServices>;
const owner: LocalActor = { kind: "owner", id: "fixture-owner" },
  key = () => randomUUID();
async function session(
  text = "I prefer a proposed plan before substantial changes.",
  id = "session-a",
) {
  const events = [
    { type: "session_meta", payload: { id, cli_version: "0.163.0-alpha.11", source: "vscode" } },
    {
      type: "event_msg",
      payload: {
        type: "item_completed",
        turn_id: "turn-a",
        item: { type: "UserMessage", id: "message-a", content: [{ type: "text", text }] },
      },
    },
    { type: "event_msg", payload: { type: "task_complete", turn_id: "turn-a" } },
  ];
  const path = join(home, "sessions", `${id}.jsonl`);
  await writeFile(path, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  return path;
}
async function enable() {
  await local.personal.policy.update(owner, {
    policy: { enabled: true, enabled_hosts: ["fixture-pc"] },
    expected_revision: 0,
    request_key: key(),
  });
}
async function pageAndAck() {
  await local.personal.sessions.scan(owner, { host_id: "fixture-pc" });
  const claim = await local.personal.sessions.claim(owner, {
    host_id: "fixture-pc",
    request_key: key(),
  });
  if (!claim.review_id || !claim.lease_token) throw Error("No claim");
  const req = { host_id: "fixture-pc", review_id: claim.review_id, lease_token: claim.lease_token };
  const page = await local.personal.sessions.page(owner, { ...req, cursor: 0 });
  const ack = await local.personal.sessions.page(owner, {
    ...req,
    cursor: page.next_cursor,
    acknowledge_previous: page.page_digest,
  });
  return { req, page, ack };
}
beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "atlas-personal-"));
  home = join(base, "Codex");
  root = join(base, "Vault");
  await mkdir(join(home, "sessions"), { recursive: true });
  local = createLocalServices(root, {
    agentId: "fixture-installed",
    token: `atlas_${randomBytes(32).toString("base64url")}`,
    personalHosts: [
      {
        id: "fixture-pc",
        kind: "codex-local-jsonl",
        enabled: true,
        codex_home: home,
        skill_roots: [join(base, "Skills")],
      },
    ],
  });
});
afterEach(async () => {
  local.domain.close();
  local.personal.close();
  if (
    !resolve(base).startsWith(resolve(tmpdir()) + "\\atlas-personal-") &&
    !resolve(base).startsWith(resolve(tmpdir()) + "/atlas-personal-")
  )
    throw Error("unsafe cleanup");
  await rm(base, { recursive: true, force: true });
});
it("defaults off and preserves the existing projectless vault", async () => {
  await expect(local.personal.sessions.scan(owner, { host_id: "fixture-pc" })).rejects.toThrow(
    "PERSONAL_DISABLED",
  );
  const ctx = await local.personal.context(owner, {});
  expect(ctx.notes).toEqual([]);
  expect(personalContextPacketSchema.parse(ctx).scope).toBe("owner");
  expect((await vaultFiles()).filter((p) => p.endsWith("Project.md"))).toEqual([]);
});
async function vaultFiles() {
  const out: string[] = [];
  async function walk(dir: string) {
    let es: import("node:fs").Dirent[];
    try {
      es = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of es) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else out.push(p);
    }
  }
  await walk(root);
  return out;
}
it("requires exact evidence, records a valid zero-save review and rejects changed replay", async () => {
  await enable();
  await session();
  const { req, page, ack } = await pageAndAck();
  expect(page.messages).toHaveLength(1);
  expect(ack.acknowledged).toBe(true);
  const input = {
    ...req,
    expected_revision: ack.revision,
    request_key: key(),
    outcome: "reviewed_no_value",
    reason_code: "no_reusable_subject",
  };
  await local.personal.sessions.complete(owner, input);
  expect((await local.personal.sessions.coverage(owner)).counts.reviewed_no_value).toBe(1);
  await local.personal.sessions.complete(owner, input);
  await expect(
    local.personal.sessions.complete(owner, { ...input, outcome: "reviewed_saved" }),
  ).rejects.toThrow("REQUEST_CONFLICT");
  expect((await local.personal.context(owner, {})).notes).toHaveLength(0);
});
it("does not complete before final acknowledgment and rejects partial or forged saves", async () => {
  await enable();
  await session();
  await local.personal.sessions.scan(owner, { host_id: "fixture-pc" });
  const req = await local.personal.sessions.claim(owner, {
    host_id: "fixture-pc",
    request_key: key(),
  });
  await expect(
    local.personal.sessions.complete(owner, {
      host_id: "fixture-pc",
      review_id: req.review_id,
      lease_token: req.lease_token,
      expected_revision: req.revision,
      request_key: key(),
      outcome: "reviewed_no_value",
      reason_code: "no_reusable_subject",
    }),
  ).rejects.toThrow("PERSONAL_REVIEW_INCOMPLETE");
});
it("captures an explicit owner preference with no project, uses actual actor and preserves corrections", async () => {
  await enable();
  await session();
  const { page, req, ack } = await pageAndAck();
  const ref = page.messages[0]!.source_ref;
  const input = {
    title: "Plan before changes",
    kind: "decision",
    markdown:
      "The owner prefers a proposed plan before substantial changes, when initiating substantial work.",
    request_key: key(),
    provenance: { paths: [], verification: "Read the original owner input." },
    knowledge: {
      type: "preference",
      scope: "owner",
      key: "workflow.plan-first",
      summary: "The owner prefers a proposed plan before substantial changes.",
      applies_when: "Initiating substantial work for this owner.",
      topics: ["workflow"],
      basis: "owner_explicit",
      source_statement: "I prefer a proposed plan before substantial changes.",
      source_refs: [ref],
    },
  };
  const saved = await local.personal.capture(owner, input);
  expect(saved.agent_id).toBeNull();
  expect(saved.project_id).toBeNull();
  const retry = await local.personal.capture(owner, input);
  expect(retry.id).toBe(saved.id);
  const old = await readFile(join(root, saved.path), "utf8");
  await local.personal.sessions.complete(owner, {
    ...req,
    expected_revision: ack.revision,
    request_key: key(),
    outcome: "reviewed_saved",
    reason_code: "useful",
    note_refs: [{ id: saved.id, file_digest: saved.file_digest }],
  });
  const before = await local.personal.context(owner, {});
  expect(before.notes.map((n) => n.id)).toContain(saved.id);
  await local.personal.policy.suppress(owner, {
    concept_key: "workflow.plan-first",
    reason_code: "stop_using",
    expected_revision: 0,
    request_key: key(),
  });
  expect((await local.personal.context(owner, {})).notes).toEqual([]);
  expect(await readFile(join(root, saved.path), "utf8")).toBe(old);
  expect((await vaultFiles()).filter((p) => p.endsWith("Project.md"))).toEqual([]);
  await expect(
    local.personal.capture(owner, {
      ...input,
      request_key: key(),
      knowledge: { ...input.knowledge, source_refs: [{ ...ref, quote_sha256: "a".repeat(64) }] },
    }),
  ).rejects.toThrow();
});
it("excludes private instructions and subagents and preserves unknown formats as unsupported", async () => {
  await enable();
  await session("Do not save this conversation.");
  await writeFile(
    join(home, "sessions", "sub.jsonl"),
    JSON.stringify({
      type: "session_meta",
      payload: { id: "sub", cli_version: "x", source: { subagent: { other: "test" } } },
    }) + "\n",
  );
  await writeFile(join(home, "sessions", "unknown.jsonl"), '{"unknown":true}\n');
  await local.personal.sessions.scan(owner, { host_id: "fixture-pc" });
  const state = await local.personal.sessions.coverage(owner);
  expect(state.counts.excluded).toBe(2);
  expect(state.counts.unsupported).toBe(1);
  expect(
    await local.personal.sessions.claim(owner, { host_id: "fixture-pc", request_key: key() }),
  ).toEqual({ review: null });
});
it("keeps new owner context APIs denied to capture-only tokens and cookies required for owner routes", async () => {
  const token = `atlas_${randomBytes(32).toString("base64url")}`,
    other = createLocalServices(join(base, "Other"), { agentId: "old-agent", token });
  try {
    const app = createApp(
      loadConfig({ NODE_ENV: "test", API_PORT: "4323" }),
      undefined,
      undefined,
      other,
    );
    const response = await app.request("http://localhost:4323/api/v1/agent/personal/context", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(403);
    const denied = await app.request("http://localhost:4323/api/v1/local/personal/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(denied.status).toBe(401);
  } finally {
    other.domain.close();
  }
});
it("bounds the entire context envelope and keeps exact source references through Markdown", async () => {
  await enable();
  await session("I prefer accessible controls with keyboard support.");
  const { page } = await pageAndAck(),
    ref = page.messages[0]!.source_ref;
  expect(() => personalCaptureInputSchema.parse({ knowledge: { basis: "inference" } })).toThrow();
  const packet = await local.personal.context(owner, { character_budget: 2000 });
  expect(JSON.stringify(packet).length).toBeLessThanOrEqual(2000);
  expect(sha256(Array.from(page.messages[0]!.text).join(""))).toBe(ref.quote_sha256);
  expect(canonical(packet)).toContain("owner");
});
it("retires an unfinished revision after an owner append, preserves its exact historical reference and marks missing sources", async () => {
  await enable();
  const path = await session();
  const { page } = await pageAndAck();
  const oldRef = page.messages[0]!.source_ref;
  await appendFile(
    path,
    [
      {
        type: "event_msg",
        payload: {
          type: "item_completed",
          turn_id: "turn-b",
          item: {
            type: "UserMessage",
            id: "message-b",
            content: [
              { type: "text", text: "Another synthetic task with no reusable preference." },
            ],
          },
        },
      },
      { type: "event_msg", payload: { type: "task_complete", turn_id: "turn-b" } },
    ]
      .map((e) => JSON.stringify(e))
      .join("\n") + "\n",
  );
  expect((await local.personal.sessions.adapter.verify(oldRef)).quote).toBe(page.messages[0]!.text);
  await local.personal.sessions.scan(owner, { host_id: "fixture-pc" });
  let coverage = await local.personal.sessions.coverage(owner);
  expect(coverage.counts.superseded).toBe(1);
  expect(coverage.counts.pending).toBe(1);
  await rm(path);
  await local.personal.sessions.scan(owner, { host_id: "fixture-pc" });
  coverage = await local.personal.sessions.coverage(owner);
  expect(coverage.counts.source_unavailable).toBe(1);
});
it("invalidates a warm personal snapshot after direct Markdown edits", async () => {
  await enable();
  const statement = "I prefer concise progress updates for routine work.";
  const summary = "Use concise progress updates for routine work.";
  const applies_when = "Reporting routine implementation progress.";
  const confirmation = await local.personal.policy.confirmation(owner, {
    concept_key: "workflow.warm-edit",
    statement,
    summary,
    applies_when,
    exceptions: [],
    request_key: key(),
  });
  const note = await local.personal.capture(owner, {
    title: "Warm snapshot",
    kind: "decision",
    markdown: summary,
    request_key: key(),
    owner_confirmation_id: confirmation.id,
    provenance: { paths: [], verification: "Synthetic confirmation fixture." },
    knowledge: {
      type: "preference",
      scope: "owner",
      key: "workflow.warm-edit",
      summary,
      applies_when,
      topics: ["workflow"],
      basis: "owner_explicit",
      source_statement: statement,
    },
  });
  await local.personal.context(owner, {});
  await local.personal.context(owner, {});
  const raw = await readFile(join(root, note.path), "utf8");
  await writeFile(
    join(root, note.path),
    raw.replace(
      /Use concise progress updates for routine work\.\s*$/,
      "Current owner edit preserves this conditional exception.",
    ),
  );
  const current = await local.personal.context(owner, {});
  expect(current.notes[0]?.modified_since_capture).toBe(true);
  expect(current.notes[0]?.markdown).toContain("Current owner edit");
});
