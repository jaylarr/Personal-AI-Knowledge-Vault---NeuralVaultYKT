import { randomBytes, randomUUID } from "node:crypto";
import {
  z,
  localOrganizationSchema,
  localGrantSchema,
  localTaskSchema,
  localProposalSchema,
  localMemorySchema,
  localRelationshipSchema,
  localEntitySchema,
  localEvidenceSchema,
  localSourceSchema,
  type LocalActor,
  type LocalTask,
  type LocalMemory,
  type LocalEvidence,
  type LocalDomainRecord,
} from "@atlas/contracts";
import {
  DomainError,
  head,
  sha256,
  canonical,
  expectRevision,
  type LocalStore,
  type Catalog,
  type Mutation,
} from "./transactions.js";
import { currentAgent, assertRead, assertEvidenceRead, canReadRecord } from "./authorization.js";
import {
  sourceData,
  sourceAudience,
  versionData,
  sourceMutation,
  chunkText,
  validateEvidence,
  codePoints,
} from "./sources.js";

const claimKinds = z.enum([
  "explicit_fact",
  "inference",
  "recommendation",
  "opinion",
  "unverified_claim",
  "historical",
  "decision",
]);
const ev = z.array(localEvidenceSchema).min(1).max(20);
const organizationSchema = localOrganizationSchema;
function aggregate(c: Catalog, sourceId: string, mutations: Mutation[]) {
  const tasks = new Map(
    [...c.heads.values()]
      .filter((r) => r.kind === "task" && r.data.source_id === sourceId)
      .map((r) => [r.entity_id, r.data]),
  );
  for (const m of mutations)
    if (m.kind === "task" && m.data.source_id === sourceId) tasks.set(m.entity_id, m.data);
  const active = [...tasks.values()].filter(
    (t) => !["cancelled", "superseded"].includes(String(t.state)),
  );
  const processing_state = active.some(
    (t) => t.state === "claimed" && Date.parse(String(t.lease_expires_at)) > Date.now(),
  )
    ? "claimed"
    : active.some((t) => t.state === "awaiting_agent" || t.state === "claimed")
      ? "awaiting_agent"
      : active.some((t) => t.state === "submitted")
        ? "review_pending"
        : active.length
          ? "organized"
          : "captured";
  const existing = mutations.find((m) => m.kind === "source" && m.entity_id === sourceId);
  if (existing) existing.data = { ...existing.data, processing_state };
  else mutations.push(sourceMutation(c, sourceId, { processing_state }));
}
function completeSubmissions(c: Catalog, changedId: string, mutations: Mutation[]) {
  for (const submission of c.heads.values())
    if (submission.kind === "submission" && Array.isArray(submission.data.candidate_refs)) {
      const refs = z
        .array(
          z.object({
            kind: z.enum(["memory", "entity", "relationship", "review"]),
            id: z.string(),
          }),
        )
        .parse(submission.data.candidate_refs);
      if (
        !refs.some((x) => x.id === changedId) ||
        !refs.every((x) => {
          const changed = mutations.find((m) => m.kind === x.kind && m.entity_id === x.id),
            status = changed?.data.status ?? head(c, x.kind, x.id).data.status;
          return !["proposed", "pending", "verified"].includes(String(status));
        })
      )
        continue;
      const record = head(c, "task", String(submission.data.task_id)),
        task = localTaskSchema.parse(record.data);
      if (task.state !== "submitted") continue;
      mutations.push({
        kind: "task",
        entity_id: task.id,
        expected_revision: record.revision,
        data: { ...task, state: "completed" },
        body: "Owner resolved every submitted candidate.",
      });
      aggregate(c, task.source_id, mutations);
    }
}
function checkedTask(c: Catalog, actor: LocalActor, id: string, lease?: string) {
  const agent = currentAgent(c, actor);
  if (!agent.capabilities.includes("process_knowledge"))
    throw new DomainError("PROCESSING_DENIED", 403);
  const record = head(c, "task", id),
    task = localTaskSchema.parse(record.data);
  if (task.agent_id !== actor.id) throw new DomainError("NOT_FOUND", 404);
  const grant = localGrantSchema.parse(head(c, "grant", task.grant_id).data),
    source = sourceData(c, task.source_id);
  if (
    grant.agent_id !== actor.id ||
    grant.source_version_id !== task.source_version_id ||
    grant.revoked ||
    Date.parse(grant.expires_at) <= Date.now() ||
    source.archived ||
    source.current_version_id !== task.source_version_id ||
    source.content_revision !== task.expected_source_revision ||
    (source.sensitivity !== "clear" && !grant.released_quarantine)
  )
    throw new DomainError("PROCESSING_GRANT_UNAVAILABLE", 403);
  if (
    lease &&
    (task.state !== "claimed" ||
      task.lease_digest !== sha256(lease) ||
      Date.parse(task.lease_expires_at ?? "") <= Date.now())
  )
    throw new DomainError("LEASE_UNAVAILABLE", 409);
  return { record, task, source, grant };
}
function memoryMutation(
  actor: LocalActor,
  id: string,
  data: Record<string, unknown>,
  audience: ReturnType<typeof sourceAudience>,
): Mutation {
  if (Buffer.byteLength(canonical(data.structured_content ?? {})) > 16384)
    throw new DomainError("STRUCTURED_CONTENT_TOO_LARGE", 413);
  const memory = localMemorySchema.parse({
    subject_key: data.subject_key,
    type: data.type,
    title: data.title,
    summary: data.summary,
    structured_content: data.structured_content ?? {},
    claim_kind: data.claim_kind,
    reported_confidence: data.confidence ?? null,
    evidence: data.evidence,
    ...audience,
    id,
    status: "proposed",
    critical: false,
    retrieval_level: "detail",
    valid_from: new Date().toISOString(),
    valid_to: null,
    superseded_by_id: null,
    requires_revalidation: false,
    agent_id: actor.kind === "agent" ? actor.id : null,
    approved_at: null,
    approved_by: null,
  });
  return {
    kind: "memory",
    entity_id: id,
    expected_revision: 0,
    data: memory,
    body: `# ${memory.title}\n\n${memory.summary}`,
    project_id: memory.project_id,
  };
}
export function createCollaboration(store: LocalStore) {
  async function grant(actor: LocalActor, sourceId: string, input: unknown) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = z
      .object({
        request_key: z.string(),
        expected_revision: z.number().int().positive(),
        agent_id: z.string(),
        source_version_id: z.uuid(),
        expires_at: z.string().datetime(),
        collection_ids: z.array(z.string()).max(1000).default([]),
        release_quarantine: z.boolean().default(false),
      })
      .strict()
      .parse(input);
    const duration = Date.parse(v.expires_at) - Date.now();
    if (duration <= 0 || duration > 7 * 86400000)
      throw new DomainError("INVALID_GRANT_EXPIRY", 400);
    return store.transaction(actor, v.request_key, { sourceId, ...v }, (c) => {
      const r = head(c, "source", sourceId);
      expectRevision(r, v.expected_revision);
      const source = sourceData(c, sourceId);
      if (source.processing_state === "indexing") throw new DomainError("SOURCE_INDEXING", 409);
      const processor = currentAgent(c, { kind: "agent", id: v.agent_id });
      if (!processor.capabilities.includes("process_knowledge"))
        throw new DomainError("PROCESSING_DENIED", 403);
      if (source.current_version_id !== v.source_version_id || source.archived)
        throw new DomainError("SOURCE_VERSION_CHANGED");
      if (source.sensitivity !== "clear" && !v.release_quarantine)
        throw new DomainError("QUARANTINE_RELEASE_REQUIRED", 403);
      const version = versionData(c, v.source_version_id),
        chunks = chunkText(sourceId, version.id, version.text, version.pipeline_version);
      if (!chunks.length) throw new DomainError("NO_PROCESSABLE_TEXT", 400);
      const id = randomUUID(),
        grant = localGrantSchema.parse({
          id,
          agent_id: v.agent_id,
          source_version_id: version.id,
          expires_at: v.expires_at,
          revoked: false,
          collection_ids: v.collection_ids,
          released_quarantine: v.release_quarantine,
        });
      const mutations: Mutation[] = [
        {
          kind: "grant",
          entity_id: id,
          expected_revision: 0,
          data: grant,
          body: "Owner explicitly shared this immutable version with the named processing agent. General source access is unchanged.",
        },
      ];
      for (const record of c.heads.values())
        if (
          record.kind === "grant" &&
          record.data.source_version_id === version.id &&
          record.data.revoked !== true
        )
          mutations.push({
            kind: "grant",
            entity_id: record.entity_id,
            expected_revision: record.revision,
            data: { ...record.data, revoked: true },
            body: "Replaced by an explicit named-processor grant.",
          });
      for (const record of c.heads.values())
        if (
          record.kind === "task" &&
          record.data.source_version_id === version.id &&
          !["completed", "cancelled", "superseded"].includes(String(record.data.state))
        )
          mutations.push({
            kind: "task",
            entity_id: record.entity_id,
            expected_revision: record.revision,
            data: {
              ...record.data,
              state: "cancelled",
              lease_digest: null,
              lease_expires_at: null,
            },
            body: "Fenced by processing reassignment.",
          });
      const ids: string[] = [];
      for (let n = 0; n < chunks.length; n += 20) {
        const taskId = randomUUID();
        ids.push(taskId);
        const task = localTaskSchema.parse({
          id: taskId,
          source_id: sourceId,
          source_version_id: version.id,
          expected_source_revision: source.content_revision,
          contract_version: 1,
          batch_index: n / 20,
          chunk_ids: chunks.slice(n, n + 20).map((x) => x.id),
          collection_ids: v.collection_ids,
          agent_id: v.agent_id,
          grant_id: id,
          state: "awaiting_agent",
          lease_digest: null,
          lease_expires_at: null,
          first_claimed_at: null,
          delivered_chunk_ids: [],
          submission_id: null,
        });
        mutations.push({
          kind: "task",
          entity_id: taskId,
          expected_revision: 0,
          data: task,
          body: "Awaiting an existing connected agent; no agent is launched automatically.",
        });
      }
      mutations.push(sourceMutation(c, sourceId, { processing_state: "awaiting_agent" }));
      return { mutations, result: { grant_id: id, task_ids: ids } };
    });
  }
  async function revokeGrant(actor: LocalActor, id: string, input: unknown) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = z
      .object({ request_key: z.string(), expected_revision: z.number().int().positive() })
      .strict()
      .parse(input);
    return store.transaction(actor, v.request_key, { id, ...v }, (c) => {
      const r = head(c, "grant", id);
      expectRevision(r, v.expected_revision);
      const mutations: Mutation[] = [
        {
          kind: "grant",
          entity_id: id,
          expected_revision: r.revision,
          data: { ...r.data, revoked: true },
          body: "Owner revoked future task access. Already delivered text cannot be recalled.",
        },
      ];
      const sources = new Set<string>();
      for (const task of c.heads.values())
        if (
          task.kind === "task" &&
          task.data.grant_id === id &&
          ["awaiting_agent", "claimed"].includes(String(task.data.state))
        ) {
          mutations.push({
            kind: "task",
            entity_id: task.entity_id,
            expected_revision: task.revision,
            data: { ...task.data, state: "cancelled", lease_digest: null, lease_expires_at: null },
            body: "Owner cancelled future processing access.",
          });
          sources.add(String(task.data.source_id));
        }
      for (const source of sources) aggregate(c, source, mutations);
      return { mutations, result: { grant_id: id, revoked: true } };
    });
  }
  async function list(actor: LocalActor, input: unknown = {}) {
    const v = z
        .object({
          project_id: z.uuid().optional(),
          limit: z.number().int().min(1).max(100).default(25),
          cursor: z.string().optional(),
        })
        .strict()
        .parse(input),
      c = await store.catalog();
    const eligible = [...c.heads.values()]
      .filter((r) => r.kind === "task")
      .flatMap((r) => {
        try {
          const t = checkedTask(c, actor, r.entity_id);
          if (v.project_id && t.source.project_id !== v.project_id) return [];
          if (!["awaiting_agent", "claimed"].includes(t.task.state)) return [];
          return [
            {
              task_id: t.task.id,
              source_version_id: t.task.source_version_id,
              title: t.source.title,
              state: t.task.state,
              chunks: t.task.chunk_ids.length,
              project_id: t.source.project_id,
            },
          ];
        } catch {
          return [];
        }
      })
      .sort((a, b) => a.task_id.localeCompare(b.task_id));
    const offset = v.cursor ? eligible.findIndex((t) => t.task_id === v.cursor) + 1 : 0;
    const tasks = eligible.slice(offset, offset + v.limit);
    return {
      tasks,
      has_more: offset + tasks.length < eligible.length,
      cursor: tasks.at(-1)?.task_id ?? null,
    };
  }
  async function claim(actor: LocalActor, id: string, budget = 2048) {
    const lease = randomBytes(32).toString("base64url"),
      key = `claim:${randomUUID()}`;
    const result = await store.transaction(actor, key, { id }, (c) => {
      const { record, task, source, grant } = checkedTask(c, actor, id);
      if (!["awaiting_agent", "claimed"].includes(task.state))
        throw new DomainError("TASK_NOT_CLAIMABLE");
      if (task.state === "claimed" && Date.parse(task.lease_expires_at ?? "") > Date.now())
        throw new DomainError("TASK_ALREADY_CLAIMED");
      const now = Date.now(),
        expiry = new Date(Math.min(now + 900000, Date.parse(grant.expires_at))).toISOString();
      const reply = {
        task_id: id,
        source_version_id: task.source_version_id,
        expected_source_revision: task.expected_source_revision,
        chunk_ids: task.chunk_ids,
        collection_ids: task.collection_ids,
        lease_expires_at: expiry,
      };
      if (Buffer.byteLength(canonical({ ...reply, lease_token: lease })) * 1.1 + 64 > budget)
        throw new DomainError("BUDGET_INSUFFICIENT", 400);
      const version = versionData(c, task.source_version_id),
        first = chunkText(source.id, version.id, version.text, version.pipeline_version).find(
          (ch) => task.chunk_ids.includes(ch.id),
        );
      if (
        first &&
        Buffer.byteLength(
          canonical({ task_id: id, chunks: [first], has_more: true, cursor: first.id }),
        ) *
          1.1 +
          64 >
          budget
      )
        throw new DomainError("BUDGET_INSUFFICIENT", 400);
      const data = localTaskSchema.parse({
        ...task,
        state: "claimed",
        lease_digest: sha256(lease),
        lease_expires_at: expiry,
        first_claimed_at:
          task.state === "claimed" && Date.parse(task.lease_expires_at ?? "") > now
            ? task.first_claimed_at
            : new Date(now).toISOString(),
      });
      const mutations: Mutation[] = [
        {
          kind: "task",
          entity_id: id,
          expected_revision: record.revision,
          data,
          body: "Agent claimed this exact source batch; only the lease digest is retained.",
        },
      ];
      aggregate(c, source.id, mutations);
      return { mutations, result: reply };
    });
    return { ...result, lease_token: lease };
  }
  async function read(actor: LocalActor, id: string, lease: string, input: unknown = {}) {
    const v = z
      .object({
        chunk_ids: z.array(z.uuid()).max(10).optional(),
        range: z
          .object({ start: z.number().int().nonnegative(), end: z.number().int().positive() })
          .strict()
          .optional(),
        cursor: z.string().optional(),
        token_budget: z.number().int().min(256).max(8192).default(2048),
      })
      .strict()
      .refine((v) => !(v.chunk_ids && v.range), "Use chunks or range")
      .parse(input);
    const c = await store.catalog(),
      { task, source } = checkedTask(c, actor, id, lease),
      version = versionData(c, task.source_version_id);
    if (sha256(await store.read(version.original_path)) !== version.raw_sha256)
      throw new DomainError("ORIGINAL_INTEGRITY", 503);
    const all = chunkText(source.id, version.id, version.text, version.pipeline_version).filter(
      (ch) => task.chunk_ids.includes(ch.id),
    );
    if (v.chunk_ids?.some((ch) => !task.chunk_ids.includes(ch)))
      throw new DomainError("BATCH_ACCESS_DENIED", 403);
    let chunks = all.filter((ch) => !v.chunk_ids || v.chunk_ids.includes(ch.id));
    if (v.range) {
      if (
        v.range.end <= v.range.start ||
        !all.some((ch) => v.range!.start >= ch.start_offset && v.range!.end <= ch.end_offset)
      )
        throw new DomainError("BATCH_RANGE_DENIED", 403);
      chunks = chunks
        .filter((ch) => v.range!.start >= ch.start_offset && v.range!.end <= ch.end_offset)
        .map((ch) => ({
          ...ch,
          text: codePoints(version.text, v.range!.start, v.range!.end),
          start_offset: v.range!.start,
          end_offset: v.range!.end,
          text_sha256: sha256(codePoints(version.text, v.range!.start, v.range!.end)),
        }));
    }
    const start = v.cursor ? chunks.findIndex((ch) => ch.id === v.cursor) + 1 : 0,
      selected: typeof chunks = [];
    for (const ch of chunks.slice(start)) {
      if (
        Buffer.byteLength(
          canonical({ task_id: id, chunks: [...selected, ch], has_more: true, cursor: ch.id }),
        ) *
          1.1 +
          64 >
        v.token_budget
      )
        break;
      selected.push(ch);
      if (selected.length >= 10) break;
    }
    if (!selected.length && chunks.length) throw new DomainError("BUDGET_INSUFFICIENT", 400);
    await store.transaction(
      actor,
      `delivery:${randomUUID()}`,
      { id, chunks: selected.map((ch) => ch.id) },
      (c) => {
        const { record, task } = checkedTask(c, actor, id, lease);
        return {
          mutations: [
            {
              kind: "task",
              entity_id: id,
              expected_revision: record.revision,
              data: {
                ...task,
                delivered_chunk_ids: [
                  ...new Set([
                    ...task.delivered_chunk_ids,
                    ...selected
                      .filter((ch) =>
                        all.some(
                          (original) =>
                            original.id === ch.id &&
                            original.start_offset === ch.start_offset &&
                            original.end_offset === ch.end_offset &&
                            original.text_sha256 === ch.text_sha256,
                        ),
                      )
                      .map((ch) => ch.id),
                  ]),
                ],
              },
              body: "Recorded delivered chunk identifiers; delivery is not proof of understanding.",
            },
          ],
          result: { delivered: true },
        };
      },
    );
    return {
      task_id: id,
      chunks: selected,
      has_more: start + selected.length < chunks.length,
      cursor: selected.at(-1)?.id ?? null,
    };
  }
  async function leaseAction(
    actor: LocalActor,
    id: string,
    lease: string,
    action: "renew" | "release",
  ) {
    const renewed = action === "renew" ? randomBytes(32).toString("base64url") : null;
    const result = await store.transaction(
      actor,
      `${action}:${randomUUID()}`,
      { id, action },
      (c) => {
        const { record, task, grant, source } = checkedTask(c, actor, id, lease),
          now = Date.now(),
          expires = Math.min(
            now + 900000,
            Date.parse(task.first_claimed_at ?? "") + 3600000,
            Date.parse(grant.expires_at),
          );
        if (action === "renew" && expires <= now) throw new DomainError("LEASE_RENEWAL_LIMIT");
        const data =
          action === "renew"
            ? {
                ...task,
                lease_expires_at: new Date(expires).toISOString(),
                lease_digest: sha256(renewed ?? ""),
              }
            : {
                ...task,
                state: "awaiting_agent",
                lease_digest: null,
                lease_expires_at: null,
                first_claimed_at: null,
                delivered_chunk_ids: [],
              };
        const mutations: Mutation[] = [
          {
            kind: "task",
            entity_id: id,
            expected_revision: record.revision,
            data,
            body: `Agent ${action}d its batch lease.`,
          },
        ];
        aggregate(c, source.id, mutations);
        return {
          mutations,
          result: { task_id: id, state: data.state, lease_expires_at: data.lease_expires_at },
        };
      },
    );
    return renewed ? { ...result, lease_token: renewed } : result;
  }
  async function propose(actor: LocalActor, input: unknown) {
    const v = localProposalSchema.parse(input);
    const guard = async (c: Catalog) => {
      if (actor.kind === "agent") {
        const agent = currentAgent(c, actor);
        if (!agent.capabilities.includes("propose")) throw new DomainError("PROPOSALS_DENIED", 403);
        assertRead(
          c,
          actor,
          { scope: v.scope, project_id: v.project_id, owner_agent_id: null, audience: [] },
          "propose",
        );
        assertEvidenceRead(c, actor, v.evidence);
      }
      await validateEvidence(store, c, v.evidence);
    };
    return store.transaction(
      actor,
      v.request_key,
      v,
      (c) => {
        const sources = v.evidence.map((e) =>
          sourceData(c, versionData(c, e.source_version_id).source_id),
        );
        if (
          v.scope !== "personal" &&
          sources.some((s) => s.scope !== v.scope || s.project_id !== v.project_id)
        )
          throw new DomainError("EVIDENCE_AUDIENCE_WIDENING", 403);
        const id = randomUUID(),
          audience = {
            scope: v.scope,
            project_id: v.project_id,
            owner_agent_id: null,
            audience: [],
          };
        return {
          mutations: [memoryMutation(actor, id, v, audience)],
          result: { memory_id: id, status: "proposed" },
        };
      },
      guard,
    );
  }
  async function proposeRelationship(actor: LocalActor, input: unknown) {
    const v = z
      .object({
        request_key: z.string(),
        from_item_id: z.uuid(),
        to_item_id: z.uuid(),
        relationship_type: z.enum([
          "USES",
          "DEPENDS_ON",
          "IMPLEMENTS",
          "BELONGS_TO",
          "RELATED_TO",
          "REPLACES",
          "RESOLVES",
          "DOCUMENTS",
          "REFERENCES",
        ]),
        evidence: ev,
        claim_kind: claimKinds,
      })
      .strict()
      .parse(input);
    if (v.from_item_id === v.to_item_id) throw new DomainError("SELF_RELATIONSHIP", 400);
    const guard = async (c: Catalog) => {
      if (actor.kind === "agent" && !currentAgent(c, actor).capabilities.includes("propose"))
        throw new DomainError("PROPOSALS_DENIED", 403);
      for (const id of [v.from_item_id, v.to_item_id]) {
        const r = [...c.heads.values()].find(
          (r) => r.entity_id === id && ["source", "memory", "entity"].includes(r.kind),
        );
        if (!r || !canReadRecord(c, actor, r.data)) throw new DomainError("NOT_FOUND", 404);
      }
      assertEvidenceRead(c, actor, v.evidence);
      await validateEvidence(store, c, v.evidence);
    };
    return store.transaction(
      actor,
      v.request_key,
      v,
      (c) => {
        const endpoints = [v.from_item_id, v.to_item_id].map(
          (id) =>
            [...c.heads.values()].find(
              (r) => r.entity_id === id && ["source", "memory", "entity"].includes(r.kind),
            )!,
        );
        const first = endpoints[0]!,
          same = endpoints.every(
            (r) =>
              r.data.scope === first.data.scope &&
              r.data.project_id === first.data.project_id &&
              canonical(r.data.audience ?? []) === canonical(first.data.audience ?? []),
          );
        const audience = same
          ? {
              scope: first.data.scope,
              project_id: first.data.project_id,
              owner_agent_id: first.data.owner_agent_id,
              audience: first.data.audience,
            }
          : { scope: "personal", project_id: null, owner_agent_id: null, audience: [] };
        for (const e of v.evidence) {
          const source = sourceData(c, versionData(c, e.source_version_id).source_id);
          if (
            audience.scope !== "personal" &&
            (source.scope !== audience.scope || source.project_id !== audience.project_id)
          )
            throw new DomainError("EVIDENCE_AUDIENCE_WIDENING", 403);
        }
        if (
          [...c.heads.values()].some(
            (r) =>
              r.kind === "relationship" &&
              r.data.from_item_id === v.from_item_id &&
              r.data.to_item_id === v.to_item_id &&
              r.data.type === v.relationship_type &&
              ["proposed", "active"].includes(String(r.data.status)),
          )
        )
          throw new DomainError("DUPLICATE_RELATIONSHIP");
        const id = randomUUID(),
          data = localRelationshipSchema.parse({
            ...audience,
            id,
            from_item_id: v.from_item_id,
            to_item_id: v.to_item_id,
            type: v.relationship_type,
            evidence: v.evidence,
            claim_kind: v.claim_kind,
            status: "proposed",
            agent_id: actor.kind === "agent" ? actor.id : null,
            approved_at: null,
          });
        return {
          mutations: [
            {
              kind: "relationship",
              entity_id: id,
              expected_revision: 0,
              data,
              body: `Proposed ${v.relationship_type} relationship; owner evidence review required.`,
              project_id: data.project_id,
            },
          ],
          result: { relationship_id: id, status: "proposed" },
        };
      },
      guard,
    );
  }
  async function submit(actor: LocalActor, id: string, lease: string, key: string, input: unknown) {
    if (Buffer.byteLength(canonical(input)) > 262144)
      throw new DomainError("SUBMISSION_TOO_LARGE", 413);
    const v = organizationSchema.parse(input);
    const guard = (c: Catalog) => {
      const checked = checkedTask(c, actor, id);
      if (["submitted", "completed"].includes(checked.task.state)) {
        if (checked.task.lease_digest !== sha256(lease)) throw new DomainError("LEASE_UNAVAILABLE");
      } else checkedTask(c, actor, id, lease);
    };
    return store.transaction(
      actor,
      key,
      { id, organization: v },
      async (c) => {
        const { record, task, source } = checkedTask(c, actor, id, lease);
        if (
          v.source_version_id !== task.source_version_id ||
          v.expected_source_revision !== task.expected_source_revision
        )
          throw new DomainError("SOURCE_VERSION_CHANGED");
        if (
          new Set(v.coverage_chunk_ids).size !== task.chunk_ids.length ||
          task.chunk_ids.some(
            (ch) => !v.coverage_chunk_ids.includes(ch) || !task.delivered_chunk_ids.includes(ch),
          )
        )
          throw new DomainError("INCOMPLETE_BATCH_COVERAGE", 400);
        const candidates = [...v.memories, ...v.entities, ...v.relationships],
          candidateIds = new Map<string, string>(
            candidates.map((x) => [x.candidate_id, randomUUID()]),
          );
        if (candidateIds.size !== candidates.length)
          throw new DomainError("DUPLICATE_CANDIDATE_ID", 400);
        for (const candidate of candidates) {
          for (const e of candidate.evidence)
            if (
              e.source_version_id !== task.source_version_id ||
              !e.chunk_id ||
              !task.chunk_ids.includes(e.chunk_id)
            )
              throw new DomainError("BATCH_EVIDENCE_DENIED", 403);
          await validateEvidence(store, c, candidate.evidence);
        }
        const audience = sourceAudience(source),
          mutations: Mutation[] = [],
          refs: { kind: string; id: string }[] = [];
        for (const candidate of v.memories) {
          const id = candidateIds.get(candidate.candidate_id)!;
          mutations.push(memoryMutation(actor, id, candidate, audience));
          refs.push({ kind: "memory", id });
        }
        for (const candidate of v.entities) {
          const id = candidateIds.get(candidate.candidate_id)!,
            entity = localEntitySchema.parse({
              canonical_key: candidate.canonical_key,
              title: candidate.title,
              entity_type: candidate.entity_type,
              aliases: candidate.aliases,
              claim_kind: candidate.claim_kind,
              reported_confidence: candidate.confidence,
              evidence: candidate.evidence,
              ...audience,
              id,
              status: "proposed",
              agent_id: actor.id,
              approved_at: null,
            });
          mutations.push({
            kind: "entity",
            entity_id: id,
            expected_revision: 0,
            data: entity,
            body: `# ${entity.title}\n\nProposed entity; evidence review required.`,
            project_id: source.project_id,
          });
          refs.push({ kind: "entity", id });
        }
        for (const candidate of v.relationships) {
          const from = candidateIds.get(candidate.from_ref) ?? candidate.from_ref,
            to = candidateIds.get(candidate.to_ref) ?? candidate.to_ref;
          if (from === to) throw new DomainError("SELF_RELATIONSHIP", 400);
          for (const endpoint of [from, to])
            if (![...candidateIds.values()].includes(endpoint) && endpoint !== source.id) {
              const target = [...c.heads.values()].find(
                (r) => r.entity_id === endpoint && ["source", "memory", "entity"].includes(r.kind),
              );
              if (!target || !canReadRecord(c, actor, target.data))
                throw new DomainError("NOT_FOUND", 404);
            }
          const id = candidateIds.get(candidate.candidate_id)!,
            relationship = localRelationshipSchema.parse({
              ...audience,
              id,
              from_item_id: from,
              to_item_id: to,
              type: candidate.type,
              claim_kind: candidate.claim_kind,
              reported_confidence: candidate.confidence,
              evidence: candidate.evidence,
              status: "proposed",
              agent_id: actor.id,
              approved_at: null,
            });
          mutations.push({
            kind: "relationship",
            entity_id: id,
            expected_revision: 0,
            data: relationship,
            body: `Proposed ${candidate.type} relationship.`,
            project_id: source.project_id,
          });
          refs.push({ kind: "relationship", id });
        }
        if (v.source_summary) {
          const summaryId = randomUUID(),
            version = versionData(c, task.source_version_id),
            evidence = chunkText(source.id, version.id, version.text, version.pipeline_version)
              .filter((ch) => task.chunk_ids.includes(ch.id))
              .map((ch) => ({
                source_version_id: version.id,
                chunk_id: ch.id,
                start_offset: ch.start_offset,
                end_offset: ch.end_offset,
                quote_sha256: ch.text_sha256,
              }));
          await validateEvidence(store, c, evidence);
          mutations.push(
            memoryMutation(
              actor,
              summaryId,
              {
                subject_key: `source.summary.${source.id}`,
                type: "project",
                title: `Summary: ${source.title}`.slice(0, 160),
                summary: v.source_summary,
                structured_content: {},
                claim_kind: "unverified_claim",
                evidence,
              },
              audience,
            ),
          );
          refs.push({ kind: "memory", id: summaryId });
        }
        if (v.classifications.some((x) => !task.collection_ids.includes(x.collection_id)))
          throw new DomainError("COLLECTION_NOT_SELECTED", 403);
        const submissionId = randomUUID();
        const auto = c.heads.get("settings:workspace")?.data.auto_classify === true;
        const additions: string[] = [];
        for (const classification of v.classifications) {
          const collection = head(c, "collection", classification.collection_id);
          if (collection.data.archived || collection.data.merged_into_id)
            throw new DomainError("COLLECTION_UNAVAILABLE");
          if (
            auto &&
            classification.confidence >= 0.85 &&
            !source.manual_exclude_ids.includes(classification.collection_id)
          )
            additions.push(classification.collection_id);
          else {
            const reviewId = randomUUID();
            mutations.push({
              kind: "review",
              entity_id: reviewId,
              expected_revision: 0,
              data: {
                id: reviewId,
                source_id: source.id,
                submission_id: submissionId,
                status: "pending",
                suggestion_kind: "classification",
                collection_id: classification.collection_id,
                confidence: classification.confidence,
                reason: classification.reason,
                agent_id: actor.id,
              },
              body: `Proposed collection assignment. ${classification.reason}`,
              project_id: source.project_id,
            });
            refs.push({ kind: "review", id: reviewId });
          }
        }
        if (additions.length)
          mutations.push(
            sourceMutation(c, source.id, {
              collection_ids: [...new Set([...source.collection_ids, ...additions])],
            }),
          );
        for (const tag of v.tags) {
          const reviewId = randomUUID();
          mutations.push({
            kind: "review",
            entity_id: reviewId,
            expected_revision: 0,
            data: {
              id: reviewId,
              source_id: source.id,
              submission_id: submissionId,
              status: "pending",
              suggestion_kind: "tag",
              tag: tag.name,
              agent_id: actor.id,
            },
            body: `Proposed tag: ${tag.name}`,
            project_id: source.project_id,
          });
          refs.push({ kind: "review", id: reviewId });
        }
        mutations.push({
          kind: "submission",
          entity_id: submissionId,
          expected_revision: 0,
          data: {
            id: submissionId,
            task_id: id,
            source_id: source.id,
            agent_id: actor.id,
            candidate_refs: refs,
            classifications: v.classifications,
            tags: v.tags,
            organization_sha256: sha256(canonical(v)),
          },
          body: "Agent-reported suggestions; confidence is not objective verification.",
        });
        mutations.push({
          kind: "task",
          entity_id: id,
          expected_revision: record.revision,
          data: {
            ...task,
            state: refs.length ? "submitted" : "completed",
            submission_id: submissionId,
          },
          body: "Validated batch submitted; canonical approval remains owner-only.",
        });
        aggregate(c, source.id, mutations);
        return {
          mutations,
          result: { submission_id: submissionId, candidates: refs, status: "review_pending" },
        };
      },
      guard,
    );
  }
  async function review(
    actor: LocalActor,
    kind: "memory" | "entity" | "relationship",
    id: string,
    input: unknown,
  ) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = z
      .object({
        request_key: z.string(),
        expected_revision: z.number().int().positive(),
        action: z.enum(["approve", "reject", "archive", "restore", "supersede"]),
        reason: z.string().trim().min(1).max(1000),
        replacement_id: z.uuid().optional(),
        expected_replacement_revision: z.number().int().positive().optional(),
      })
      .strict()
      .parse(input);
    return store.transaction(actor, v.request_key, { kind, id, ...v }, async (c) => {
      const record = head(c, kind, id);
      expectRevision(record, v.expected_revision);
      const data = { ...record.data },
        status = String(data.status),
        now = new Date().toISOString();
      const evidence = z.array(localEvidenceSchema).parse(data.evidence);
      if (v.action === "approve" || v.action === "supersede")
        await validateEvidence(store, c, evidence);
      if (v.action === "approve" && kind === "relationship")
        for (const id of [String(data.from_item_id), String(data.to_item_id)]) {
          const endpoint = [...c.heads.values()].find(
            (r) => r.entity_id === id && ["source", "memory", "entity"].includes(r.kind),
          );
          if (
            !endpoint ||
            !canReadRecord(c, actor, endpoint.data) ||
            (endpoint.kind !== "source" && endpoint.data.status !== "active")
          )
            throw new DomainError("ENDPOINT_REVIEW_REQUIRED");
        }
      if (v.action === "approve" && !["proposed", "verified"].includes(status))
        throw new DomainError("INVALID_TRANSITION");
      if (v.action === "reject" && status !== "proposed")
        throw new DomainError("INVALID_TRANSITION");
      if (v.action === "archive" && !["active", "verified"].includes(status))
        throw new DomainError("INVALID_TRANSITION");
      if (v.action === "restore" && status !== "archived")
        throw new DomainError("INVALID_TRANSITION");
      const mutations: Mutation[] = [];
      if (v.action === "supersede") {
        if (
          kind !== "memory" ||
          status !== "active" ||
          !v.replacement_id ||
          !v.expected_replacement_revision
        )
          throw new DomainError("INVALID_SUPERSESSION");
        const replacement = head(c, "memory", v.replacement_id);
        expectRevision(replacement, v.expected_replacement_revision);
        const next = localMemorySchema.parse(replacement.data),
          old = localMemorySchema.parse(data);
        if (
          next.status !== "proposed" ||
          next.subject_key !== old.subject_key ||
          canonical({
            scope: next.scope,
            project_id: next.project_id,
            owner_agent_id: next.owner_agent_id,
            audience: next.audience,
          }) !==
            canonical({
              scope: old.scope,
              project_id: old.project_id,
              owner_agent_id: old.owner_agent_id,
              audience: old.audience,
            })
        )
          throw new DomainError("INCOMPATIBLE_SUPERSESSION");
        await validateEvidence(store, c, next.evidence);
        mutations.push({
          kind: "memory",
          entity_id: next.id,
          expected_revision: replacement.revision,
          data: {
            ...next,
            status: "active",
            approved_at: now,
            approved_by: actor.id,
            requires_revalidation: false,
          },
          body: replacement.body,
          project_id: next.project_id,
        });
        data.status = "superseded";
        data.superseded_by_id = next.id;
        data.valid_to = now;
      } else {
        data.status = {
          approve: "active",
          reject: "rejected",
          archive: "archived",
          restore: "proposed",
        }[v.action];
        if (v.action === "approve") {
          data.approved_at = now;
          if (kind === "memory") {
            data.approved_by = actor.id;
            data.requires_revalidation = false;
          }
        }
        if (v.action === "restore") {
          data.approved_at = null;
          if (kind === "memory") {
            data.approved_by = null;
            data.requires_revalidation = true;
          }
        }
      }
      mutations.push({
        kind,
        entity_id: id,
        expected_revision: record.revision,
        data,
        body: record.body,
        project_id: typeof data.project_id === "string" ? data.project_id : null,
      });
      const reviewId = randomUUID();
      mutations.push({
        kind: "review",
        entity_id: reviewId,
        expected_revision: 0,
        data: {
          id: reviewId,
          target_id: id,
          target_kind: kind,
          action: v.action,
          reason: v.reason,
          owner_id: actor.id,
          at: now,
          transitions: v.action === "approve" ? ["verified", "active"] : [data.status],
        },
        body: `# Owner review\n\n${v.reason}`,
        project_id: typeof data.project_id === "string" ? data.project_id : null,
      });
      completeSubmissions(c, id, mutations);
      return {
        mutations,
        result: { item_id: id, status: String(data.status), review_id: reviewId },
      };
    });
  }
  async function reviewSuggestion(actor: LocalActor, id: string, input: unknown) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = z
      .object({
        request_key: z.string(),
        expected_revision: z.number().int().positive(),
        action: z.enum(["approve", "reject"]),
        reason: z.string().trim().min(1).max(1000),
      })
      .strict()
      .parse(input);
    return store.transaction(actor, v.request_key, { id, ...v }, (c) => {
      const r = head(c, "review", id);
      expectRevision(r, v.expected_revision);
      if (r.data.status !== "pending") throw new DomainError("INVALID_TRANSITION");
      const source = sourceData(c, String(r.data.source_id));
      if (source.archived) throw new DomainError("SOURCE_ARCHIVED");
      const submission = head(c, "submission", String(r.data.submission_id)),
        task = localTaskSchema.parse(head(c, "task", String(submission.data.task_id)).data);
      if (source.current_version_id !== task.source_version_id)
        throw new DomainError("SOURCE_VERSION_CHANGED");
      const mutations: Mutation[] = [
        {
          kind: "review",
          entity_id: id,
          expected_revision: r.revision,
          data: {
            ...r.data,
            status: v.action === "approve" ? "approved" : "rejected",
            owner_id: actor.id,
            owner_reason: v.reason,
          },
          body: `${r.body}\n\nOwner ${v.action}: ${v.reason}`,
          project_id: source.project_id,
        },
      ];
      if (v.action === "approve") {
        if (r.data.suggestion_kind === "classification") {
          const cid = String(r.data.collection_id),
            collection = head(c, "collection", cid);
          if (collection.data.archived || source.manual_exclude_ids.includes(cid))
            throw new DomainError("MANUAL_EXCLUSION_OR_ARCHIVE_CONFLICT");
          mutations.push(
            sourceMutation(c, source.id, {
              collection_ids: [...new Set([...source.collection_ids, cid])],
            }),
          );
        } else if (r.data.suggestion_kind === "tag") {
          const tags = [...new Set([...source.tags, String(r.data.tag)])];
          if (tags.length > 30) throw new DomainError("TAG_LIMIT", 413);
          mutations.push(sourceMutation(c, source.id, { tags }));
        }
      }
      completeSubmissions(c, id, mutations);
      return { mutations, result: { review_id: id, status: v.action } };
    });
  }
  async function retrievalSettings(actor: LocalActor, id: string, input: unknown) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = z
      .object({
        request_key: z.string(),
        expected_revision: z.number().int().positive(),
        critical: z.boolean(),
        retrieval_level: z.enum(["core", "project", "detail"]),
        reason: z.string().trim().min(1).max(1000),
      })
      .strict()
      .parse(input);
    return store.transaction(actor, v.request_key, { id, ...v }, async (c) => {
      const r = head(c, "memory", id),
        m = localMemorySchema.parse(r.data);
      expectRevision(r, v.expected_revision);
      await validateEvidence(store, c, m.evidence);
      return {
        mutations: [
          {
            kind: "memory",
            entity_id: id,
            expected_revision: r.revision,
            data: { ...m, critical: v.critical, retrieval_level: v.retrieval_level },
            body: r.body,
            project_id: m.project_id,
          },
          {
            kind: "review",
            entity_id: randomUUID(),
            expected_revision: 0,
            data: {
              target_id: id,
              action: "retrieval_settings",
              reason: v.reason,
              owner_id: actor.id,
            },
            body: v.reason,
            project_id: m.project_id,
          },
        ],
        result: { memory_id: id },
      };
    });
  }
  return {
    grant,
    revokeGrant,
    list,
    claim,
    read,
    leaseAction,
    propose,
    proposeRelationship,
    submit,
    review,
    reviewSuggestion,
    retrievalSettings,
  };
}
