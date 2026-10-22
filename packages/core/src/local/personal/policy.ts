import { randomUUID } from "node:crypto";
import {
  personalPolicySchema,
  personalCapabilitySchema,
  z,
  type LocalActor,
  type PersonalCapability,
} from "@atlas/contracts";
import { currentAgent } from "../authorization.js";
import { DomainError, head, sha256, type LocalStore, type Catalog } from "../transactions.js";

export const personalSecret =
  /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s]+:[^\s]+@|\b(?:sk-[A-Za-z0-9_-]{20,}|atlas_[A-Za-z0-9_-]{43})\b|(?:password|api[_-]?key|secret|access[_-]?token)\s*[=:]\s*["']?[A-Za-z0-9+/_.-]{16,}/i;
export function clearInput(input: unknown) {
  if (personalSecret.test(JSON.stringify(input)))
    throw new DomainError("SENSITIVE_PERSONAL_INPUT", 400);
}
export function suppressedOwnerKeys(c: Catalog) {
  return new Set(
    [...c.heads.values()]
      .filter(
        (r) =>
          r.kind === "settings" &&
          r.entity_id.startsWith("personal-suppression-") &&
          r.data.enabled === true,
      )
      .map((r) => String(r.data.concept_key)),
  );
}
export const ownerOnly = (actor: LocalActor) => {
  if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
};
export function createPersonalPolicy(store: LocalStore) {
  async function read() {
    const c = await store.catalog();
    if (c.incomplete) throw new DomainError("CATALOG_INTEGRITY", 503);
    const record = c.heads.get("settings:personal-policy-v1");
    return {
      ...personalPolicySchema.parse(record?.data.policy ?? {}),
      revision: record?.revision ?? 0,
    };
  }
  async function assert(actor: LocalActor, capability: PersonalCapability, hostId?: string) {
    const policy = await read();
    if (!policy.enabled || (hostId && !policy.enabled_hosts.includes(hostId)))
      throw new DomainError("PERSONAL_DISABLED", 403);
    if (actor.kind === "owner") return;
    const c = await store.catalog(),
      a = currentAgent(c, actor);
    const grant = c.heads.get(`settings:personal-grant-${a.id}`);
    if (
      !a.capabilities.includes(capability) ||
      !Array.isArray(grant?.data.capabilities) ||
      !grant.data.capabilities.includes(capability) ||
      (hostId && (!Array.isArray(grant.data.host_ids) || !grant.data.host_ids.includes(hostId)))
    )
      throw new DomainError("PERSONAL_ACCESS_DENIED", 403);
  }
  async function setting(
    actor: LocalActor,
    id: string,
    expected_revision: number,
    data: Record<string, unknown>,
    request_key: string,
  ) {
    ownerOnly(actor);
    clearInput(data);
    return store.transaction(actor, request_key, { id, expected_revision, data }, () => ({
      mutations: [
        {
          kind: "settings",
          entity_id: id,
          expected_revision,
          data,
          body: "Owner-controlled personal context settings.",
        },
      ],
      result: { id },
    }));
  }
  async function update(actor: LocalActor, input: unknown) {
    const v = z
      .object({
        policy: personalPolicySchema,
        expected_revision: z.number().int().nonnegative(),
        request_key: z.string().min(16),
      })
      .strict()
      .parse(input);
    return setting(
      actor,
      "personal-policy-v1",
      v.expected_revision,
      { policy: v.policy },
      v.request_key,
    );
  }
  async function grant(actor: LocalActor, input: unknown) {
    ownerOnly(actor);
    const v = z
      .object({
        agent_id: z.string().min(1),
        capabilities: z.array(personalCapabilitySchema).max(3),
        host_ids: z.array(z.string()).max(20),
        expected_revision: z.number().int().nonnegative(),
        request_key: z.string().min(16),
      })
      .strict()
      .parse(input);
    const c = await store.catalog();
    head(c, "agent", v.agent_id);
    return setting(
      actor,
      `personal-grant-${v.agent_id}`,
      v.expected_revision,
      { capabilities: v.capabilities, host_ids: v.host_ids },
      v.request_key,
    );
  }
  async function suppress(actor: LocalActor, input: unknown) {
    const v = z
      .object({
        concept_key: z.string().min(3).max(100),
        reason_code: z.enum(["dismissed", "excluded", "stop_using", "privacy"]),
        expected_revision: z.number().int().nonnegative(),
        request_key: z.string().min(16),
        enabled: z.boolean().default(true),
      })
      .strict()
      .parse(input);
    return setting(
      actor,
      `personal-suppression-${sha256(v.concept_key)}`,
      v.expected_revision,
      {
        concept_key: v.concept_key,
        concept_hash: sha256(v.concept_key),
        reason_code: v.reason_code,
        enabled: v.enabled,
      },
      v.request_key,
    );
  }
  async function confirmation(actor: LocalActor, input: unknown) {
    ownerOnly(actor);
    const v = z
      .object({
        request_key: z.string().min(16),
        statement: z.string().min(20).max(600),
        concept_key: z.string().min(3).max(100),
        applies_when: z.string().min(10).max(600),
        summary: z.string().min(20).max(400),
        exceptions: z.array(z.string().max(300)).max(6).default([]),
      })
      .strict()
      .parse(input);
    clearInput(v);
    const id = randomUUID();
    return store.transaction(actor, v.request_key, v, () => ({
      mutations: [
        {
          kind: "settings",
          entity_id: id,
          expected_revision: 0,
          data: { ...v, owner_confirmation: true, owner_id: actor.id },
          body: "Owner-authored confirmation. Source intent is not inferred.",
        },
      ],
      result: { id },
    }));
  }
  return { read, assert, update, grant, suppress, confirmation, setting };
}
