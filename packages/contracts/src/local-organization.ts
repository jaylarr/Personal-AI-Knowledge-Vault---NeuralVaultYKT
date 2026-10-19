import { z } from "zod";
import { localEvidenceSchema } from "./local-domain.js";
import { claimKindSchema as claimKinds } from "./knowledge.js";
const ev = z.array(localEvidenceSchema).min(1).max(20);
export const localOrganizationSchema = z
  .object({
    contract_version: z.literal(1),
    source_version_id: z.uuid(),
    expected_source_revision: z.number().int().positive(),
    coverage_chunk_ids: z.array(z.uuid()).max(20),
    classifications: z
      .array(
        z
          .object({
            collection_id: z.string(),
            confidence: z.number().min(0).max(1),
            reason: z.string().max(600),
          })
          .strict(),
      )
      .max(30)
      .default([]),
    tags: z
      .array(z.object({ name: z.string().min(1).max(60) }).strict())
      .max(30)
      .default([]),
    memories: z
      .array(
        z
          .object({
            candidate_id: z.string().min(1).max(80),
            type: z.enum(["semantic", "procedural", "episodic", "project", "core"]),
            title: z.string().min(1).max(160),
            subject_key: z.string().min(1).max(300),
            summary: z.string().min(1).max(2000),
            structured_content: z.record(z.string(), z.unknown()),
            evidence: ev,
            claim_kind: claimKinds,
            confidence: z.number().min(0).max(1),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    entities: z
      .array(
        z
          .object({
            candidate_id: z.string(),
            canonical_key: z.string().max(300),
            title: z.string().max(160),
            entity_type: z.string().max(100),
            aliases: z.array(z.string().max(160)).max(30),
            evidence: ev,
            claim_kind: claimKinds,
            confidence: z.number().min(0).max(1),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    relationships: z
      .array(
        z
          .object({
            candidate_id: z.string(),
            from_ref: z.string(),
            to_ref: z.string(),
            type: z.enum([
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
            confidence: z.number().min(0).max(1),
          })
          .strict(),
      )
      .max(40)
      .default([]),
    source_summary: z.string().max(2000).optional(),
  })
  .strict();
