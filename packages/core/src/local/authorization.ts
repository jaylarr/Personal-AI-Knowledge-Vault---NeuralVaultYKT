import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  localAgentSchema,
  localAudienceSchema,
  localEvidenceSchema,
  z,
  type LocalActor,
  type LocalAgent,
  type LocalAudience,
  type LocalCapability,
  type LocalEvidence,
  type LocalNote,
} from "@atlas/contracts";
import { DomainError, head, sha256, type Catalog, type LocalStore } from "./transactions.js";
import { versionData, sourceData } from "./sources.js";

export type InstalledAgent = { id: string; token?: string; expires_at?: string };
export function currentAgent(c: Catalog, actor: LocalActor): LocalAgent {
  if (c.incomplete) throw new DomainError("CATALOG_INTEGRITY", 503);
  if (actor.kind !== "agent") throw new DomainError("AGENT_REQUIRED", 403);
  const a = localAgentSchema.parse(head(c, "agent", actor.id).data);
  if (
    a.disabled ||
    a.revoked_at ||
    !Number.isFinite(Date.parse(a.expires_at)) ||
    Date.parse(a.expires_at) <= Date.now()
  )
    throw new DomainError("AGENT_ACCESS_DENIED", 403);
  return a;
}
export function canRead(
  c: Catalog,
  actor: LocalActor,
  audience: LocalAudience,
  capability: LocalCapability = "read",
) {
  if (actor.kind === "owner") return true;
  if (actor.kind !== "agent") return false;
  if (
    audience.project_id &&
    c.heads.get(`project_metadata:${audience.project_id}`)?.data.archived === true
  )
    return false;
  const a = currentAgent(c, actor);
  if (!a.capabilities.includes(capability)) return false;
  if (audience.scope === "personal") return false;
  if (audience.scope === "project")
    return Boolean(audience.project_id && a.project_ids.includes(audience.project_id));
  if (audience.scope === "agent_private")
    return audience.owner_agent_id === a.id && a.scopes.includes("agent_private");
  if (audience.scope === "shared_agents")
    return audience.audience.includes(a.id) && a.scopes.includes("shared_agents");
  return a.scopes.includes("global_development");
}
export function assertRead(
  c: Catalog,
  actor: LocalActor,
  data: Record<string, unknown>,
  capability: LocalCapability = "read",
) {
  const audience = localAudienceSchema.parse({
    scope: data.scope,
    project_id: data.project_id,
    owner_agent_id: data.owner_agent_id,
    audience: data.audience,
  });
  if (!canRead(c, actor, audience, capability)) throw new DomainError("NOT_FOUND", 404);
  if (
    data.archived === true ||
    (data.sensitivity !== undefined && data.sensitivity !== "clear" && actor.kind !== "owner")
  )
    throw new DomainError("NOT_FOUND", 404);
}
export function assertEvidenceRead(c: Catalog, actor: LocalActor, evidence: LocalEvidence[]) {
  for (const e of evidence) {
    const version = versionData(c, e.source_version_id);
    assertRead(c, actor, sourceData(c, version.source_id));
  }
}
export function canReadRecord(c: Catalog, actor: LocalActor, data: Record<string, unknown>) {
  try {
    assertRead(c, actor, data);
    if (Array.isArray(data.evidence))
      assertEvidenceRead(c, actor, z.array(localEvidenceSchema).parse(data.evidence));
    return true;
  } catch {
    return false;
  }
}
export function canReadKnowledge(c: Catalog, actor: LocalActor, note: LocalNote) {
  if (actor.kind === "owner") return true;
  if (actor.kind !== "agent") return false;
  const agent = currentAgent(c, actor);
  if (note.personal_kind) return false;
  if (note.personal_only) {
    const grant = c.heads.get(`settings:personal-grant-${agent.id}`);
    const policy = c.heads.get("settings:personal-policy-v1")?.data.policy as
      | { enabled?: boolean }
      | undefined;
    if (
      !policy?.enabled ||
      !agent.capabilities.includes("read_personal_memory") ||
      !Array.isArray(grant?.data.capabilities) ||
      !grant.data.capabilities.includes("read_personal_memory")
    )
      return false;
  }
  return (
    agent.capabilities.includes("read") &&
    (note.knowledge?.scope === "owner" ||
      (agent.project_ids.includes(note.project_id ?? "") &&
        c.heads.get(`project_metadata:${note.project_id}`)?.data.archived !== true))
  );
}
const createAgentInput = z
  .object({
    request_key: z.string(),
    name: z.string().trim().min(1).max(160),
    expires_at: z.string().datetime(),
    capabilities: z
      .array(
        z.enum([
          "read",
          "propose",
          "process_knowledge",
          "read_personal_memory",
          "capture_personal_memory",
          "review_personal_sessions",
        ]),
      )
      .default([]),
    project_ids: z.array(z.uuid()).default([]),
    scopes: z.array(z.enum(["global_development", "agent_private", "shared_agents"])).default([]),
  })
  .strict();
