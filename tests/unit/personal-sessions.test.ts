import { mkdtemp, mkdir, writeFile, readFile, rm, appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { createLocalServices } from "../../apps/api/src/local-vault.js";
import { encodeNote, digest } from "@atlas/core/local-vault";
import { sha256 } from "@atlas/core/local-domain";
import { selectPersonalContext } from "../../packages/core/src/local/personal/context.js";
import { personalPolicySchema, personalExportSchema, type LocalNote } from "@atlas/contracts";
const owner = { kind: "owner" as const, id: "owner" };
function events(text: string, id: string, version = "0.163.0-alpha.11") {
  return (
    [
      { type: "session_meta", payload: { id, cli_version: version, source: "vscode" } },
      {
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "# AGENTS.md injected guidance" }],
        },
      },
      {
        type: "event_msg",
        payload: {
          type: "item_completed",
          turn_id: "turn",
          item: { type: "UserMessage", id: "message", content: [{ type: "text", text }] },
        },
      },
      { type: "event_msg", payload: { type: "task_complete", turn_id: "turn" } },
    ]
      .map((x) => JSON.stringify(x))
      .join("\n") + "\n"
  );
}
it("rejects changed sources and forged evidence, redacts secrets and pages long Unicode messages", async () => {
  const base = await mkdtemp(join(tmpdir(), "atlas-sessions-")),
    home = join(base, "Codex"),
    path = join(home, "sessions", "source.jsonl");
  await mkdir(join(home, "sessions"), { recursive: true });
  const local = createLocalServices(join(base, "Vault"), {
    agentId: "fixture",
    personalHosts: [
      {
        id: "source-pc",
        kind: "codex-local-jsonl",
        enabled: true,
        codex_home: home,
        skill_roots: [],
      },
    ],
  });
  try {
    await local.personal.policy.update(owner, {
      policy: { enabled: true, enabled_hosts: ["source-pc"] },
      expected_revision: 0,
      request_key: randomUUID(),
    });
    await writeFile(
      path,
      events("A useful conditional preference " + "𐐀".repeat(15000), "session"),
    );
    await local.personal.sessions.scan(owner, { host_id: "source-pc" });
    const claim = await local.personal.sessions.claim(owner, {
      host_id: "source-pc",
      request_key: randomUUID(),
    });
    const req = {
      host_id: "source-pc",
      review_id: claim.review_id,
      lease_token: claim.lease_token,
    };
    let cursor = 0,
      ack: string | undefined,
      total = 0,
      revision = 0;
    let acknowledged = false;
    do {
      const page = await local.personal.sessions.page(owner, {
        ...req,
        cursor,
        ...(ack ? { acknowledge_previous: ack } : {}),
      });
      expect(JSON.stringify(page).length).toBeLessThanOrEqual(24000);
      total += page.messages.reduce((n, m) => n + Array.from(m.text).length, 0);
      cursor = page.next_cursor;
      ack = page.page_digest;
      revision = page.revision;
      acknowledged = page.acknowledged;
    } while (!acknowledged);
    expect(total).toBe(Array.from("A useful conditional preference " + "𐐀".repeat(15000)).length);
    await writeFile(path, events("A different owner message invalidates the claim.", "session"));
    await expect(
      local.personal.sessions.complete(owner, {
        ...req,
        expected_revision: revision,
        request_key: randomUUID(),
        outcome: "reviewed_no_value",
        reason_code: "no_reusable_subject",
      }),
    ).rejects.toThrow("PERSONAL_SOURCE_CHANGED");
    await writeFile(path, events("password=abcdefghijklmnopqrstuvwx", "secret"));
    await local.personal.sessions.scan(owner, { host_id: "source-pc" });
    const inventory = await local.personal.sessions.adapter.inventory("source-pc"),
      read = await local.personal.sessions.adapter.read("source-pc", inventory.entries[0]!);
    await expect(
      local.personal.sessions.adapter.verify({
        host_id: "source-pc",
        session_key: read.session_key,
        session_revision: read.revision,
        message_id: "message",
        turn_id: "turn",
        start_codepoint: 0,
        end_codepoint: 5,
        quote_sha256: sha256("passw"),
      }),
    ).rejects.toThrow();
    const journal = JSON.stringify([
      ...(await local.personal.sessions.journal.list("source-pc")).heads.values(),
    ]);
    expect(journal).not.toContain("abcdefghijklmnopqrstuvwx");
  } finally {
    local.domain.close();
    await rm(base, { recursive: true, force: true });
  }
});
it("does not treat assistant/tool appends as new owner revisions; unknown exports fail closed", async () => {
  const base = await mkdtemp(join(tmpdir(), "atlas-adapter-")),
    home = join(base, "Codex");
  await mkdir(join(home, "sessions"), { recursive: true });
  const path = join(home, "sessions", "native.jsonl");
  await writeFile(path, events("Prefer a concise report when discussing routine work.", "one"));
  const local = createLocalServices(join(base, "Vault"), {
    agentId: "fixture",
    personalHosts: [
      {
        id: "native-pc",
        kind: "codex-local-jsonl",
        enabled: true,
        codex_home: home,
        skill_roots: [],
      },
    ],
  });
  try {
    const inv = await local.personal.sessions.adapter.inventory("native-pc"),
      first = await local.personal.sessions.adapter.read("native-pc", inv.entries[0]!);
    await appendFile(
      path,
      JSON.stringify({
        type: "response_item",
        payload: { type: "function_call", name: "atlas_personal_context", arguments: "{}" },
      }) + "\n",
    );
    const second = await local.personal.sessions.adapter.read("native-pc", inv.entries[0]!);
    expect(second.revision).toBe(first.revision);
    await appendFile(path, '{"partial":');
    expect(
      (await local.personal.sessions.adapter.read("native-pc", inv.entries[0]!)).revision,
    ).toBe(first.revision);
  } finally {
    local.domain.close();
    await rm(base, { recursive: true, force: true });
  }
});
it("retrieves current subjects or abstains on fifteen held-out queries without injecting project facts", async () => {
  const { decodeNote } = await import("@atlas/core/local-vault");
  const notes: LocalNote[] = [];
  for (let i = 0; i < 12; i++) {
    const word = `unique${String.fromCharCode(97 + i)}topic`,
      body = `Use ${word} for its stated condition.`;
    notes.push(
      decodeNote(
        encodeNote(
          {
            atlas_schema: 2,
            atlas_id: randomUUID(),
            atlas_type: "decision",
            title: word,
            knowledge_type: "preference",
            knowledge_scope: "owner",
            knowledge_key: `workflow.${word}`,
            knowledge_summary: body,
            knowledge_applies_when: `Working with the ${word} topic.`,
            knowledge_exceptions: ["Only when applicable."],
            knowledge_topics: [word],
            knowledge_basis: "owner_explicit",
            knowledge_source_statement: "Synthetic owner statement.",
            knowledge_state: "active",
            knowledge_source_note_ids: [],
            supersedes: [],
            body_digest: digest(body),
          },
          body,
        ),
        `Owner/Knowledge/${word}.md`,
      ),
    );
  }
  const inputs = [
    ...Array.from({ length: 12 }, (_, i) => `unique${String.fromCharCode(97 + i)}topic`),
    "absent subject",
    "unrelated domain",
    "unknown preference",
  ];
  for (const [i, query] of inputs.entries()) {
    const packet = selectPersonalContext(
      notes.map((n) => ({ ...n, effective_state: "active" as const })),
      [],
      personalPolicySchema.parse({ baseline_keys: [] }),
      new Set(),
      { query },
    );
    expect(packet.project_notes).toEqual([]);
    expect(packet.notes).toHaveLength(i < 12 ? 1 : 0);
    if (i < 12) expect(packet.notes[0]?.title).toBe(query);
  }
});
it("reads an explicitly selected export and rejects duplicate, assistant-role or wrong-host input", async () => {
  const base = await mkdtemp(join(tmpdir(), "atlas-personal-export-")),
    path = join(base, "selected.json");
  const message = {
    message_id: "message",
    turn_id: "turn",
    timestamp: new Date().toISOString(),
    text: "A synthetic owner preference for a selected export.",
    terminal_state: "completed",
  };
  const input = {
    format: "atlas-personal-session-export-v1",
    host_id: "export-pc",
    exported_at: new Date().toISOString(),
    sessions: [
      {
        native_session_id: "export-session",
        source_version: "owner-selected-v1",
        role: "main",
        messages: [message],
      },
    ],
  };
  const local = createLocalServices(join(base, "Vault"), {
    agentId: "fixture",
    personalHosts: [
      {
        id: "export-pc",
        kind: "selected-export",
        enabled: true,
        codex_home: base,
        export_path: path,
        skill_roots: [],
      },
    ],
  });
  try {
    await writeFile(path, JSON.stringify(input));
    const inv = await local.personal.sessions.adapter.inventory("export-pc");
    expect(
      (await local.personal.sessions.adapter.read("export-pc", inv.entries[0]!)).messages[0]?.text,
    ).toBe(message.text);
    expect(() =>
      personalExportSchema.parse({
        ...input,
        sessions: [{ ...input.sessions[0], messages: [message, message] }],
      }),
    ).toThrow();
    expect(() =>
      personalExportSchema.parse({
        ...input,
        sessions: [{ ...input.sessions[0], role: "assistant" }],
      }),
    ).toThrow();
    await writeFile(path, JSON.stringify({ ...input, host_id: "different-pc" }));
    await expect(
      local.personal.sessions.adapter.read("export-pc", inv.entries[0]!),
    ).rejects.toThrow("PERSONAL_FORMAT_UNSUPPORTED");
  } finally {
    local.domain.close();
    await rm(base, { recursive: true, force: true });
  }
});
