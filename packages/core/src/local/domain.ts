export * from "./transactions.js";
export * from "./sources.js";
export * from "./authorization.js";
export * from "./tasks.js";
export * from "./runner.js";
export * from "./retrieval.js";
export * from "./url-import.js";
export * from "./backup.js";
export * from "./organization.js";
export * from "./graph.js";
export * from "./parsers/pdf.js";
export * from "./parsers/n8n.js";
export * from "./parsers/conversation.js";

import {
  z,
  localDomainSnapshotSchema,
  localAgentSchema,
  localEvidenceSchema,
  type LocalActor,
} from "@atlas/contracts";
import type { createLocalVault } from "../local-vault.js";
import { createLocalStore, DomainError } from "./transactions.js";
import { createSourceService, evidenceStale } from "./sources.js";
import { createAuthorization, canReadRecord, type InstalledAgent } from "./authorization.js";
import { createCollaboration } from "./tasks.js";
import { createRetrieval } from "./retrieval.js";
import { createRunner, workerChunks } from "./runner.js";
import { createLocalOrganization } from "./organization.js";

export function createDomainService(
  vault: ReturnType<typeof createLocalVault>,
  installed: InstalledAgent,
) {
  const store = createLocalStore(vault),
    auth = createAuthorization(store, installed),
    tasks = createCollaboration(store),
    retrieval = createRetrieval(store);
  let wake = () => {};
  const sources = createSourceService(store, () => wake(), workerChunks),
    runner = createRunner(store, sources.processJob);
  wake = runner.wake;
  async function snapshot(actor: LocalActor) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const c = await store.catalog(),
      records = [...c.heads.values()].map((r) => {
        if (
          ["memory", "entity", "relationship"].includes(r.kind) &&
          Array.isArray(r.data.evidence) &&
          evidenceStale(c, z.array(localEvidenceSchema).parse(r.data.evidence))
        )
          return { ...r, data: { ...r.data, requires_revalidation: true } };
        return r;
      });
    const kinds = (kind: string) => records.filter((r) => r.kind === kind);
    return localDomainSnapshotSchema.parse({
      sources: kinds("source"),
      memories: kinds("memory"),
      entities: kinds("entity"),
      relationships: kinds("relationship"),
      tasks: kinds("task"),
      collections: kinds("collection"),
      reviews: kinds("review"),
      warnings: c.warnings,
      truncated: c.incomplete,
    });
  }
  async function agents(actor: LocalActor) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    await auth.bootstrap();
    const c = await store.catalog();
    return [...c.heads.values()]
      .filter((r) => r.kind === "agent")
      .map((r) => {
        const a = localAgentSchema.parse(r.data);
        const { token_digest, ...safe } = a;
        return { revision: r.revision, ...safe };
      });
  }
  async function changes(actor: LocalActor) {
    const c = await store.catalog();
    return c.records
      .filter(
        (r) =>
          ["source", "memory", "entity", "relationship"].includes(r.kind) &&
          canReadRecord(c, actor, c.heads.get(`${r.kind}:${r.entity_id}`)?.data ?? {}),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 100)
      .map((r) => ({
        id: r.id,
        item_id: r.entity_id,
        kind: r.kind,
        title: String(r.data.title ?? r.kind),
        actor: r.actor,
        at: r.created_at,
        revision: r.revision,
      }));
  }
  const organization = createLocalOrganization(store);
  return {
    store,
    auth,
    tasks,
    retrieval,
    sources,
    runner,
    organization,
    snapshot,
    agents,
    changes,
    start: runner.wake,
    close: () => {
      runner.close();
      store.close();
    },
  };
}
