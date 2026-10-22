import { randomBytes, randomUUID } from "node:crypto";
import {
  personalNextInputSchema,
  personalPageInputSchema,
  personalCompleteInputSchema,
  personalCandidateInputSchema,
  type LocalActor,
  type PersonalHost,
  type PersonalSourceRef,
} from "@atlas/contracts";
import { canonical, sha256, DomainError, type LocalStore } from "../transactions.js";
import type { createPersonalPolicy } from "./policy.js";
import { clearInput, ownerOnly, personalSecret, suppressedOwnerKeys } from "./policy.js";
import type { createCoverage, CoverageEvent } from "./coverage.js";
import type { createSessionAdapter } from "./sessions.js";
type Dependencies = {
  store: LocalStore;
  policy: ReturnType<typeof createPersonalPolicy>;
  journal: ReturnType<typeof createCoverage>;
  adapter: ReturnType<typeof createSessionAdapter>;
  hosts: PersonalHost[];
};
export function createPersonalReview({ store, policy, journal, adapter }: Dependencies) {
  async function candidates(actor: LocalActor) {
    ownerOnly(actor);
    return [...(await store.catalog()).heads.values()].filter(
      (r) => r.kind === "personal_candidate",
    );
  }
  async function propose(actor: LocalActor, input: unknown, requestKey: string) {
    const v = personalCandidateInputSchema.parse(input);
    clearInput(v);
    if (!(await policy.read()).candidates_enabled)
      throw new DomainError("PERSONAL_CANDIDATES_DISABLED", 403);
    for (const ref of v.source_refs) {
      await policy.assert(actor, "review_personal_sessions", ref.host_id);
      await adapter.verify(ref);
    }
    const c = await store.catalog();
    if (suppressedOwnerKeys(c).has(v.concept_key))
      throw new DomainError("PERSONAL_SUPPRESSED", 409);
    const prior = [...c.heads.values()].find(
      (r) => r.kind === "personal_candidate" && r.data.concept_key === v.concept_key,
    );
    if (prior?.data.status === "dismissed") throw new DomainError("PERSONAL_SUPPRESSED", 409);
    const id = prior?.entity_id ?? randomUUID();
    return store.transaction(actor, requestKey, v, () => ({
      mutations: [
        {
          kind: "personal_candidate",
          entity_id: id,
          expected_revision: prior?.revision ?? 0,
          data: { ...v, id, status: "proposed" },
          body: `# ${v.title}\n\n${v.claim}\n\nApplicability: ${v.applies_when}\n\nUnconfirmed; excluded from personal context.`,
        },
      ],
      result: { id },
    }));
  }
  async function claim(actor: LocalActor, input: unknown) {
    const v = personalNextInputSchema.parse(input);
    await policy.assert(actor, "review_personal_sessions", v.host_id);
    const c = await journal.list(v.host_id),
      now = Date.now();
    if (c.records.some((r) => r.actor_id === actor.id && r.request_key === v.request_key))
      throw new DomainError("PERSONAL_CLAIM_ALREADY_ISSUED", 409);
    const item = [...c.heads.values()]
      .filter(
        (r) =>
          ["pending", "failed", "reviewing"].includes(r.data.outcome) &&
          r.data.terminal &&
          (!r.data.lease_expires_at || r.data.lease_expires_at < now),
      )
      .sort((a, b) => a.at.localeCompare(b.at))[0];
    if (!item) return { review: null };
    const token = randomBytes(32).toString("base64url");
    const saved = await journal.append(
      actor,
      {
        ...item.data,
        outcome: "reviewing",
        lease_digest: sha256(token),
        lease_actor: actor.id,
        lease_started_at: now,
        lease_expires_at: now + 900000,
        read_cursor: 0,
        delivered_cursor: 0,
        acknowledged: false,
      },
      item.revision,
      v.request_key,
    );
    return {
      review_id: saved.data.session_revision,
      session_key: saved.data.session_key,
      lease_token: token,
      revision: saved.revision,
      expires_at: saved.data.lease_expires_at,
    };
  }
  async function leased(actor: LocalActor, hostId: string, reviewId: string, token: string) {
    await policy.assert(actor, "review_personal_sessions", hostId);
    const c = await journal.list(hostId),
      r = [...c.heads.values()].find(
        (x) =>
          x.data.session_revision === reviewId &&
          x.data.lease_actor === actor.id &&
          x.data.outcome === "reviewing" &&
          x.data.lease_digest === sha256(token),
      );
    if (!r || !r.data.lease_expires_at || r.data.lease_expires_at < Date.now())
      throw new DomainError("PERSONAL_LEASE_STALE", 409);
    const s = await adapter.read(hostId, r.data.locator_id);
    if (
      (await policy.read()).excluded_sessions.includes(s.session_key) ||
      s.revision !== r.data.session_revision ||
      s.excluded ||
      s.subagent
    )
      throw new DomainError("PERSONAL_SOURCE_CHANGED", 409);
    return { r, s };
  }
  async function page(actor: LocalActor, input: unknown) {
    const v = personalPageInputSchema.parse(input),
      { r, s } = await leased(actor, v.host_id, v.review_id, v.lease_token);
    let cursor = r.data.read_cursor ?? 0;
    if (v.acknowledge_previous) {
      if (v.acknowledge_previous !== r.data.delivered_digest)
        throw new DomainError("PERSONAL_PAGE_ACK_INVALID", 409);
      cursor = r.data.delivered_cursor ?? cursor;
    }
    if (v.cursor !== cursor) throw new DomainError("PERSONAL_PAGE_CURSOR", 409);
    // Cursor is a codepoint offset across normalized human messages, making long messages resumable.
    let offset = 0,
      next = cursor;
    const messages: { text: string; source_ref: PersonalSourceRef }[] = [];
    let used = 0,
      redacted = 0;
    for (const m of s.messages) {
      const points = Array.from(m.text),
        end = offset + points.length;
      if (end <= cursor) {
        offset = end;
        continue;
      }
      const start = Math.max(0, cursor - offset);
      if (personalSecret.test(m.text)) {
        redacted++;
        next = end;
        offset = end;
        continue;
      }
      const take = Math.min(points.length - start, Math.max(0, Math.floor((12000 - used) / 2)));
      if (!take || messages.length >= 20) break;
      const text = points.slice(start, start + take).join("");
      messages.push({
        text,
        source_ref: {
          host_id: v.host_id,
          session_key: s.session_key,
          session_revision: s.revision,
          message_id: m.id,
          turn_id: m.turn,
          start_codepoint: start,
          end_codepoint: start + take,
          quote_sha256: sha256(text),
        },
      });
      used += text.length;
      next = offset + start + take;
      offset = end;
      if (next < end) break;
    }
    const total = s.messages.reduce((n, m) => n + Array.from(m.text).length, 0),
      digest = sha256(canonical({ cursor, next, messages: messages.map((m) => m.source_ref) }));
    const finalAcknowledged = Boolean(v.acknowledge_previous) && cursor === total;
    const data = {
      ...r.data,
      read_cursor: cursor,
      delivered_cursor: next,
      delivered_digest: digest,
      acknowledged: finalAcknowledged,
    };
    if (v.renew)
      data.lease_expires_at = Math.min(Date.now() + 900000, (data.lease_started_at ?? 0) + 3600000);
    const saved = await journal.append(
      actor,
      data,
      r.revision,
      `page:${sha256(`${r.entity_key}:${r.revision}:${canonical(v)}`)}`,
    );
    return {
      messages,
      cursor,
      next_cursor: next,
      page_digest: digest,
      has_more: next < total,
      acknowledged: finalAcknowledged,
      revision: saved.revision,
      redacted_segments: redacted,
    };
  }
  async function complete(actor: LocalActor, input: unknown) {
    const v = personalCompleteInputSchema.parse(input);
    await policy.assert(actor, "review_personal_sessions", v.host_id);
    const c = await journal.list(v.host_id),
      prior = c.records.find((r) => r.actor_id === actor.id && r.request_key === v.request_key);
    if (prior) {
      if (
        prior.data.session_revision !== v.review_id ||
        prior.data.completion_payload !== sha256(canonical(v))
      )
        throw new DomainError("REQUEST_CONFLICT");
      return { outcome: prior.data.outcome, revision: prior.revision };
    }
    const { r } = await leased(actor, v.host_id, v.review_id, v.lease_token);
    if (r.revision !== v.expected_revision) throw new DomainError("REVISION_CONFLICT");
    if (v.outcome !== "failed" && !r.data.acknowledged)
      throw new DomainError("PERSONAL_REVIEW_INCOMPLETE", 409);
    const snapshot = await store.vault.snapshot(),
      ids = [...v.candidate_ids];
    for (const ref of v.note_refs) {
      const n = snapshot.notes.find(
        (n) =>
          n.id === ref.id &&
          n.file_digest === ref.file_digest &&
          n.effective_state === "active" &&
          n.knowledge?.scope === "owner",
      );
      if (!n) throw new DomainError("PERSONAL_RESULT_INVALID", 400);
      if (
        v.outcome === "reviewed_saved" &&
        !n.knowledge?.source_refs.some(
          (s) => s.session_revision === v.review_id && s.session_key === r.data.session_key,
        )
      )
        throw new DomainError("PERSONAL_RESULT_INVALID", 400);
      for (const source of n.knowledge?.source_refs ?? []) await adapter.verify(source);
      if (suppressedOwnerKeys(await store.catalog()).has(n.knowledge!.key))
        throw new DomainError("PERSONAL_SUPPRESSED", 409);
    }
    for (const [i, candidate] of v.candidates.entries()) {
      const proposed = await propose(
        actor,
        candidate,
        `candidate:${sha256(`${v.request_key}:${i}`)}`,
      );
      ids.push(proposed.id);
    }
    const catalog = await store.catalog();
    for (const id of ids) {
      const item = catalog.heads.get(`personal_candidate:${id}`);
      if (
        !item ||
        item.data.status !== "proposed" ||
        !personalCandidateInputSchema.shape.source_refs
          .parse(item.data.source_refs)
          .some(
            (source) =>
              source.session_revision === v.review_id && source.session_key === r.data.session_key,
          )
      )
        throw new DomainError("PERSONAL_RESULT_INVALID", 400);
    }
    if (
      ((v.outcome === "reviewed_saved" || v.outcome === "reviewed_no_change") &&
        !v.note_refs.length) ||
      (v.outcome === "reviewed_candidates" && !ids.length) ||
      (v.outcome === "reviewed_no_value" && (ids.length || v.note_refs.length))
    )
      throw new DomainError("PERSONAL_OUTCOME_INVALID", 400);
    const data = {
      ...r.data,
      outcome: v.outcome,
      reason_code: v.reason_code,
      note_refs: v.note_refs,
      candidate_ids: ids,
      completion_payload: sha256(canonical(v)),
    };
    const saved = await journal.append(actor, data, r.revision, v.request_key);
    return { outcome: saved.data.outcome, revision: saved.revision };
  }
  return { candidates, propose, claim, page, complete };
}
