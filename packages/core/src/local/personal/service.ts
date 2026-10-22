import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import {
  personalHostsSchema,
  personalCaptureInputSchema,
  personalContextInputSchema,
  personalScanInputSchema,
  localCheckpointInputSchema,
  z,
  type LocalActor,
  type PersonalHost,
} from "@atlas/contracts";
import type { createLocalVault } from "../../local-vault.js";
import { digest, encodeNote, decodeFrontmatter } from "../../local-vault.js";
import type { createDomainService } from "../domain.js";
import { currentAgent } from "../authorization.js";
import { DomainError, sha256, canonical } from "../transactions.js";
import { createPersonalPolicy, ownerOnly, clearInput, suppressedOwnerKeys } from "./policy.js";
import { createSessionAdapter } from "./sessions.js";
import { createCoverage, type CoverageData } from "./coverage.js";
import { createPersonalReview } from "./review.js";
import { selectPersonalContext } from "./context.js";
import { createPersonalSkills } from "./skills.js";
import { createPersonalSnapshot } from "./snapshot.js";

export async function loadPersonalHosts(path: string): Promise<PersonalHost[]> {
  try {
    return personalHostsSchema.parse(JSON.parse(await readFile(path, "utf8"))).hosts;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new DomainError("PERSONAL_HOST_CONFIG_INVALID", 503);
  }
}
export function createPersonalService({
  vault,
  domain,
  hosts = [],
}: {
  vault: ReturnType<typeof createLocalVault>;
  domain: ReturnType<typeof createDomainService>;
  hosts?: PersonalHost[];
}) {
  hosts = personalHostsSchema.parse({ format_version: 1, hosts }).hosts;
  const store = domain.store,
    policy = createPersonalPolicy(store),
    adapter = createSessionAdapter(hosts),
    journal = createCoverage(vault, hosts),
    skills = createPersonalSkills(store, hosts, policy);
  const review = createPersonalReview({ store, policy, adapter, journal, hosts });
  const personalSnapshot = createPersonalSnapshot(vault);
  async function capture(actor: LocalActor, input: unknown) {
    const v = personalCaptureInputSchema.parse(input);
    clearInput(v);
    await policy.assert(actor, "capture_personal_memory");
    if (suppressedOwnerKeys(await store.catalog()).has(v.knowledge!.key))
      throw new DomainError("PERSONAL_SUPPRESSED", 409);
    if (v.origin_project_id) {
      if (
        actor.kind !== "owner" &&
        !currentAgent(await store.catalog(), actor).project_ids.includes(v.origin_project_id)
      )
        throw new DomainError("NOT_FOUND", 404);
      const data = await vault.snapshot();
      if (
        !data.notes.some((n) => n.id === v.origin_project_id && n.kind === "project" && !n.archived)
      )
        throw new DomainError("NOT_FOUND", 404);
    }
    if (v.owner_confirmation_id) {
      if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
      const c = await store.catalog(),
        r = c.heads.get(`settings:${v.owner_confirmation_id}`);
      if (
        r?.data.owner_confirmation !== true ||
        r.actor.kind !== "owner" ||
        r.data.concept_key !== v.knowledge?.key ||
        r.data.statement !== v.knowledge?.source_statement ||
        r.data.summary !== v.knowledge?.summary ||
        r.data.applies_when !== v.knowledge?.applies_when ||
        canonical(r.data.exceptions) !== canonical(v.knowledge?.exceptions)
      )
        throw new DomainError("PERSONAL_CONFIRMATION_INVALID", 400);
    } else
      for (const ref of v.knowledge!.source_refs) {
        if ((await policy.read()).excluded_sessions.includes(ref.session_key))
          throw new DomainError("PERSONAL_SESSION_EXCLUDED", 403);
        await policy.assert(actor, "capture_personal_memory", ref.host_id);
        await adapter.verify(ref);
      }
    const { origin_project_id: origin, owner_confirmation_id: confirmation, ...checkpoint } = v;
    return vault.captureOwner(
      localCheckpointInputSchema.parse(checkpoint),
      actor,
      confirmation,
      origin,
    );
  }
  async function context(actor: LocalActor, input: unknown = {}) {
    const v = personalContextInputSchema.parse(input);
    if (actor.kind !== "owner") await policy.assert(actor, "read_personal_memory");
    if (v.project_id && actor.kind !== "owner") {
      const c = await store.catalog();
      if (!currentAgent(c, actor).project_ids.includes(v.project_id))
        throw new DomainError("NOT_FOUND", 404);
    }
    const c = await store.catalog(),
      snapshot = await personalSnapshot.read();
    if (c.incomplete || snapshot.truncated)
      throw new DomainError("PERSONAL_CONTEXT_INCOMPLETE", 503);
    return selectPersonalContext(
      snapshot.notes,
      v.query && v.include_skills ? (await skills.list(actor, { query: v.query })).skills : [],
      await policy.read(),
      suppressedOwnerKeys(c),
      v,
    );
  }
  async function scan(actor: LocalActor, input: unknown) {
    const requestStarted = performance.now();
    const v = personalScanInputSchema.parse(input);
    await policy.assert(actor, "review_personal_sessions", v.host_id);
    const p = await policy.read(),
      inventory = await adapter.inventory(v.host_id),
      scope = sha256(canonical({ entries: inventory.entries, policy: p, mode: v.mode }));
    if (v.cursor > 0 && v.scope_digest !== scope)
      throw new DomainError("PERSONAL_SCAN_SCOPE_CHANGED", 409);
    if (v.cursor > inventory.entries.length) throw new DomainError("PERSONAL_SCAN_CURSOR", 400);
    if (v.consent) {
      let source: Awaited<ReturnType<typeof adapter.read>> | undefined;
      for (const locator of inventory.entries) {
        try {
          const found = await adapter.read(v.host_id, locator);
          if (found.session_key === v.consent.session_key) {
            source = found;
            break;
          }
        } catch {
          continue;
        }
      }
      if (!source || source.excluded || !source.messages.some((m) => m.turn === v.consent?.turn_id))
        throw new DomainError("PERSONAL_CONSENT_SOURCE_INVALID", 400);
      const consentPath = `.atlas/personal/consent/${v.consent.session_key}-${sha256(v.consent.turn_id)}.json`;
      await vault.writeExclusive(consentPath, canonical(v.consent)).catch((e) => {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      });
    }
    let cursor = v.cursor;
    const started = performance.now(),
      discovered: CoverageData[] = [];
    for (
      ;
      cursor < inventory.entries.length &&
      cursor < v.cursor + 100 &&
      performance.now() - started < 1500;
      cursor++
    ) {
      const locator = inventory.entries[cursor]!;
      let data: CoverageData;
      try {
        const s = await adapter.read(v.host_id, locator);
        const excluded =
          s.excluded ||
          s.subagent ||
          p.excluded_sessions.includes(s.session_key) ||
          Boolean(s.repository_digest && p.excluded_repositories.includes(s.repository_digest));
        data = {
          host_id: v.host_id,
          session_key: s.session_key,
          session_revision: s.revision,
          locator_id: locator,
          outcome: excluded ? "excluded" : "pending",
          reason_code: s.subagent
            ? "subagent_consolidated"
            : excluded
              ? "retention_excluded"
              : s.terminal
                ? "awaiting_review"
                : "active_turn",
          native_consent: s.excluded ? "excluded" : "unknown",
          messages: s.messages.length,
          terminal: s.terminal,
          source_version: s.version,
          source_signature: s.signature,
        };
      } catch (e) {
        if (!(e instanceof DomainError)) throw e;
        data = {
          host_id: v.host_id,
          session_key: sha256(`${v.host_id}:${locator}`),
          session_revision: sha256(`${locator}:${e.code}`),
          locator_id: locator,
          outcome: e.code === "PERSONAL_SOURCE_UNAVAILABLE" ? "source_unavailable" : "unsupported",
          reason_code: e.code,
          native_consent: "unknown",
          messages: 0,
          terminal: false,
          source_version: "unknown",
          source_signature: "unknown",
        };
      }
      discovered.push(data);
    }
    const readFinished = performance.now();
    const events = await journal.discover(actor, v.host_id, discovered);
    const journalFinished = performance.now();
    const outputs = events.map((r) => ({
      session_key: r.data.session_key,
      session_revision: r.data.session_revision,
      outcome: r.data.outcome,
    }));
    const complete = cursor === inventory.entries.length && inventory.complete;
    if (complete) await journal.reconcile(actor, v.host_id, inventory.entries);
    const c = await store.catalog(),
      id = `personal-scan-${v.host_id}`,
      previous = c.heads.get(`settings:${id}`);
    await store.transaction(
      actor,
      `scanstate:${randomUUID()}`,
      { host_id: v.host_id, cursor, scope, complete },
      () => ({
        mutations: [
          {
            kind: "settings",
            entity_id: id,
            expected_revision: previous?.revision ?? 0,
            data: {
              host_id: v.host_id,
              cursor,
              scope_digest: scope,
              complete,
              as_of: new Date().toISOString(),
            },
            body: "Personal scan metadata; no conversation content.",
          },
        ],
        result: { complete },
      }),
    );
    return {
      items: outputs,
      next_cursor: cursor < inventory.entries.length ? cursor : null,
      scope_digest: scope,
      scan_complete: complete,
      identified_files: inventory.entries.length,
      timings_ms: {
        inventory: started - requestStarted,
        read: readFinished - started,
        journal: journalFinished - readFinished,
        state: performance.now() - journalFinished,
      },
    };
  }
  async function coverage(actor: LocalActor, input: unknown = {}) {
    ownerOnly(actor);
    const v = z
        .object({
          host_id: z.string().optional(),
          cursor: z.number().int().nonnegative().default(0),
        })
        .strict()
        .parse(input),
      items = [],
      warnings = [];
    let complete = hosts.length > 0,
      asOf: string | undefined;
    const counts: Record<string, number> = {};
    for (const h of hosts.filter((h) => !v.host_id || h.id === v.host_id)) {
      const c = await store.catalog(),
        state = c.heads.get(`settings:personal-scan-${h.id}`);
      if (!state?.data.complete) complete = false;
      if (typeof state?.data.as_of === "string" && (!asOf || state.data.as_of < asOf))
        asOf = state.data.as_of;
      const journalState = await journal.list(h.id);
      for (const r of journalState.heads.values()) {
        counts[r.data.outcome] = (counts[r.data.outcome] ?? 0) + 1;
        items.push({
          host_id: h.id,
          session_key: r.data.session_key,
          session_revision: r.data.session_revision,
          outcome: r.data.outcome,
          reason_code: r.data.reason_code,
          at: r.at,
          terminal: r.data.terminal,
          native_consent: r.data.native_consent,
          revision: r.revision,
        });
      }
      if (!h.enabled) {
        complete = false;
        warnings.push(`${h.id}: host disabled`);
      }
    }
    const reviewed = items.filter((r) => r.outcome.startsWith("reviewed_")).length,
      eligible = items.filter(
        (r) =>
          r.terminal &&
          !["excluded", "unsupported", "source_unavailable", "superseded"].includes(r.outcome),
      ).length;
    return {
      as_of: asOf ?? new Date().toISOString(),
      scan_complete: complete,
      counts,
      reviewed,
      eligible_terminal_revisions: eligible,
      main_chats: new Set(
        items.filter((r) => r.reason_code !== "subagent_consolidated").map((r) => r.session_key),
      ).size,
      items: items.slice(v.cursor, v.cursor + 100),
      next_cursor: v.cursor + 100 < items.length ? v.cursor + 100 : null,
      warnings,
      scope: "Configured hosts on this PC only; agent-attested review, not semantic proof.",
    };
  }
  async function sessionAction(actor: LocalActor, input: unknown, action: "exclude" | "retry") {
    ownerOnly(actor);
    const v = z
      .object({
        host_id: z.string(),
        session_key: z.string(),
        session_revision: z.string(),
        expected_revision: z.number().int().positive(),
        request_key: z.string().min(16),
      })
      .strict()
      .parse(input);
    const c = await journal.list(v.host_id),
      r = c.heads.get(`${v.session_key}:${v.session_revision}`);
    if (!r) throw new DomainError("NOT_FOUND", 404);
    if (action === "exclude") {
      const { revision, ...p } = await policy.read();
      await policy.update(actor, {
        policy: { ...p, excluded_sessions: [...new Set([...p.excluded_sessions, v.session_key])] },
        expected_revision: revision,
        request_key: `exclude-policy:${sha256(v.request_key)}`,
      });
    }
    return journal.append(
      actor,
      {
        ...r.data,
        outcome: action === "exclude" ? "excluded" : "pending",
        reason_code: action === "exclude" ? "owner_excluded" : "owner_retry",
        lease_expires_at: 0,
        acknowledged: false,
      },
      v.expected_revision,
      v.request_key,
    );
  }
  async function decideCandidate(actor: LocalActor, id: string, input: unknown) {
    ownerOnly(actor);
    const v = z
      .object({
        action: z.enum(["confirm", "dismiss"]),
        expected_revision: z.number().int().positive(),
        request_key: z.string().min(16),
        statement: z.string().min(20).max(600).optional(),
        claim: z.string().min(20).max(400).optional(),
        applies_when: z.string().min(10).max(600).optional(),
        exceptions: z.array(z.string().max(300)).max(6).optional(),
      })
      .strict()
      .parse(input);
    const c = await store.catalog(),
      r = c.heads.get(`personal_candidate:${id}`);
    if (!r) throw new DomainError("NOT_FOUND", 404);
    if (r.revision !== v.expected_revision) throw new DomainError("REVISION_CONFLICT");
    if (v.action === "dismiss") {
      const suppression = c.heads.get(
        `settings:personal-suppression-${sha256(String(r.data.concept_key))}`,
      );
      await policy.suppress(actor, {
        concept_key: r.data.concept_key,
        reason_code: "dismissed",
        expected_revision: suppression?.revision ?? 0,
        request_key: `dismiss:${sha256(v.request_key)}`,
      });
    }
    let noteId: string | null = null;
    if (v.action === "confirm") {
      if (!v.statement || !v.claim || !v.applies_when)
        throw new DomainError("PERSONAL_CONFIRMATION_REQUIRED", 400);
      const confirmation = await policy.confirmation(actor, {
        request_key: `confirmation:${sha256(v.request_key)}`,
        concept_key: r.data.concept_key,
        statement: v.statement,
        summary: v.claim,
        applies_when: v.applies_when,
        exceptions: v.exceptions ?? [],
      });
      const notes = (await vault.snapshot()).notes.filter(
        (n) =>
          n.knowledge?.scope === "owner" &&
          n.knowledge.key === r.data.concept_key &&
          n.effective_state === "active",
      );
      if (notes.length > 1) throw new DomainError("PERSONAL_KNOWLEDGE_CONFLICT", 409);
      const prior = notes[0];
      const saved = await capture(actor, {
        title: String(r.data.title),
        kind: "decision",
        markdown: `${v.claim}\n\nApplies when: ${v.applies_when}`,
        request_key: `pm_${sha256(v.request_key).slice(0, 60)}`,
        provenance: {
          paths: [],
          verification:
            "Owner explicitly confirmed and edited this candidate through the personal review UI.",
        },
        owner_confirmation_id: confirmation.id,
        knowledge: {
          type: "preference",
          scope: "owner",
          key: r.data.concept_key,
          summary: v.claim,
          applies_when: v.applies_when,
          exceptions: v.exceptions ?? [],
          topics: ["workflow"],
          basis: "owner_explicit",
          source_statement: v.statement,
          ...(prior ? { replaces: { id: prior.id, expected_file_digest: prior.file_digest } } : {}),
        },
      });
      noteId = saved.id;
    }
    return store.transaction(actor, v.request_key, { id, ...v }, () => ({
      mutations: [
        {
          kind: "personal_candidate",
          entity_id: id,
          expected_revision: r.revision,
          data: {
            ...r.data,
            status: v.action === "confirm" ? "confirmed" : "dismissed",
            confirmed_note_id: noteId,
          },
          body: r.body,
        },
      ],
      result: { id, note_id: noteId },
    }));
  }
  async function refreshProfile(actor: LocalActor) {
    ownerOnly(actor);
    const packet = await context(actor, { detail: "summary", limit: 20, character_budget: 24000 }),
      body =
        "# Personal working context\n\n" +
        packet.notes.map((n) => `- [[${n.path.replace(/\.md$/, "")}]]`).join("\n");
    return vault.withLock(async () => {
      let prior: string | null = null;
      try {
        prior = (await store.read("Owner/Profile.md")).toString();
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      if (prior) {
        const parsed = decodeFrontmatter(prior);
        if (parsed.metadata.body_digest !== digest(parsed.body.trim()))
          throw new DomainError("PROFILE_INDEX_EDITED", 409);
        if (parsed.body.trim() === body.trim())
          return { path: "Owner/Profile.md", unchanged: true };
        await vault
          .writeExclusive(`.atlas/history/profile-index/${sha256(prior)}.md`, prior)
          .catch((e) => {
            if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
          });
        // Preserve old versions; publish a separate versioned index instead of replacing an owner file.
        const path = `Owner/Profile-${sha256(body).slice(0, 12)}.md`;
        await vault
          .writeExclusive(
            path,
            encodeNote(
              {
                atlas_type: "catalog",
                personal_kind: "profile_index",
                generation_version: 1,
                body_digest: digest(body.trim()),
              },
              body,
            ),
          )
          .catch((e) => {
            if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
          });
        return { path, previous: "Owner/Profile.md" };
      }
      await vault.writeExclusive(
        "Owner/Profile.md",
        encodeNote(
          {
            atlas_type: "catalog",
            personal_kind: "profile_index",
            generation_version: 1,
            body_digest: digest(body.trim()),
          },
          body,
        ),
      );
      return { path: "Owner/Profile.md" };
    });
  }
  async function erasurePreview(actor: LocalActor, input: unknown) {
    ownerOnly(actor);
    const v = z
        .object({ subject_id: z.string().min(1) })
        .strict()
        .parse(input),
      s = await vault.snapshot(),
      n = s.notes.find((n) => n.id === v.subject_id);
    if (!n?.knowledge) throw new DomainError("NOT_FOUND", 404);
    const lineage = s.notes.filter(
        (x) => x.knowledge?.key === n.knowledge!.key && x.knowledge?.scope === n.knowledge!.scope,
      ),
      paths = lineage.map((x) => x.path);
    for (const item of lineage) {
      const folder = `.atlas/history/${digest(item.id).slice(0, 32)}`;
      try {
        for (const file of await readdir(await vault.safeExistingPath(folder)))
          paths.push(`${folder}/${file}`);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
    const ids = new Set(lineage.map((item) => item.id));
    try {
      for (const file of (await readdir(await vault.safeExistingPath(".atlas/requests"))).slice(
        0,
        10000,
      )) {
        if (!file.endsWith(".json")) continue;
        const path = `.atlas/requests/${file}`,
          bytes = await store.read(path);
        if (bytes.length <= 32768 && ids.has(String(JSON.parse(bytes.toString()).note_id)))
          paths.push(path);
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    return {
      subject_ids: lineage.map((n) => n.id),
      known_paths: paths,
      deleted: false,
      warnings: [
        "External backups, generated native memories and inaccessible copies are not exhaustively known. This preview performs no erasure.",
      ],
    };
  }
  async function stopUsing(actor: LocalActor, id: string, input: unknown) {
    ownerOnly(actor);
    const v = z
      .object({
        expected_revision: z.number().int().nonnegative(),
        request_key: z.string().min(16),
      })
      .strict()
      .parse(input);
    const note = (await vault.snapshot()).notes.find(
      (n) => n.id === id && n.knowledge?.scope === "owner",
    );
    if (!note?.knowledge) throw new DomainError("NOT_FOUND", 404);
    return policy.suppress(actor, {
      ...v,
      concept_key: note.knowledge.key,
      reason_code: "stop_using",
    });
  }
  return {
    policy,
    context,
    capture,
    candidates: { list: review.candidates, propose: review.propose, decide: decideCandidate },
    sessions: {
      scan,
      claim: review.claim,
      page: review.page,
      complete: review.complete,
      coverage,
      action: sessionAction,
      adapter,
      journal,
    },
    skills,
    profile: { refresh: refreshProfile, erasurePreview, stopUsing },
    close() {
      personalSnapshot.close();
    },
  };
}
