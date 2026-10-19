import { randomUUID } from "node:crypto";
import { TextDecoder } from "node:util";
import { markdownChunks } from "./markdown-chunks.js";
import { extractPdf } from "./parsers/pdf.js";
import { parseN8nExport } from "./parsers/n8n.js";
import { parseSelectedConversation } from "./parsers/conversation.js";
import {
  localSourceInputSchema,
  localSourceSchema,
  localAudienceSchema,
  localVersionSchema,
  localChunkSchema,
  z,
  type LocalActor,
  type LocalSource,
  type LocalSourceVersion,
  type LocalChunk,
  type LocalEvidence,
} from "@atlas/contracts";
import {
  DomainError,
  head,
  expectRevision,
  sha256,
  canonical,
  type LocalStore,
  type Catalog,
  type Mutation,
} from "./transactions.js";

export const PIPELINE = "local-text-v2";
export function secretClasses(text: string) {
  const patterns: [string, RegExp][] = [
    ["private_key", /-----BEGIN (?:[A-Z0-9 ]*PRIVATE KEY)-----/],
    ["atlas_token", /\batlas_[A-Za-z0-9_-]{43}\b/],
    [
      "provider_token",
      /\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/,
    ],
    [
      "credential_assignment",
      /(?:api[_-]?key|password|secret|access[_-]?token)["']?\s*[:=]\s*["']?[A-Za-z0-9_+/-]{12,}/i,
    ],
    ["bearer_credential", /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i],
    ["url_credential", /[a-z][a-z0-9+.-]*:\/\/[^\s/:]+:[^\s/@]+@/i],
  ];
  return patterns.filter(([, re]) => re.test(text)).map(([name]) => name);
}
export const codePoints = (text: string, start: number, end: number) =>
  Array.from(text).slice(start, end).join("");
export function normalized(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/\r\n?/g, "\n");
  } catch {
    throw new DomainError("INVALID_UTF8", 415);
  }
}
function stableUuid(value: string) {
  const h = sha256(value);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function chunkText(
  sourceId: string,
  versionId: string,
  text: string,
  pipeline = PIPELINE,
): LocalChunk[] {
  if (pipeline === PIPELINE || pipeline === "pdf-text-v2")
    return markdownChunks(sourceId, versionId, text);
  if (!["local-text-v1", "local-pdf-text-v1", "pdf-text-v1"].includes(pipeline))
    throw new DomainError("PIPELINE_UNSUPPORTED", 409);
  const points = Array.from(text),
    chunks: LocalChunk[] = [];
  let start = 0,
    sequence = 0;
  const headings: string[] = [];
  while (start < points.length) {
    let end = start,
      units = 0,
      lastBoundary = start;
    while (end < points.length) {
      const p = points[end] ?? "";
      const cost = Buffer.byteLength(p);
      if (units + cost > 800) break;
      units += cost;
      end++;
      if (p === "\n") lastBoundary = end;
      if (units >= 400 && p === "\n") break;
    }
    if (end === start) end++;
    if (units >= 800 && lastBoundary > start) end = lastBoundary;
    const body = points.slice(start, end).join("");
    for (const match of body.matchAll(/^(#{1,6})\s+(.+)$/gm)) {
      const level = match[1]?.length ?? 1;
      headings.length = level - 1;
      headings[level - 1] = match[2] ?? "";
    }
    chunks.push(
      localChunkSchema.parse({
        id: stableUuid(`${versionId}:local-text-v1:${sequence}:${start}:${end}:${sha256(body)}`),
        source_id: sourceId,
        source_version_id: versionId,
        sequence,
        heading_path: headings.filter(Boolean),
        start_offset: start,
        end_offset: end,
        text_sha256: sha256(body),
        estimated_units: Buffer.byteLength(body),
        text: body,
      }),
    );
    start = end;
    sequence++;
  }
  return chunks;
}
export const sourceData = (c: Catalog, id: string) =>
  localSourceSchema.parse(head(c, "source", id).data);
export const versionData = (c: Catalog, id: string) =>
  localVersionSchema.parse(head(c, "version", id).data);
export function sourceAudience(s: LocalSource) {
  return {
    scope: s.scope,
    project_id: s.project_id,
    owner_agent_id: s.owner_agent_id,
    audience: s.audience,
  };
}
export function sourceMutation(c: Catalog, id: string, patch: Partial<LocalSource>): Mutation {
  const r = head(c, "source", id),
    data = localSourceSchema.parse({ ...r.data, ...patch });
  return {
    kind: "source",
    entity_id: id,
    expected_revision: r.revision,
    data,
    body: `# ${data.title}\n\nLocal original: [[${data.current_version_id}]].\n\nState: ${data.processing_state}. Sensitivity: ${data.sensitivity}.`,
    project_id: data.project_id,
  };
}
export async function validateEvidence(
  store: LocalStore,
  c: Catalog,
  evidence: LocalEvidence[],
  current = true,
) {
  if (!evidence.length) throw new DomainError("EVIDENCE_REQUIRED", 400);
  const checkedOriginals = new Set<string>();
  for (const e of evidence) {
    const version = versionData(c, e.source_version_id),
      source = sourceData(c, version.source_id);
    for (const record of [head(c, "source", source.id), head(c, "version", version.id)])
      if (sha256(await store.read(record.path)) !== record.file_digest)
        throw new DomainError("CATALOG_INTEGRITY", 503);
    if (
      source.archived ||
      (current && source.current_version_id !== version.id) ||
      e.end_offset > Array.from(version.text).length
    )
      throw new DomainError("STALE_EVIDENCE");
    if (sha256(codePoints(version.text, e.start_offset, e.end_offset)) !== e.quote_sha256)
      throw new DomainError("EVIDENCE_HASH_MISMATCH", 400);
    if (!checkedOriginals.has(version.id)) {
      if (sha256(await store.read(version.original_path)) !== version.raw_sha256)
        throw new DomainError("ORIGINAL_INTEGRITY", 503);
      checkedOriginals.add(version.id);
    }
    if (e.chunk_id) {
      const chunk = chunkText(source.id, version.id, version.text, version.pipeline_version).find(
        (n) => n.id === e.chunk_id,
      );
      if (!chunk || e.start_offset < chunk.start_offset || e.end_offset > chunk.end_offset)
        throw new DomainError("EVIDENCE_CHUNK_MISMATCH", 400);
    }
  }
}
export function evidenceStale(c: Catalog, evidence: LocalEvidence[]) {
  try {
    return evidence.some((e) => {
      const v = versionData(c, e.source_version_id),
        s = sourceData(c, v.source_id);
      return (
        s.archived ||
        s.current_version_id !== v.id ||
        sha256(codePoints(v.text, e.start_offset, e.end_offset)) !== e.quote_sha256
      );
    });
  } catch {
    return true;
  }
}
const versionInput = z
  .object({
    request_key: z.string(),
    expected_revision: z.number().int().positive(),
    expected_file_digest: z.string(),
    content: z.string().max(2097152),
  })
  .strict();
export function createSourceService(
  store: LocalStore,
  notify: () => void = () => {},
  compute: (
    sourceId: string,
    versionId: string,
    text: string,
    pipeline?: string,
  ) => Promise<LocalChunk[]> = async (a, b, c, pipeline) => chunkText(a, b, c, pipeline),
) {
  async function capture(
    actor: LocalActor,
    input: unknown,
    original?: {
      bytes: Uint8Array;
      media_type: string;
      extension: string;
      text?: string;
      extraction_status?: string;
      page_ranges?: LocalSourceVersion["page_ranges"];
      content_encoding?: string;
      redirects?: string[];
    },
  ) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = localSourceInputSchema.parse(input),
      supplied = original?.bytes ?? Buffer.from(v.content),
      conversation =
        v.input_type === "conversation"
          ? parseSelectedConversation(supplied, v.selected_turn_ids ?? [])
          : null,
      bytes = conversation?.bytes ?? supplied;
    if (bytes.length > (original ? 20971520 : 2097152))
      throw new DomainError("SOURCE_TOO_LARGE", 413);
    if (v.scope === "project" && !v.project_id) throw new DomainError("PROJECT_REQUIRED", 400);
    if (["agent_private", "shared_agents"].includes(v.scope))
      throw new DomainError("EXPLICIT_AUDIENCE_REQUIRED", 400);
    const workflow = v.input_type === "n8n_json" ? parseN8nExport(bytes) : null;
    const text =
      conversation?.text ??
      workflow?.text ??
      original?.text ??
      (original && !original.media_type.startsWith("text/") ? "" : normalized(bytes));
    if (Buffer.byteLength(text) > 2097152) throw new DomainError("EXTRACTED_TEXT_TOO_LARGE", 413);
    const result = await store.transaction(
      actor,
      v.request_key,
      { ...v, original_sha: sha256(bytes) },
      async (c) => {
        if (v.upload_id && c.heads.has(`upload_receipt:${v.upload_id}`))
          throw new DomainError("UPLOAD_ALREADY_CONSUMED");
        const id = randomUUID(),
          versionId = randomUUID(),
          jobId = randomUUID(),
          base = await store.basePath(v.project_id),
          now = new Date().toISOString();
        const path = `${base}/Attachments/${id}/${versionId}/original.${original?.extension ?? (v.input_type === "markdown" ? "md" : "txt")}`;
        const sensitivity = secretClasses(`${v.title}\n${v.origin_url ?? ""}\n${text}`).length
          ? "quarantined"
          : "clear";
        const version = localVersionSchema.parse({
          id: versionId,
          source_id: id,
          version: 1,
          predecessor_version_id: null,
          raw_sha256: sha256(bytes),
          normalized_sha256: sha256(text),
          byte_count: bytes.length,
          media_type:
            original?.media_type ?? (v.input_type === "markdown" ? "text/markdown" : "text/plain"),
          original_path: path,
          pipeline_version: PIPELINE,
          captured_at: now,
          extraction_status:
            conversation?.extraction_status ??
            workflow?.extraction_status ??
            original?.extraction_status ??
            "text",
          export_sha256: conversation?.export_sha256 ?? null,
          origin_url: v.origin_url ?? null,
          content_encoding: original?.content_encoding ?? null,
          redirects: original?.redirects ?? [],
          text,
          page_ranges: original?.page_ranges ?? [],
        });
        const source = localSourceSchema.parse({
          id,
          title: v.title,
          project_id: v.project_id,
          scope: v.scope,
          owner_agent_id: null,
          audience: [],
          input_type: v.input_type,
          current_version_id: versionId,
          content_revision: 1,
          processing_state: "indexing",
          sensitivity,
          archived: false,
          collection_ids: [],
          manual_include_ids: [],
          manual_exclude_ids: [],
          tags: [],
          extraction_status: version.extraction_status,
          created_at: now,
        });
        const mutations: Mutation[] = [
          {
            kind: "source",
            entity_id: id,
            expected_revision: 0,
            data: source,
            body: `# ${source.title}\n\nExact original preserved locally.`,
            project_id: v.project_id,
          },
          {
            kind: "version",
            entity_id: versionId,
            expected_revision: 0,
            data: version,
            body: text,
            project_id: v.project_id,
          },
          {
            kind: "job",
            entity_id: jobId,
            expected_revision: 0,
            data: {
              id: jobId,
              source_id: id,
              source_version_id: versionId,
              pipeline_version: PIPELINE,
              state: "queued",
              attempt_count: 0,
              available_at: now,
              lease_digest: null,
              lease_expires_at: null,
              last_error_code: null,
            },
            body: "Deterministic normalization/chunk/index job. No inference.",
          },
        ];
        const total = c.records
          .filter((r) => r.kind === "version")
          .reduce((sum, r) => sum + Number(r.data.byte_count ?? 0), 0);
        if (total + bytes.length > 1073741824) throw new DomainError("VAULT_ADMISSION_LIMIT", 413);
        if (v.upload_id)
          mutations.push({
            kind: "upload_receipt",
            entity_id: v.upload_id,
            expected_revision: 0,
            data: {
              upload_id: v.upload_id,
              source_id: id,
              version_id: versionId,
              request_key: v.request_key,
            },
            body: "Upload consumed atomically with immutable source capture.",
          });
        return {
          mutations,
          blobs: [{ path, bytes }],
          result: { source_id: id, version_id: versionId, job_id: jobId },
        };
      },
    );
    notify();
    return result;
  }
  async function edit(actor: LocalActor, id: string, input: unknown) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = versionInput.parse(input),
      bytes = Buffer.from(v.content),
      text = normalized(bytes);
    if (bytes.length > 2097152) throw new DomainError("SOURCE_TOO_LARGE", 413);
    const result = await store.transaction(actor, v.request_key, { id, ...v }, async (c) => {
      const r = head(c, "source", id);
      expectRevision(r, v.expected_revision);
      if (r.file_digest !== v.expected_file_digest) throw new DomainError("FILE_CONFLICT");
      const source = sourceData(c, id);
      if (source.archived) throw new DomainError("SOURCE_ARCHIVED");
      const old = versionData(c, source.current_version_id),
        versionId = randomUUID(),
        jobId = randomUUID(),
        base = await store.basePath(source.project_id),
        now = new Date().toISOString(),
        path = `${base}/Attachments/${id}/${versionId}/original.md`;
      const version = localVersionSchema.parse({
        ...old,
        id: versionId,
        version: old.version + 1,
        predecessor_version_id: old.id,
        raw_sha256: sha256(bytes),
        normalized_sha256: sha256(text),
        byte_count: bytes.length,
        media_type: "text/markdown",
        original_path: path,
        captured_at: now,
        text,
        extraction_status: "text",
        page_ranges: [],
      });
      const mutations: Mutation[] = [
        sourceMutation(c, id, {
          current_version_id: versionId,
          content_revision: source.content_revision + 1,
          processing_state: "indexing",
          sensitivity: secretClasses(text).length ? "quarantined" : "clear",
          extraction_status: "text",
        }),
        {
          kind: "version",
          entity_id: versionId,
          expected_revision: 0,
          data: version,
          body: text,
          project_id: source.project_id,
        },
        {
          kind: "job",
          entity_id: jobId,
          expected_revision: 0,
          data: {
            id: jobId,
            source_id: id,
            source_version_id: versionId,
            pipeline_version: PIPELINE,
            state: "queued",
            attempt_count: 0,
            available_at: now,
            lease_digest: null,
            lease_expires_at: null,
            last_error_code: null,
          },
          body: "Index replacement version.",
        },
      ];
      for (const r of c.heads.values())
        if (["task", "job", "grant"].includes(r.kind) && r.data.source_version_id === old.id) {
          const data =
            r.kind === "grant"
              ? { ...r.data, revoked: true }
              : {
                  ...r.data,
                  state: r.kind === "task" ? "superseded" : "cancelled",
                  lease_digest: null,
                  lease_expires_at: null,
                };
          mutations.push({
            kind: r.kind,
            entity_id: r.entity_id,
            expected_revision: r.revision,
            data,
            body: "Fenced by source version replacement.",
          });
        }
      return {
        mutations,
        blobs: [{ path, bytes }],
        result: { source_id: id, version_id: versionId, job_id: jobId },
      };
    });
    notify();
    return result;
  }
  async function archive(actor: LocalActor, id: string, input: unknown, archived: boolean) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = z
      .object({ request_key: z.string(), expected_revision: z.number().int().positive() })
      .strict()
      .parse(input);
    return store.transaction(actor, v.request_key, { id, archived, ...v }, (c) => {
      expectRevision(head(c, "source", id), v.expected_revision);
      const mutations: Mutation[] = [sourceMutation(c, id, { archived })];
      if (archived)
        for (const record of c.heads.values())
          if (
            ["job", "task", "grant"].includes(record.kind) &&
            record.data.source_version_id === sourceData(c, id).current_version_id
          ) {
            if (record.kind === "grant" && record.data.revoked !== true)
              mutations.push({
                kind: "grant",
                entity_id: record.entity_id,
                expected_revision: record.revision,
                data: { ...record.data, revoked: true },
                body: "Source archived; prior processing disclosure is revoked.",
              });
            if (
              record.kind !== "grant" &&
              ["queued", "running", "awaiting_agent", "claimed"].includes(String(record.data.state))
            )
              mutations.push({
                kind: record.kind,
                entity_id: record.entity_id,
                expected_revision: record.revision,
                data: {
                  ...record.data,
                  state: "cancelled",
                  lease_digest: null,
                  lease_expires_at: null,
                },
                body: "Source archived; unfinished processing fenced.",
              });
          }
      return { mutations, result: { source_id: id, archived } };
    });
  }
  async function processJob(id: string) {
    const token = randomUUID(),
      actor: LocalActor = { kind: "worker", id };
    const claimed = await store.transaction(actor, `claim:${id}:${token}`, { id }, (c) => {
      const job = head(c, "job", id),
        source = sourceData(c, String(job.data.source_id));
      if (["completed", "cancelled", "failed"].includes(String(job.data.state)))
        return { mutations: [], result: { claimed: false } };
      if (source.archived || source.current_version_id !== job.data.source_version_id)
        return {
          mutations: [
            {
              kind: "job",
              entity_id: id,
              expected_revision: job.revision,
              data: { ...job.data, state: "cancelled", lease_digest: null, lease_expires_at: null },
              body: "Current source no longer permits this stage.",
            },
          ],
          result: { claimed: false },
        };
      if (
        job.data.state === "running" &&
        Date.parse(String(job.data.lease_expires_at)) > Date.now()
      )
        throw new DomainError("JOB_LEASE_BUSY");
      return {
        mutations: [
          {
            kind: "job",
            entity_id: id,
            expected_revision: job.revision,
            data: {
              ...job.data,
              state: "running",
              lease_digest: sha256(token),
              lease_expires_at: new Date(Date.now() + 90000).toISOString(),
              heartbeat_at: new Date().toISOString(),
            },
            body: "Bounded deterministic worker lease; no inference.",
          },
        ],
        result: { claimed: true },
      };
    });
    if (!claimed.claimed) return { job_id: id, state: "cancelled", chunks: 0 };
    const initial = await store.catalog(),
      initialJob = head(initial, "job", id),
      initialSource = sourceData(initial, String(initialJob.data.source_id)),
      initialVersion = versionData(initial, initialSource.current_version_id);
    try {
      let outputVersion = initialVersion;
      if (
        initialVersion.media_type === "application/pdf" &&
        initialVersion.extraction_status === "stored_attachment"
      ) {
        const bytes = await store.read(initialVersion.original_path);
        if (sha256(bytes) !== initialVersion.raw_sha256)
          throw new DomainError("ORIGINAL_INTEGRITY", 503);
        const extracted = await extractPdf(bytes);
        outputVersion = localVersionSchema.parse({
          ...initialVersion,
          id: stableUuid(
            `${initialVersion.id}:pdf-text-v2:${sha256(extracted.text)}:${extracted.status}`,
          ),
          version: initialVersion.version + 1,
          predecessor_version_id: initialVersion.id,
          pipeline_version: "pdf-text-v2",
          text: extracted.text,
          normalized_sha256: sha256(extracted.text),
          page_ranges: extracted.page_ranges,
          extraction_status: extracted.status,
          captured_at: new Date().toISOString(),
        });
      }
      const prepared = await compute(
        initialSource.id,
        outputVersion.id,
        outputVersion.text,
        outputVersion.pipeline_version,
      );
      return await store.transaction(
        { kind: "worker", id },
        `job:${id}:${PIPELINE}`,
        { id, version: PIPELINE },
        (c) => {
          const job = head(c, "job", id),
            source = sourceData(c, String(job.data.source_id));
          if (
            job.data.state !== "running" ||
            job.data.lease_digest !== sha256(token) ||
            Date.parse(String(job.data.lease_expires_at)) <= Date.now()
          )
            throw new DomainError("JOB_LEASE_LOST");
          if (source.archived || source.current_version_id !== job.data.source_version_id)
            return { mutations: [], result: { job_id: id, state: "cancelled", chunks: 0 } };
          const version = outputVersion,
            chunks = prepared;
          if (source.current_version_id !== initialVersion.id)
            throw new DomainError("SOURCE_VERSION_CHANGED");
          return {
            mutations: [
              {
                kind: "job",
                entity_id: id,
                expected_revision: job.revision,
                data: {
                  ...job.data,
                  state: "completed",
                  attempt_count: Number(job.data.attempt_count) + 1,
                  lease_digest: null,
                  lease_expires_at: null,
                },
                body: "Deterministic chunk/index stage complete.",
              },
              sourceMutation(c, source.id, {
                processing_state: "captured",
                ...(version.id !== initialVersion.id
                  ? {
                      current_version_id: version.id,
                      content_revision: source.content_revision + 1,
                      extraction_status: version.extraction_status,
                      sensitivity: secretClasses(`${source.title}\n${version.text}`).length
                        ? ("quarantined" as const)
                        : ("clear" as const),
                    }
                  : {}),
              }),
              ...(version.id !== initialVersion.id
                ? [
                    {
                      kind: "version" as const,
                      entity_id: version.id,
                      expected_revision: 0,
                      data: version,
                      body: version.text,
                      project_id: source.project_id,
                    },
                  ]
                : []),
            ],
            blobs: [
              {
                path: `.atlas/derived/${PIPELINE}/${version.id}/chunks.json`,
                bytes: Buffer.from(canonical(chunks)),
              },
            ],
            result: { job_id: id, state: "completed", chunks: chunks.length },
          };
        },
        (c) => {
          const job = head(c, "job", id);
          if (job.data.lease_digest !== sha256(token) || job.data.state !== "running")
            throw new DomainError("JOB_LEASE_LOST");
        },
      );
    } catch (error) {
      await store.transaction(actor, `failure:${id}:${token}`, { id }, (c) => {
        const job = head(c, "job", id);
        if (job.data.lease_digest !== sha256(token))
          return { mutations: [], result: { recorded: false } };
        const attempts = Number(job.data.attempt_count ?? 0) + 1,
          failed = attempts >= 4,
          source = sourceData(c, String(job.data.source_id));
        const mutations: Mutation[] = [
          {
            kind: "job",
            entity_id: id,
            expected_revision: job.revision,
            data: {
              ...job.data,
              state: failed ? "failed" : "queued",
              attempt_count: attempts,
              lease_digest: null,
              lease_expires_at: null,
              available_at: new Date(
                Date.now() + [5000, 30000, 120000][Math.min(attempts - 1, 2)]!,
              ).toISOString(),
              last_error_code: "LOCAL_PARSER_FAILED",
            },
            body: "Parser failed; exact original retained.",
          },
        ];
        if (failed && source.current_version_id === job.data.source_version_id)
          mutations.push(sourceMutation(c, source.id, { processing_state: "failed" }));
        return { mutations, result: { recorded: true } };
      });
      throw error;
    }
  }
  async function access(actor: LocalActor, id: string, input: unknown) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = localAudienceSchema
      .extend({ request_key: z.string(), expected_revision: z.number().int().positive() })
      .strict()
      .parse(input);
    if (v.scope === "project" && !v.project_id) throw new DomainError("PROJECT_REQUIRED", 400);
    if (v.scope === "agent_private" && !v.owner_agent_id)
      throw new DomainError("AGENT_REQUIRED", 400);
    if (v.scope === "shared_agents" && !v.audience.length)
      throw new DomainError("AUDIENCE_REQUIRED", 400);
    return store.transaction(actor, v.request_key, { id, ...v }, async (c) => {
      expectRevision(head(c, "source", id), v.expected_revision);
      if (v.project_id) await store.basePath(v.project_id);
      for (const aid of [...v.audience, ...(v.owner_agent_id ? [v.owner_agent_id] : [])])
        head(c, "agent", aid);
      return {
        mutations: [
          sourceMutation(c, id, {
            scope: v.scope,
            project_id: v.project_id,
            owner_agent_id: v.owner_agent_id,
            audience: v.audience,
          }),
        ],
        result: { source_id: id },
      };
    });
  }
  async function retry(actor: LocalActor, id: string, input: unknown) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = z
      .object({ request_key: z.string(), expected_revision: z.number().int().positive() })
      .strict()
      .parse(input);
    const result = await store.transaction(actor, v.request_key, { id, ...v }, (c) => {
      const r = head(c, "source", id),
        source = sourceData(c, id);
      expectRevision(r, v.expected_revision);
      if (source.archived || source.processing_state !== "failed")
        throw new DomainError("SOURCE_NOT_RETRYABLE");
      const jobId = randomUUID();
      return {
        mutations: [
          sourceMutation(c, id, { processing_state: "indexing" }),
          {
            kind: "job",
            entity_id: jobId,
            expected_revision: 0,
            data: {
              id: jobId,
              source_id: id,
              source_version_id: source.current_version_id,
              pipeline_version: PIPELINE,
              state: "queued",
              attempt_count: 0,
              available_at: new Date().toISOString(),
              lease_digest: null,
              lease_expires_at: null,
              last_error_code: null,
            },
            body: "Owner requested a bounded parser retry; original retained.",
          },
        ],
        result: { source_id: id, job_id: jobId },
      };
    });
    notify();
    return result;
  }
  return { capture, edit, archive, access, retry, processJob };
}
