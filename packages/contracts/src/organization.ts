import { z } from "zod";

export const organizationStateSchema = z.enum([
  "awaiting_agent",
  "claimed",
  "submitted",
  "completed",
  "cancelled",
  "superseded",
]);
export const organizationBatchSchema = z
  .object({
    source_version_id: z.uuid(),
    expected_source_revision: z.number().int().positive(),
    contract_version: z.literal(1),
    batch_index: z.number().int().min(0),
    chunk_ids: z.array(z.uuid()).min(1).max(20),
    allowed_collection_ids: z.array(z.uuid()).max(1000),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.chunk_ids).size === value.chunk_ids.length &&
      new Set(value.allowed_collection_ids).size === value.allowed_collection_ids.length,
    { message: "Batch identifiers must be unique" },
  );
