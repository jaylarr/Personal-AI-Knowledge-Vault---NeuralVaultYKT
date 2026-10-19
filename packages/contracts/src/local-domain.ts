import { z } from "zod";
import { relationshipTypeSchema, memoryTypeSchema } from "./memory.js";
import { claimKindSchema } from "./knowledge.js";

export const localShaSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const localRequestKeySchema = z
  .string()
  .min(16)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/);
export const localActorSchema = z
  .object({ kind: z.enum(["owner", "agent", "worker"]), id: z.string().min(1) })
  .strict();
export type LocalActor = z.infer<typeof localActorSchema>;
export const localScopeSchema = z.enum([
  "personal",
  "project",
  "global_development",
  "agent_private",
  "shared_agents",
]);
export const localAudienceSchema = z
  .object({
    scope: localScopeSchema.default("personal"),
    project_id: z.uuid().nullable().default(null),
    owner_agent_id: z.string().nullable().default(null),
    audience: z.array(z.string().min(1)).max(100).default([]),
  })
  .strict();
export type LocalAudience = z.infer<typeof localAudienceSchema>;
export const localEvidenceSchema = z
  .object({
    source_version_id: z.uuid(),
    chunk_id: z.uuid().optional(),
    start_offset: z.number().int().nonnegative(),
    end_offset: z.number().int().positive(),
    quote_sha256: localShaSchema,
  })
  .strict()
  .refine((v) => v.end_offset > v.start_offset, "Evidence must contain a nonempty span");
export type LocalEvidence = z.infer<typeof localEvidenceSchema>;
export const localChunkSchema = z
  .object({
    id: z.uuid(),
    source_id: z.uuid(),
    source_version_id: z.uuid(),
    sequence: z.number().int().nonnegative(),
    heading_path: z.array(z.string()),
    start_offset: z.number().int().nonnegative(),
    end_offset: z.number().int().nonnegative(),
    text_sha256: localShaSchema,
    estimated_units: z.number().int().nonnegative(),
    text: z.string(),
  })
  .strict();
export type LocalChunk = z.infer<typeof localChunkSchema>;
export const localSourceInputSchema = z
  .object({
    request_key: localRequestKeySchema,
    title: z.string().trim().min(1).max(160),
    project_id: z.uuid().nullable().default(null),
    scope: localScopeSchema.default("personal"),
    input_type: z
      .enum(["note", "text", "markdown", "url", "attachment", "pdf", "n8n_json", "conversation"])
      .default("note"),
    content: z.string().max(2097152).default(""),
    upload_id: z.uuid().optional(),
    selected_turn_ids: z.array(z.string().min(1).max(100)).max(1000).optional(),
    origin_url: z.string().url().optional(),
  })
  .strict();
export type LocalSourceInput = z.infer<typeof localSourceInputSchema>;
export const localSourceSchema = localAudienceSchema.extend({
  id: z.uuid(),
  title: z.string(),
  input_type: z.enum([
    "note",
    "text",
    "markdown",
    "url",
    "attachment",
    "pdf",
    "n8n_json",
    "conversation",
  ]),
  current_version_id: z.uuid(),
  content_revision: z.number().int().positive(),
  processing_state: z.enum([
    "indexing",
    "captured",
    "awaiting_agent",
    "claimed",
    "review_pending",
    "organized",
    "failed",
  ]),
  sensitivity: z.enum(["clear", "quarantined", "released_for_agent"]),
  archived: z.boolean(),
  collection_ids: z.array(z.string()),
  manual_include_ids: z.array(z.string()),
  manual_exclude_ids: z.array(z.string()),
  tags: z.array(z.string()).max(30),
  extraction_status: z.string(),
  created_at: z.string(),
});
export type LocalSource = z.infer<typeof localSourceSchema>;
export const localVersionSchema = z
  .object({
    id: z.uuid(),
    source_id: z.uuid(),
    version: z.number().int().positive(),
    predecessor_version_id: z.uuid().nullable(),
    raw_sha256: localShaSchema,
    normalized_sha256: localShaSchema,
    byte_count: z.number().int().nonnegative().max(20971520),
    media_type: z.string(),
    original_path: z.string(),
    pipeline_version: z.string(),
    captured_at: z.string(),
    extraction_status: z.string(),
    origin_url: z.string().nullable(),
    content_encoding: z.string().nullable().default(null),
    export_sha256: localShaSchema.nullable().default(null),
    redirects: z.array(z.string()).max(3).default([]),
    text: z.string(),
    page_ranges: z
      .array(
        z.object({
          page: z.number().int().positive(),
          start: z.number().int().nonnegative(),
          end: z.number().int().nonnegative(),
        }),
      )
      .default([]),
  })
  .strict();
