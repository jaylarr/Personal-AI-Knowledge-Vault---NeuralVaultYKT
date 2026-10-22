import { z } from "zod";
export { z } from "zod";
export * from "./local-knowledge.js";
export * from "./local-domain.js";
export * from "./local-organization.js";
export type { LocalNote } from "./local-vault.js";
export { localNoteSchema, localSnapshotSchema, localContextSchema } from "./local-vault.js";
export {
  ensureRepositorySchema,
  checkpointInputSchema,
  contextInputSchema,
  checkpointSchema,
  projectContextSchema,
} from "./agent-workflow.js";

export const setupCodeSchema = z.enum([
  "DATABASE_NOT_CONFIGURED",
  "WORKER_DATABASE_NOT_CONFIGURED",
  "AUTH_NOT_CONFIGURED",
  "OWNER_NOT_BOUND",
  "STORAGE_NOT_CONFIGURED",
  "LIVE_SETUP_NOT_VERIFIED",
]);
export const healthSchema = z.object({
  status: z.literal("alive"),
  service: z.literal("atlas-api"),
});
export const readinessSchema = z.object({
  status: z.literal("setup_required"),
  codes: z.array(setupCodeSchema),
});
export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    request_id: z.string().uuid(),
  }),
});
export const scopeSchema = z.enum([
  "personal",
  "global_development",
  "project",
  "agent_private",
  "shared_agents",
]);
export {
  memoryTypeSchema,
  memoryStatusSchema,
  relationshipTypeSchema,
  memoryCandidateSchema,
} from "./memory.js";
export {
  evidenceSchema,
  sourceVersionSchema,
  collectionSeedSchema,
  knowledgeKindSchema,
  knowledgeScopeSchema,
  sourceStateSchema,
  claimKindSchema,
} from "./knowledge.js";
export type { CollectionSeed } from "./knowledge.js";
export { organizationStateSchema, organizationBatchSchema } from "./organization.js";
export const principalSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("human"),
      userId: z.uuid(),
      issuer: z.string().url(),
      subject: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("agent"),
      agentId: z.uuid(),
      credentialId: z.uuid(),
      workspaceId: z.uuid(),
    })
    .strict(),
]);
export type Principal = z.infer<typeof principalSchema>;
export type Readiness = z.infer<typeof readinessSchema>;
export type SetupCode = z.infer<typeof setupCodeSchema>;

export const LIMITS = Object.freeze({
  sourceBytes: 2 * 1024 * 1024,
  submissionBytes: 256 * 1024,
  chunksPerTask: 20,
  contextBudgetMin: 256,
  contextBudgetMax: 8192,
  contextBudgetDefault: 2048,
});
export {
  projectInputSchema,
  projectPatchSchema,
  collectionInputSchema,
  collectionPatchSchema,
  collectionMergeSchema,
  projectSchema,
  collectionSchema,
  workspaceSchema,
  ownerSessionSchema,
  organizationSnapshotSchema,
} from "./workspace.js";
export * from "./directory-import.js";
export * from "./conversation-import.js";
export * from "./personal-memory.js";
