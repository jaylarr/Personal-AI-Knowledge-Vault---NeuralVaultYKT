import { z } from "zod";
import { checkpointInputSchema, contextInputSchema } from "./agent-workflow.js";

const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const personalSourceRefSchema = z
  .object({
    host_id: z.string().regex(/^[a-z][a-z0-9-]{2,47}$/),
    session_key: sha,
    session_revision: sha,
    message_id: z.string().min(1).max(128),
    turn_id: z.string().min(1).max(128).nullable(),
    start_codepoint: z.number().int().nonnegative(),
    end_codepoint: z.number().int().positive(),
    quote_sha256: sha,
  })
  .strict()
  .refine((v) => v.end_codepoint > v.start_codepoint);
export type PersonalSourceRef = z.infer<typeof personalSourceRefSchema>;
export const knowledgeFieldsSchema = z
  .object({
    type: z.enum(["preference", "constraint", "decision", "lesson", "project_fact"]),
    scope: z.enum(["owner", "project"]),
    key: z
      .string()
      .min(3)
      .max(100)
      .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/),
    summary: z.string().trim().min(20).max(400),
    rationale: z.string().trim().min(1).max(600).optional(),
    applies_when: z.string().trim().min(10).max(600),
    exceptions: z.array(z.string().trim().min(1).max(300)).max(6).default([]),
    topics: z
      .array(z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/))
      .min(1)
      .max(8),
    basis: z.enum(["owner_explicit", "verified_observation", "historical_report", "inference"]),
    source_statement: z.string().trim().min(1).max(600).optional(),
    source_note_ids: z.array(z.uuid()).max(8).default([]),
    source_refs: z.array(personalSourceRefSchema).max(12).default([]),
  })
  .strict();
export type KnowledgeFields = z.infer<typeof knowledgeFieldsSchema>;
export function knowledgeState(k: KnowledgeFields): "active" | "candidate" {
  return k.basis === "owner_explicit" ||
    (k.basis === "verified_observation" && ["lesson", "project_fact"].includes(k.type))
    ? "active"
    : "candidate";
}
function validScope(k: KnowledgeFields) {
  return (
    (k.scope !== "owner" ||
      (["preference", "constraint"].includes(k.type) && k.basis === "owner_explicit")) &&
    (k.basis !== "owner_explicit" || Boolean(k.source_statement))
  );
}
export const knowledgeCaptureSchema = knowledgeFieldsSchema
  .extend({
    replaces: z.object({ id: z.uuid(), expected_file_digest: sha }).strict().optional(),
  })
  .refine(validScope, "Owner scope needs an explicit owner preference/constraint and statement");
export const knowledgeMetadataSchema = knowledgeFieldsSchema
  .extend({
    state: z.enum(["active", "candidate"]),
    supersedes: z.array(z.uuid()).max(1).default([]),
  })
  .refine(
    (k) => validScope(k) && k.state === knowledgeState(k),
    "Invalid knowledge scope or state",
  );
export const localCheckpointInputSchema = checkpointInputSchema
  .extend({
    knowledge: knowledgeCaptureSchema.optional(),
  })
  .superRefine((v, ctx) => {
    const k = v.knowledge;
    if (!k) return;
    if (v.kind !== (k.type === "lesson" ? "lesson" : "decision"))
      ctx.addIssue({
        code: "custom",
        message: "Knowledge requires decision/lesson kind",
        path: ["kind"],
      });
    if (v.markdown.length > 6000 || new TextEncoder().encode(v.markdown).length > 12000)
      ctx.addIssue({
        code: "custom",
        message: "Knowledge body exceeds limits",
        path: ["markdown"],
      });
    if (k.basis === "verified_observation" && v.provenance.verification.trim().length < 10)
      ctx.addIssue({
        code: "custom",
        message: "Current verification required",
        path: ["provenance"],
      });
  });
export const localContextInputSchema = contextInputSchema.extend({
  context_mode: z.enum(["knowledge", "activity"]).default("knowledge"),
  detail: z.enum(["summary", "full"]).default("summary"),
});
export type LocalCheckpointInput = z.infer<typeof localCheckpointInputSchema>;
export type LocalContextInput = z.infer<typeof localContextInputSchema>;