export type LocalSourceVersion = z.infer<typeof localVersionSchema>;
export const localOperationSchema = z.enum([
  "read",
  "propose",
  "process_knowledge",
  "capture_project_knowledge",
]);
export type LocalCapability = z.infer<typeof localOperationSchema>;
export const localAgentSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(160),
    disabled: z.boolean(),
    token_digest: localShaSchema,
    token_prefix: z.string().max(12),
    issued_at: z.string(),
    expires_at: z.string(),
    revoked_at: z.string().nullable(),
    compatibility: z.boolean(),
    capabilities: z.array(localOperationSchema),
    project_ids: z.array(z.uuid()),
    scopes: z.array(localScopeSchema),
    item_ids: z.array(z.uuid()),
  })
  .strict();
export type LocalAgent = z.infer<typeof localAgentSchema>;
export const localGrantSchema = z
  .object({
    id: z.uuid(),
    agent_id: z.string(),
    source_version_id: z.uuid(),
    expires_at: z.string(),
    revoked: z.boolean(),
    collection_ids: z.array(z.string()).max(1000),
    released_quarantine: z.boolean().default(false),
  })
  .strict();
export type LocalGrant = z.infer<typeof localGrantSchema>;
export const localTaskSchema = z
  .object({
    id: z.uuid(),
    source_id: z.uuid(),
    source_version_id: z.uuid(),
    expected_source_revision: z.number().int().positive(),
    contract_version: z.literal(1),
    batch_index: z.number().int().nonnegative(),
    chunk_ids: z.array(z.uuid()).min(1).max(20),
    collection_ids: z.array(z.string()),
    agent_id: z.string(),
    grant_id: z.uuid(),
    state: z.enum([
      "awaiting_agent",
      "claimed",
      "submitted",
      "completed",
      "cancelled",
      "superseded",
    ]),
    lease_digest: localShaSchema.nullable(),
    lease_expires_at: z.string().nullable(),
    first_claimed_at: z.string().nullable(),
    delivered_chunk_ids: z.array(z.uuid()),
    submission_id: z.uuid().nullable(),
  })
  .strict();
export type LocalTask = z.infer<typeof localTaskSchema>;
export const localMemorySchema = localAudienceSchema.extend({
  id: z.uuid(),
  subject_key: z.string().min(1).max(300),
  type: memoryTypeSchema,
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(2000),
  structured_content: z.record(z.string(), z.unknown()),
  claim_kind: claimKindSchema,
  reported_confidence: z.number().min(0).max(1).nullable().default(null),
  status: z.enum(["proposed", "verified", "active", "rejected", "archived", "superseded"]),
  evidence: z.array(localEvidenceSchema).min(1).max(20),
  critical: z.boolean(),
  retrieval_level: z.enum(["core", "project", "detail"]),
  valid_from: z.string(),
  valid_to: z.string().nullable(),
  superseded_by_id: z.uuid().nullable(),
  requires_revalidation: z.boolean(),
  agent_id: z.string().nullable(),
  approved_at: z.string().nullable(),
  approved_by: z.string().nullable(),
});
export type LocalMemory = z.infer<typeof localMemorySchema>;
export const localProposalSchema = z
  .object({
    request_key: localRequestKeySchema,
    title: z.string().trim().min(1).max(160),
    type: memoryTypeSchema.default("project"),
    subject_key: z.string().trim().min(1).max(300),
    summary: z.string().trim().min(1).max(2000),
    structured_content: z.record(z.string(), z.unknown()).default({}),
    claim_kind: claimKindSchema,
    evidence: z.array(localEvidenceSchema).min(1).max(20),
    project_id: z.uuid().nullable().default(null),
    scope: localScopeSchema.default("personal"),
  })
  .strict();
