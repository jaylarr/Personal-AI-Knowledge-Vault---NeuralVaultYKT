import { z } from "zod";
import { claimKindSchema, evidenceSchema } from "./knowledge.js";

export const memoryStatusSchema = z.enum([
  "proposed",
  "verified",
  "active",
  "rejected",
  "archived",
  "superseded",
]);
export const memoryTypeSchema = z.enum(["semantic", "procedural", "episodic", "project", "core"]);
export const relationshipTypeSchema = z.enum([
  "USES",
  "DEPENDS_ON",
  "IMPLEMENTS",
  "BELONGS_TO",
  "RELATED_TO",
  "REPLACES",
  "RESOLVES",
  "DOCUMENTS",
  "REFERENCES",
]);
export const memoryCandidateSchema = z
  .object({
    type: memoryTypeSchema,
    title: z.string().trim().min(1).max(300),
    subject_key: z.string().trim().min(1).max(300),
    summary: z.string().trim().min(1).max(8000),
    structured_content: z.record(z.string(), z.unknown()),
    claim_kind: claimKindSchema,
    confidence: z.number().min(0).max(1),
    evidence: z.array(evidenceSchema).min(1).max(20),
  })
  .strict();
