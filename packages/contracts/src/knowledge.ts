import { z } from "zod";

export const knowledgeScopeSchema = z.enum([
  "personal",
  "global_development",
  "project",
  "agent_private",
  "shared_agents",
]);
export const knowledgeKindSchema = z.enum(["source", "memory", "entity", "relationship"]);
export const sourceStateSchema = z.enum([
  "capturing",
  "indexing",
  "awaiting_agent",
  "claimed",
  "review_pending",
  "organized",
  "failed",
]);
export const claimKindSchema = z.enum([
  "explicit_fact",
  "inference",
  "recommendation",
  "opinion",
  "unverified_claim",
  "historical",
  "decision",
]);
export const evidenceSchema = z
  .object({
    source_version_id: z.uuid(),
    chunk_id: z.uuid().optional(),
    start_offset: z.number().int().min(0),
    end_offset: z.number().int().min(1),
    quote_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .refine((value) => value.end_offset > value.start_offset, {
    message: "Evidence range must be nonempty",
    path: ["end_offset"],
  });
export const collectionSeedSchema = z.array(
  z
    .object({
      key: z.string().min(1),
      name: z.string().trim().min(1),
      children: z.array(z.string().trim().min(1)),
    })
    .strict(),
);
export type CollectionSeed = z.infer<typeof collectionSeedSchema>;
export const sourceVersionSchema = z
  .object({
    id: z.uuid(),
    source_id: z.uuid(),
    version: z.number().int().positive(),
    raw_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    normalized_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    byte_count: z.number().int().min(0).max(2097152),
    media_type: z.string().min(1),
    normalized_text: z.string(),
  })
  .strict();
