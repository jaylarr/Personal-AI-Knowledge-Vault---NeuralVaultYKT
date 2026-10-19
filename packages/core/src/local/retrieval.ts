import { lexicalIndex, lexicalRevision } from "./lexical-index.js";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  localContextPacketSchema,
  localRetrievalInputSchema,
  localEvidenceSchema,
  localMemorySchema,
  z,
  type LocalActor,
  type LocalContextPacket,
  type LocalDomainRecord,
} from "@atlas/contracts";
import {
  DomainError,
  canonical,
  sha256,
  head,
  type LocalStore,
  type Catalog,
} from "./transactions.js";
import { canReadRecord, assertRead, assertEvidenceRead } from "./authorization.js";
import {
  sourceData,
  versionData,
  evidenceStale,
  codePoints,
  chunkText,
  validateEvidence,
} from "./sources.js";

type Item = LocalContextPacket["items"][number];
export const packetUnits = (value: unknown) =>
  Math.ceil(Buffer.byteLength(JSON.stringify(value), "utf8") * 1.1) + 64;
function settle(packet: LocalContextPacket) {
  for (let i = 0; i < 8; i++) {
    const used = packetUnits(packet);
    if (used === packet.budget.used) break;
    packet.budget.used = used;
  }
  return packet;
}
export function packContext(
  items: Item[],
  budget: number,
  traceId: string,
  warnings: string[] = [],
  continuation: string | null = null,
) {
  const packet: LocalContextPacket = {
    schema_version: 1,
    trace_id: traceId,
    mode: "lexical_graph",
    items: [],
    warnings: [...warnings],
    has_more: false,
    continuation: null,
    budget: { requested: budget, used: 0, measure: "utf8_conservative_estimate_v1" },
  };
  let omittedCritical = false;
  for (const item of items) {
    const test = settle({
      ...packet,
      items: [...packet.items, item],
      warnings: [...warnings],
      has_more: true,
      continuation,
    });
    if (test.budget.used > budget) {
      if (items.slice(packet.items.length).some((i) => i.critical)) omittedCritical = true;
      break;
    }
    packet.items.push(item);
  }
  packet.has_more = packet.items.length < items.length;
  packet.continuation = packet.has_more ? continuation : null;
  if (omittedCritical)
    packet.warnings.push(
      "BUDGET_INSUFFICIENT: required critical constraints were omitted; increase the budget.",
    );
  settle(packet);
  while (packet.budget.used > budget && packet.items.length) {
    packet.items.pop();
    packet.has_more = true;
    packet.continuation = continuation;
    settle(packet);
  }
  if (packet.budget.used > budget) throw new DomainError("BUDGET_INSUFFICIENT", 400);
  return localContextPacketSchema.parse(packet);
}
function eligible(c: Catalog, actor: LocalActor, r: LocalDomainRecord, history = false) {
  if (
    !["source", "memory", "entity", "relationship"].includes(r.kind) ||
    !canReadRecord(c, actor, r.data)
  )
    return false;
  if (r.kind === "source") return r.data.archived !== true;
  const evidence = z.array(localEvidenceSchema).parse(r.data.evidence);
  if (
    (evidenceStale(c, evidence) || r.data.requires_revalidation === true) &&
    !(history && actor.kind === "owner")
  )
    return false;
  const now = Date.now();
  if (
    r.kind === "memory" &&
    (Date.parse(String(r.data.valid_from)) > now ||
      (r.data.valid_to && Date.parse(String(r.data.valid_to)) <= now))
  )
    return history && actor.kind === "owner";
  return r.data.status === "active" || (history && actor.kind === "owner");
}
function toItem(c: Catalog, r: LocalDomainRecord, detail: string, history = false): Item {
  let summary = String(r.data.summary ?? r.body),
    refs = z.array(localEvidenceSchema).parse(r.data.evidence ?? []);
  if (r.kind === "source") {
    const source = sourceData(c, r.entity_id),
      version = versionData(c, source.current_version_id),
      chunk = chunkText(source.id, version.id, version.text, version.pipeline_version)[0];
    summary = version.text.slice(
      0,
      detail === "detailed" ? 1600 : detail === "minimal" ? 200 : 700,
    );
    refs = chunk
      ? [
          {
            source_version_id: version.id,
            chunk_id: chunk.id,
            start_offset: chunk.start_offset,
            end_offset: chunk.end_offset,
            quote_sha256: chunk.text_sha256,
          },
        ]
      : [];
  }
  let status = String(r.data.status ?? r.data.processing_state ?? "unknown");
  if (history && r.kind !== "source") {
    if (evidenceStale(c, refs) || r.data.requires_revalidation === true)
      status += ":historical_evidence";
    else if (
      r.kind === "memory" &&
      (Date.parse(String(r.data.valid_from)) > Date.now() ||
        (r.data.valid_to && Date.parse(String(r.data.valid_to)) <= Date.now()))
    )
      status += ":historical_validity";
  }
  return {
    id: r.entity_id,
    type: r.kind,
    title: String(r.data.title ?? r.data.type ?? r.kind),
    summary,
    status,
    critical: r.data.critical === true,
    source_refs: refs,
  };
}
export function createRetrieval(store: LocalStore) {
  let cachedIndex:
    | { revision: string; documents: Map<string, string>; heads: Map<string, string> }
    | undefined;
  const secret = randomBytes(32);
  function cursor(payload: unknown) {
    const data = Buffer.from(canonical(payload)).toString("base64url");
    return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
  }
  function decodeCursor(value: string) {
    const [data, mac] = value.split(".");
    if (!data || !mac) throw new DomainError("INVALID_CONTINUATION", 400);
    const expected = createHmac("sha256", secret).update(data).digest(),
      actual = Buffer.from(mac, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new DomainError("INVALID_CONTINUATION", 400);
    return z
      .tuple([z.string(), z.string(), z.string(), z.number().int().nonnegative(), z.number()])
      .parse(JSON.parse(Buffer.from(data, "base64url").toString()));
  }
  async function retrieve(
    actor: LocalActor,
    input: unknown,
    options: {
      item_id?: string;
      related_to?: string;
      recent_since?: string;
      recent_until?: string;
      recent?: boolean;
      limit?: number;
      kind?: string;
      relationship_types?: string[];
    } = {},
  ) {
    const v = localRetrievalInputSchema.parse(input),
      traceId = randomUUID();
    let deliveredPacket: LocalContextPacket | undefined;
    await store.transaction(
      actor,
      `trace:${traceId}`,
      { query_hash: sha256(v.query), trace_id: traceId },
      async (c) => {
        if (c.incomplete) throw new DomainError("CATALOG_INTEGRITY", 503);
        const started = performance.now(),
          all = [...c.heads.values()].filter((r) => eligible(c, actor, r, v.include_history));
        let records = all.filter(
          (r) =>
            (!options.kind || r.kind === options.kind) &&
            (!v.project_id || r.data.project_id === v.project_id) &&
            (!v.collection_id ||
              (Array.isArray(r.data.collection_ids) &&
                r.data.collection_ids.includes(v.collection_id))) &&
            (!v.memory_types ||
              r.kind !== "memory" ||
              v.memory_types.includes(localMemorySchema.parse(r.data).type)),
        );
        if (options.item_id)
          records = records.filter(
            (r) => r.entity_id === options.item_id && (!options.kind || r.kind === options.kind),
          );
        if (options.related_to) records = records.filter((r) => r.entity_id === options.related_to);
        if (options.item_id && !records.length) throw new DomainError("NOT_FOUND", 404);
        const tokens = [...new Set(v.query.toLocaleLowerCase().match(/[\p{L}\p{N}_./-]+/gu) ?? [])],
          query = v.query.toLocaleLowerCase().trim();
        const wholeTokens = tokens.map(
          (token) =>
            new RegExp(
              `(^|[^\\p{L}\\p{N}_])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}_])`,
              "u",
            ),
        );
        const contentHeads = [...c.heads.values()].filter((r) =>
          ["source", "version", "memory", "entity", "relationship"].includes(r.kind),
        );
        const unchanged =
          cachedIndex &&
          cachedIndex.heads.size === contentHeads.length &&
          contentHeads.every((r) => cachedIndex?.heads.get(`${r.kind}:${r.entity_id}`) === r.id);
        const indexRevision = unchanged ? cachedIndex!.revision : lexicalRevision(c);
        if (!unchanged)
          cachedIndex = {
            revision: indexRevision,
            documents: await lexicalIndex(store, c, indexRevision),
            heads: new Map(contentHeads.map((r) => [`${r.kind}:${r.entity_id}`, r.id])),
          };
        const score = (r: LocalDomainRecord) => {
          const title = String(r.data.title ?? "").toLocaleLowerCase(),
            subject = String(r.data.subject_key ?? r.data.canonical_key ?? "").toLocaleLowerCase();
          const text = cachedIndex?.documents.get(r.entity_id) ?? "";
          return (
            (query && (title === query || subject === query) ? 10000 : 0) +
            tokens.reduce(
              (n, t, index) =>
                n +
                (subject === t
                  ? 200
                  : wholeTokens[index]?.test(text)
                    ? 100
                    : title.includes(t)
                      ? 50
                      : text.includes(t)
                        ? 5
                        : 0),
              0,
            ) +
            (r.data.critical === true ? 100 : 0)
          );
        };
        if (query) records = records.filter((r) => score(r) > 0);
        if (options.recent_since)
          records = records.filter((r) => r.created_at >= options.recent_since!);
        if (options.recent_until)
          records = records.filter((r) => r.created_at <= options.recent_until!);
        records.sort(
          (a, b) =>
            (options.recent ? b.created_at.localeCompare(a.created_at) : 0) ||
            Number(b.data.critical === true) - Number(a.data.critical === true) ||
            score(b) - score(a) ||
            a.entity_id.localeCompare(b.entity_id),
        );
        const selected = new Map(
          records
            .slice(0, options.limit ?? (v.depth || options.related_to ? 100 : records.length))
            .map((r) => [r.entity_id, r]),
        );
        if (v.depth || options.related_to) {
          let frontier = new Set(options.related_to ? [options.related_to] : [...selected.keys()]);
          if (options.related_to && !all.some((r) => r.entity_id === options.related_to))
            throw new DomainError("NOT_FOUND", 404);
          for (let depth = 0; depth < Math.max(v.depth, options.related_to ? 1 : 0); depth++) {
            const next = new Set<string>();
            for (const edge of all.filter(
              (r) =>
                r.kind === "relationship" &&
                r.data.status === "active" &&
                (!options.relationship_types ||
                  options.relationship_types.includes(String(r.data.type))),
            )) {
              const from = String(edge.data.from_item_id),
                to = String(edge.data.to_item_id);
              if (!frontier.has(from) && !frontier.has(to)) continue;
              for (const id of [from, to]) {
                const node = all.find((r) => r.entity_id === id);
                if (node && !selected.has(id) && selected.size < 120) {
                  selected.set(id, node);
                  next.add(id);
                }
              }
            }
            frontier = next;
          }
        }
        const ordered = [...selected.values()],
          actorHash = sha256(canonical(actor)).slice(0, 32),
          queryHash = sha256(canonical({ ...v, continuation: undefined, options })).slice(0, 32),
          revision = sha256(
            canonical({ index: indexRevision, items: ordered.map((r) => [r.id, r.file_digest]) }),
          ).slice(0, 32);
        let offset = 0;
        if (v.continuation) {
          const [a, q, r, n, expires] = decodeCursor(v.continuation);
          if (a !== actorHash || q !== queryHash || r !== revision || expires <= Date.now())
            throw new DomainError("CONTINUATION_EXPIRED_OR_CHANGED", 409);
          offset = n;
        }
        const remaining = ordered.slice(offset),
          items = remaining.slice(0, 100).map((r) => {
            const item = toItem(c, r, v.detail, v.include_history && actor.kind === "owner");
            if (options.recent)
              item.summary = `Revision ${r.revision} · ${r.created_at} · ${r.actor.kind}: ${r.actor.id}. ${item.summary}`;
            return item;
          });
        const placeholder = cursor([
          actorHash,
          queryHash,
          revision,
          offset + 1,
          Date.now() + 600000,
        ]);
        let packet = packContext(
          items,
          v.token_budget,
          traceId,
          items.some((item) => item.status.includes(":historical_"))
            ? [
                "Historical evidence or validity is included for this explicit owner view; verify against current sources before acting.",
              ]
            : [],
          placeholder,
        );
        packet.has_more ||= remaining.length > items.length;
        if (
          remaining.slice(items.length).some((r) => r.data.critical === true) &&
          !packet.warnings.some((w) => w.startsWith("BUDGET_INSUFFICIENT"))
        )
          packet.warnings.push(
            "BUDGET_INSUFFICIENT: required critical constraints were omitted; increase the budget.",
          );
        if (packet.has_more && packet.items.length) {
          const last = packet.items.at(-1)!;
          const nextOffset = ordered.findIndex((r) => r.entity_id === last.id) + 1;
          packet.continuation = cursor([
            actorHash,
            queryHash,
            revision,
            nextOffset,
            Date.now() + 600000,
          ]);
          packet = settle(packet);
          if (packet.budget.used > v.token_budget)
            throw new DomainError("BUDGET_INSUFFICIENT", 400);
        }
        if (packet.has_more && !packet.items.length)
          packet.warnings.push("No complete item fits; increase token_budget.");
        packet = settle(packet);
        if (packet.budget.used > v.token_budget) throw new DomainError("BUDGET_INSUFFICIENT", 400);
        const deliveredEvidence = packet.items.flatMap((item) => item.source_refs);
        for (const item of packet.items) {
          const record = c.heads.get(`${item.type}:${item.id}`);
          if (record && sha256(await store.read(record.path)) !== record.file_digest)
            throw new DomainError("CATALOG_INTEGRITY", 503);
        }
        if (deliveredEvidence.length)
          await validateEvidence(
            store,
            c,
            deliveredEvidence,
            !(v.include_history && actor.kind === "owner"),
          );
        deliveredPacket = packet;
        return {
          mutations: [
            {
              kind: "trace",
              entity_id: traceId,
              expected_revision: 0,
              data: {
                id: traceId,
                query_hash: sha256(v.query),
                filters: {
                  project_id: v.project_id ?? null,
                  collection_id: v.collection_id ?? null,
                  memory_types: v.memory_types ?? null,
                  include_history: v.include_history,
                  depth: v.depth,
                  detail: v.detail,
                },
                ranks: packet.items.map((item, index) => {
                  const record = c.heads.get(`${item.type}:${item.id}`);
                  return {
                    item_id: item.id,
                    rank: offset + index + 1,
                    lexical_score: record ? score(record) : 0,
                    critical: item.critical,
                    origin: records.some((r) => r.entity_id === item.id)
                      ? "lexical_selection"
                      : "approved_graph_expansion",
                  };
                }),
                project_id: v.project_id ?? null,
                item_ids: packet.items.map((i) => i.id),
                revisions: packet.items.map((i) => c.heads.get(`${i.type}:${i.id}`)?.id ?? null),
                budget: packet.budget,
                elapsed_ms: performance.now() - started,
              },
              body: "Retrieval trace: identifiers/ranks and query digest only. Raw query and source text were not logged.",
            },
          ],
          result: { trace_id: traceId },
        };
      },
    );
    if (!deliveredPacket) throw new DomainError("TRACE_PUBLICATION_FAILED", 503);
    return deliveredPacket;
  }

  async function readSource(actor: LocalActor, id: string, input: unknown) {
    const v = z
      .object({
        version_id: z.uuid().optional(),
        chunk_ids: z.array(z.uuid()).max(10).optional(),
        range: z
          .object({ start: z.number().int().nonnegative(), end: z.number().int().positive() })
          .strict()
          .optional(),
        token_budget: z.number().int().min(256).max(8192).default(2048),
        continuation: z.string().max(300).optional(),
      })
      .strict()
      .refine((v) => !(v.chunk_ids && v.range), "Use chunks or range")
      .parse(input);
    const c = await store.catalog(),
      source = sourceData(c, id);
    assertRead(c, actor, source);
    const version = versionData(c, v.version_id ?? source.current_version_id);
    if (version.source_id !== id) throw new DomainError("NOT_FOUND", 404);
    if (actor.kind !== "owner" && version.id !== source.current_version_id)
      throw new DomainError("NOT_FOUND", 404);
    if (sha256(await store.read(version.original_path)) !== version.raw_sha256)
      throw new DomainError("ORIGINAL_INTEGRITY", 503);
    const chunks = chunkText(id, version.id, version.text, version.pipeline_version);
    if (v.chunk_ids?.some((ch) => !chunks.some((x) => x.id === ch)))
      throw new DomainError("NOT_FOUND", 404);
    const selected = chunks.filter((ch) => !v.chunk_ids || v.chunk_ids.includes(ch.id));
    let items: Item[] = selected.map((ch) => ({
      id: ch.id,
      type: "source_chunk",
      title: source.title,
      summary: ch.text,
      status: "source",
      critical: false,
      source_refs: [
        {
          source_version_id: version.id,
          chunk_id: ch.id,
          start_offset: ch.start_offset,
          end_offset: ch.end_offset,
          quote_sha256: ch.text_sha256,
        },
      ],
    }));
    if (v.range) {
      if (v.range.end <= v.range.start || v.range.end > Array.from(version.text).length)
        throw new DomainError("INVALID_RANGE", 400);
      const text = codePoints(version.text, v.range.start, v.range.end);
      items = [
        {
          id: version.id,
          type: "source_range",
          title: source.title,
          summary: text,
          status: "source",
          critical: false,
          source_refs: [
            {
              source_version_id: version.id,
              start_offset: v.range.start,
              end_offset: v.range.end,
              quote_sha256: sha256(text),
            },
          ],
        },
      ];
    }
    const a = sha256(canonical(actor)).slice(0, 32),
      q = sha256(canonical({ id, ...v, continuation: undefined })).slice(0, 32),
      revision = version.normalized_sha256.slice(0, 32);
    let offset = 0;
    if (v.continuation) {
      const [actorHash, queryHash, versionHash, n, expires] = decodeCursor(v.continuation);
      if (a !== actorHash || q !== queryHash || revision !== versionHash || expires <= Date.now())
        throw new DomainError("CONTINUATION_EXPIRED_OR_CHANGED", 409);
      offset = n;
    }
    items = items.slice(offset);
    const placeholder = cursor([a, q, revision, offset + 1, Date.now() + 600000]),
      packet = packContext(items, v.token_budget, randomUUID(), [], placeholder);
    if (packet.has_more && packet.items.length)
      packet.continuation = cursor([
        a,
        q,
        revision,
        offset + packet.items.length,
        Date.now() + 600000,
      ]);
    if (packet.has_more && !packet.items.length) packet.continuation = null;
    settle(packet);
    if (packet.budget.used > v.token_budget) throw new DomainError("BUDGET_INSUFFICIENT", 400);
    return packet;
  }
  return { retrieve, readSource };
}