export function createAuthorization(store: LocalStore, installed: InstalledAgent) {
  async function bootstrap() {
    if (!installed.token) return;
    const c = await store.catalog();
    if (c.heads.has(`agent:${installed.id}`)) return;
    const tokenDigest = sha256(installed.token),
      expires = installed.expires_at ?? "2100-01-01T00:00:00.000Z";
    await store.transaction(
      { kind: "owner", id: "local-installation" },
      `bootstrap:${installed.id}`,
      { id: installed.id, token_digest: tokenDigest, expires },
      () => ({
        mutations: [
          {
            kind: "agent",
            entity_id: installed.id,
            expected_revision: 0,
            data: localAgentSchema.parse({
              id: installed.id,
              name: "Installed Codex workflow",
              disabled: false,
              token_digest: tokenDigest,
              token_prefix: installed.token?.slice(0, 10) ?? "",
              issued_at: new Date().toISOString(),
              expires_at: expires,
              revoked_at: null,
              compatibility: true,
              capabilities: [
                "capture_project_knowledge",
                "read_personal_memory",
                "capture_personal_memory",
                "review_personal_sessions",
              ],
              project_ids: [],
              scopes: [],
              item_ids: [],
            }),
            body: "Existing installed workflow credential. No imported-source access granted.",
          },
        ],
        result: { agent_id: installed.id },
      }),
    );
  }
  async function authenticate(token: string | undefined) {
    if (!token || !/^atlas_[A-Za-z0-9_-]{43}$/.test(token))
      throw new DomainError("AGENT_ACCESS_DENIED", 403);
    await bootstrap();
    const c = await store.catalog(),
      hash = Buffer.from(sha256(token), "hex");
    for (const r of c.heads.values())
      if (r.kind === "agent") {
        const a = localAgentSchema.parse(r.data);
        if (timingSafeEqual(hash, Buffer.from(a.token_digest, "hex"))) {
          if (sha256(await store.read(r.path)) !== r.file_digest)
            throw new DomainError("AGENT_ACCESS_DENIED", 403);
          const actor: LocalActor = { kind: "agent", id: a.id };
          currentAgent(c, actor);
          return actor;
        }
      }
    throw new DomainError("AGENT_ACCESS_DENIED", 403);
  }
  async function create(actor: LocalActor, input: unknown) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = createAgentInput.parse(input);
    if (Date.parse(v.expires_at) <= Date.now()) throw new DomainError("INVALID_EXPIRY", 400);
    const token = `atlas_${randomBytes(32).toString("base64url")}`,
      id = randomUUID();
    const result = await store.transaction(actor, v.request_key, v, () => ({
      mutations: [
        {
          kind: "agent",
          entity_id: id,
          expected_revision: 0,
          data: localAgentSchema.parse({
            id,
            name: v.name,
            disabled: false,
            token_digest: sha256(token),
            token_prefix: token.slice(0, 10),
            issued_at: new Date().toISOString(),
            expires_at: v.expires_at,
            revoked_at: null,
            compatibility: false,
            capabilities: v.capabilities,
            project_ids: v.project_ids,
            scopes: v.scopes,
            item_ids: [],
          }),
          body: `# ${v.name}\n\nOwner-created API identity; filesystem access remains separate.`,
        },
      ],
      result: { agent_id: id },
    }));
    const a = localAgentSchema.parse(
      head(await store.catalog(), "agent", String(result.agent_id)).data,
    );
    return {
      ...result,
      token: a.token_digest === sha256(token) ? token : null,
      replayed: a.token_digest !== sha256(token),
    };
  }
  async function update(actor: LocalActor, id: string, input: unknown) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = z
      .object({
        request_key: z.string(),
        expected_revision: z.number().int().positive(),
        disabled: z.boolean().optional(),
        revoke: z.boolean().optional(),
        capabilities: z
          .array(
            z.enum([
              "read",
              "propose",
              "process_knowledge",
              "capture_project_knowledge",
              "read_personal_memory",
              "capture_personal_memory",
              "review_personal_sessions",
            ]),
          )
          .optional(),
        project_ids: z.array(z.uuid()).optional(),
        scopes: z
          .array(
            z.enum(["personal", "project", "global_development", "agent_private", "shared_agents"]),
          )
          .optional(),
      })
      .strict()
      .parse(input);
    return store.transaction(actor, v.request_key, { id, ...v }, (c) => {
      const r = head(c, "agent", id);
      if (r.revision !== v.expected_revision) throw new DomainError("REVISION_CONFLICT");
      const a = localAgentSchema.parse({
        ...r.data,
        ...(v.disabled !== undefined ? { disabled: v.disabled } : {}),
        ...(v.revoke ? { revoked_at: new Date().toISOString() } : {}),
        ...(v.capabilities ? { capabilities: v.capabilities } : {}),
        ...(v.project_ids ? { project_ids: v.project_ids } : {}),
        ...(v.scopes ? { scopes: v.scopes } : {}),
      });
      return {
        mutations: [
          {
            kind: "agent",
            entity_id: id,
            expected_revision: r.revision,
            data: a,
            body: "Owner changed or revoked API permissions. Previously delivered text cannot be recalled.",
          },
        ],
        result: { agent_id: id },
      };
    });
  }
  return { bootstrap, authenticate, create, update };
}
