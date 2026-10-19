import { z } from "zod";
const name = z.string().trim().min(1).max(160);
const revision = z.number().int().positive();
export const projectInputSchema = z
  .object({
    name,
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .max(120),
    description: z.string().max(4000).default(""),
  })
  .strict();
export const projectPatchSchema = z
  .object({
    expected_revision: revision,
    name: name.optional(),
    description: z.string().max(4000).optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.name !== undefined || v.description !== undefined || v.archived !== undefined);
export const collectionInputSchema = z
  .object({ name, parent_id: z.uuid().nullable().default(null) })
  .strict();
export const collectionPatchSchema = z
  .object({
    expected_revision: revision,
    name: name.optional(),
    parent_id: z.uuid().nullable().optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.name !== undefined || v.parent_id !== undefined || v.archived !== undefined);
export const collectionMergeSchema = z
  .object({
    target_id: z.uuid(),
    expected_revision: revision,
    target_revision: revision,
    child_conflicts: z.record(z.uuid(), z.uuid()).default({}),
  })
  .strict();
export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  revision,
  archived_at: z.iso.datetime().nullable(),
});
export const collectionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  parent_id: z.uuid().nullable(),
  revision,
  archived_at: z.iso.datetime().nullable(),
  merged_into_id: z.uuid().nullable(),
});
export const workspaceSchema = z.object({ id: z.uuid(), name: z.string(), revision });
export const ownerSessionSchema = z.object({ workspace: workspaceSchema });
export const organizationSnapshotSchema = z.object({
  workspace: workspaceSchema,
  projects: z.array(projectSchema),
  collections: z.array(collectionSchema),
});