export const localRelationshipSchema = localAudienceSchema.extend({
  id: z.uuid(),
  from_item_id: z.uuid(),
  to_item_id: z.uuid(),
  type: relationshipTypeSchema,
  claim_kind: claimKindSchema,
  reported_confidence: z.number().min(0).max(1).nullable().default(null),
  evidence: z.array(localEvidenceSchema).min(1).max(20),
  status: z.enum(["proposed", "active", "rejected", "archived"]),
  agent_id: z.string().nullable(),
  approved_at: z.string().nullable(),
});
export type LocalRelationship = z.infer<typeof localRelationshipSchema>;
export const localEntitySchema = localAudienceSchema.extend({
  id: z.uuid(),
  canonical_key: z.string().min(1).max(300),
  title: z.string().min(1).max(160),
  entity_type: z.string().max(100),
  aliases: z.array(z.string().max(160)).max(30),
  claim_kind: claimKindSchema.default("unverified_claim"),
  reported_confidence: z.number().min(0).max(1).nullable().default(null),
  evidence: z.array(localEvidenceSchema).min(1).max(20),
  status: z.enum(["proposed", "active", "rejected", "archived"]),
  agent_id: z.string().nullable(),
  approved_at: z.string().nullable(),
});
export type LocalEntity = z.infer<typeof localEntitySchema>;
export const localRecordKindSchema = z.enum([
  "source",
  "version",
  "memory",
  "entity",
  "relationship",
  "review",
  "agent",
  "grant",
  "task",
  "job",
  "submission",
  "collection",
  "project_metadata",
  "settings",
  "trace",
  "upload_receipt",
]);
export type LocalRecordKind = z.infer<typeof localRecordKindSchema>;
export const localRecordSchema = z
  .object({
    id: z.uuid(),
    entity_id: z.string().min(1),
    kind: localRecordKindSchema,
    revision: z.number().int().positive(),
    previous_id: z.uuid().nullable(),
    previous_digest: localShaSchema.nullable(),
    transaction_id: z.uuid(),
    actor: localActorSchema,
    created_at: z.string(),
    data: z.record(z.string(), z.unknown()),
    body: z.string(),
    path: z.string(),
    file_digest: localShaSchema,
  })
  .strict();
export type LocalDomainRecord = z.infer<typeof localRecordSchema>;
export const localDomainSnapshotSchema = z.object({
  sources: z.array(localRecordSchema),
  memories: z.array(localRecordSchema),
  entities: z.array(localRecordSchema),
  relationships: z.array(localRecordSchema),
  tasks: z.array(localRecordSchema),
  collections: z.array(localRecordSchema),
  reviews: z.array(localRecordSchema),
  warnings: z.array(z.string()),
  truncated: z.boolean(),
});
export const localRetrievalInputSchema = z
  .object({
    query: z.string().max(2000).default(""),
    project_id: z.uuid().optional(),
    collection_id: z.string().optional(),
    memory_types: z.array(memoryTypeSchema).optional(),
    detail: z.enum(["minimal", "balanced", "detailed"]).default("balanced"),
    token_budget: z.number().int().min(256).max(8192).default(2048),
    include_history: z.boolean().default(false),
    depth: z.number().int().min(0).max(2).default(0),
    continuation: z.string().max(300).optional(),
  })
  .strict();
export const localContextPacketSchema = z
  .object({
    schema_version: z.literal(1),
    trace_id: z.uuid(),
    mode: z.literal("lexical_graph"),
    items: z.array(
      z
        .object({
          id: z.string(),
          type: z.string(),
          title: z.string(),
          summary: z.string(),
          status: z.string(),
          critical: z.boolean(),
          source_refs: z.array(localEvidenceSchema),
        })
        .strict(),
    ),
    warnings: z.array(z.string()),
    has_more: z.boolean(),
    continuation: z.string().nullable(),
    budget: z
      .object({
        requested: z.number(),
        used: z.number(),
        measure: z.literal("utf8_conservative_estimate_v1"),
      })
      .strict(),
  })
  .strict();
export type LocalContextPacket = z.infer<typeof localContextPacketSchema>;
