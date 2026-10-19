import { randomUUID } from "node:crypto";
import { z, type LocalActor } from "@atlas/contracts";
import {
  DomainError,
  sha256,
  head,
  expectRevision,
  type LocalStore,
  type Mutation,
} from "./transactions.js";
import { sourceData, sourceMutation } from "./sources.js";

const collectionSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(160),
    parent_id: z.uuid().nullable(),
    archived: z.boolean(),
    merged_into_id: z.uuid().nullable(),
  })
  .strict();
export function createLocalOrganization(store: LocalStore) {
  async function seedCollections() {
    const c = await store.catalog();
    if (c.heads.has("settings:collection-seed-v1")) return;
    let raw = "";
    try {
      raw = (await store.read("Collections.md")).toString();
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      throw e;
    }
    const collections = [
      ...raw.matchAll(
        /^- (.+) — id: ([0-9a-f-]{36}); parent: ([0-9a-f-]{36}|root)(; archived: .+)?$/gm,
      ),
    ].map((m) =>
      collectionSchema.parse({
        id: m[2],
        name: m[1],
        parent_id: m[3] === "root" ? null : m[3],
        archived: Boolean(m[4]),
        merged_into_id: null,
      }),
    );
    if (!collections.length) return;
    await store.transaction(
      { kind: "owner", id: "local-import" },
      "seed:local:collections:v1",
      { original_sha256: sha256(raw) },
      () => ({
        mutations: [
          ...collections.map((data) => ({
            kind: "collection" as const,
            entity_id: data.id,
            expected_revision: 0,
            data,
            body: `# ${data.name}\n\nPreserved collection identity from [[Collections]].`,
          })),
          {
            kind: "settings",
            entity_id: "collection-seed-v1",
            expected_revision: 0,
            data: { original_sha256: sha256(raw) },
            body: "Historical collection catalog preserved without rewriting the original.",
          },
        ],
        result: { collections: collections.length },
      }),
    );
  }
  async function snapshot() {
    await seedCollections();
    const c = await store.catalog(),
      legacy = await store.vault.snapshot();
    const projects = legacy.notes
      .filter((n) => n.kind === "project")
      .map((n) => {
        const r = c.heads.get(`project_metadata:${n.id}`);
        return {
          id: n.id,
          name: String(r?.data.name ?? n.title),
          description: String(r?.data.description ?? ""),
          archived: r?.data.archived === true || n.archived,
          revision: r?.revision ?? 0,
          repository_digest: n.repository_digest,
        };
      });
    const collections = [...c.heads.values()]
      .filter((r) => r.kind === "collection")
      .map((r) => ({ ...collectionSchema.parse(r.data), revision: r.revision }));
    return { projects, collections };
  }
  async function createProject(actor: LocalActor, input: unknown) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = z
      .object({
        request_key: z.string(),
        name: z.string().trim().min(1).max(160),
        description: z.string().max(2000).default(""),
      })
      .strict()
      .parse(input);
    const project = await store.vault.ensure({
      repository_digest: sha256(`manual-project:${v.request_key}`),
      name: v.name,
    });
    return store.transaction(actor, v.request_key, v, () => ({
      mutations: [
        {
          kind: "project_metadata",
          entity_id: project.id,
          expected_revision: 0,
          data: {
            id: project.id,
            name: v.name,
            description: v.description,
            archived: false,
            manual: true,
          },
          body: `# ${v.name}\n\n${v.description}`,
        },
      ],
      result: { project_id: project.id },
    }));
  }
  async function updateProject(actor: LocalActor, id: string, input: unknown) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = z
      .object({
        request_key: z.string(),
        expected_revision: z.number().int().nonnegative(),
        name: z.string().trim().min(1).max(160).optional(),
        description: z.string().max(2000).optional(),
        archived: z.boolean().optional(),
      })
      .strict()
      .parse(input);
    const legacy = (await store.vault.snapshot()).notes.find(
      (n) => n.kind === "project" && n.id === id,
    );
    if (!legacy) throw new DomainError("NOT_FOUND", 404);
    return store.transaction(actor, v.request_key, { id, ...v }, (c) => {
      const prior = c.heads.get(`project_metadata:${id}`);
      if ((prior?.revision ?? 0) !== v.expected_revision)
        throw new DomainError("REVISION_CONFLICT");
      const data = {
        id,
        name: v.name ?? prior?.data.name ?? legacy.title,
        description: v.description ?? prior?.data.description ?? "",
        archived: v.archived ?? prior?.data.archived ?? legacy.archived,
      };
      return {
        mutations: [
          {
            kind: "project_metadata",
            entity_id: id,
            expected_revision: v.expected_revision,
            data,
            body: `# ${data.name}\n\n${data.description}`,
          },
        ],
        result: { project_id: id },
      };
    });
  }
  async function collection(actor: LocalActor, input: unknown, id?: string) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    await seedCollections();
    const v = z
      .object({
        request_key: z.string(),
        expected_revision: z.number().int().nonnegative().default(0),
        name: z.string().trim().min(1).max(160),
        parent_id: z.uuid().nullable().default(null),
        archived: z.boolean().default(false),
      })
      .strict()
      .parse(input);
    const entityId = id ?? randomUUID();
    return store.transaction(actor, v.request_key, { id: id ?? null, ...v }, (c) => {
      const prior = c.heads.get(`collection:${entityId}`);
      if ((prior?.revision ?? 0) !== v.expected_revision)
        throw new DomainError("REVISION_CONFLICT");
      if (v.parent_id) {
        const parent = head(c, "collection", v.parent_id);
        if (parent.data.archived || parent.data.merged_into_id)
          throw new DomainError("INVALID_COLLECTION_PARENT");
      }
      let parent = v.parent_id;
      const seen = new Set<string>();
      while (parent) {
        if (parent === entityId || seen.has(parent)) throw new DomainError("COLLECTION_CYCLE", 400);
        seen.add(parent);
        parent = collectionSchema.parse(head(c, "collection", parent).data).parent_id;
      }
      if (
        [...c.heads.values()].some(
          (r) =>
            r.kind === "collection" &&
            r.entity_id !== entityId &&
            r.data.archived !== true &&
            r.data.parent_id === v.parent_id &&
            String(r.data.name).toLocaleLowerCase() === v.name.toLocaleLowerCase(),
        )
      )
        throw new DomainError("COLLECTION_NAME_CONFLICT");
      const data = collectionSchema.parse({
        id: entityId,
        name: v.name,
        parent_id: v.parent_id,
        archived: v.archived,
        merged_into_id: null,
      });
      return {
        mutations: [
          {
            kind: "collection",
            entity_id: entityId,
            expected_revision: v.expected_revision,
            data,
            body: `# ${data.name}`,
          },
        ],
        result: { collection_id: entityId },
      };
    });
  }
  async function merge(actor: LocalActor, id: string, input: unknown) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = z
      .object({
        request_key: z.string(),
        expected_revision: z.number().int().positive(),
        target_id: z.uuid(),
        expected_target_revision: z.number().int().positive(),
        child_conflicts: z.record(z.string(), z.uuid()).default({}),
        membership_conflicts: z.record(z.string(), z.enum(["include", "exclude"])).default({}),
      })
      .strict()
      .parse(input);
    return store.transaction(actor, v.request_key, { id, ...v }, (c) => {
      const source = head(c, "collection", id),
        target = head(c, "collection", v.target_id);
      expectRevision(source, v.expected_revision);
      expectRevision(target, v.expected_target_revision);
      if (id === v.target_id || source.data.archived || target.data.archived)
        throw new DomainError("INVALID_MERGE", 400);
      const replacements = new Map<string, string>(),
        mutations: Mutation[] = [];
      function mergePair(from: string, to: string) {
        if (from === to || replacements.has(from)) throw new DomainError("MERGE_CYCLE", 400);
        const f = head(c, "collection", from),
          t = head(c, "collection", to);
        let parent = collectionSchema.parse(t.data).parent_id;
        while (parent) {
          if (parent === from) throw new DomainError("MERGE_DESCENDANT", 400);
          parent = collectionSchema.parse(head(c, "collection", parent).data).parent_id;
        }
        replacements.set(from, to);
        const children = [...c.heads.values()].filter(
          (r) => r.kind === "collection" && r.data.parent_id === from && !r.data.archived,
        );
        for (const child of children) {
          const collision = [...c.heads.values()].find(
            (r) =>
              r.kind === "collection" &&
              r.data.parent_id === to &&
              !r.data.archived &&
              String(r.data.name).toLocaleLowerCase() ===
                String(child.data.name).toLocaleLowerCase(),
          );
          if (collision) {
            if (v.child_conflicts[child.entity_id] !== collision.entity_id)
              throw new DomainError("EXPLICIT_CHILD_MAPPING_REQUIRED");
            mergePair(child.entity_id, collision.entity_id);
          } else
            mutations.push({
              kind: "collection",
              entity_id: child.entity_id,
              expected_revision: child.revision,
              data: { ...child.data, parent_id: to },
              body: child.body,
            });
        }
        mutations.push({
          kind: "collection",
          entity_id: from,
          expected_revision: f.revision,
          data: { ...f.data, archived: true, merged_into_id: to },
          body: f.body,
        });
      }
      mergePair(id, v.target_id);
      for (const r of c.heads.values())
        if (r.kind === "source") {
          const s = sourceData(c, r.entity_id);
          if (
            ![...s.collection_ids, ...s.manual_include_ids, ...s.manual_exclude_ids].some((x) =>
              replacements.has(x),
            )
          )
            continue;
          const replace = (values: string[]) => [
            ...new Set(values.map((x) => replacements.get(x) ?? x)),
          ];
          let include = replace(s.manual_include_ids),
            exclude = replace(s.manual_exclude_ids);
          const overlap = include.filter((x) => exclude.includes(x));
          if (overlap.length) {
            const decision = v.membership_conflicts[s.id];
            if (!decision) throw new DomainError("EXPLICIT_MEMBERSHIP_MAPPING_REQUIRED");
            if (decision === "include") exclude = exclude.filter((x) => !overlap.includes(x));
            else include = include.filter((x) => !overlap.includes(x));
          }
          mutations.push(
            sourceMutation(c, s.id, {
              collection_ids: replace(s.collection_ids).filter((x) => !exclude.includes(x)),
              manual_include_ids: include,
              manual_exclude_ids: exclude,
            }),
          );
        }
      return { mutations, result: { merged_id: id, target_id: v.target_id } };
    });
  }
  async function mergePreview(id: string, targetId: string) {
    z.uuid().parse(id);
    z.uuid().parse(targetId);
    const c = await store.catalog(),
      replacements = new Map<string, string>(),
      children: {
        source_id: string;
        source_name: string;
        target_id: string;
        target_name: string;
      }[] = [];
    function visit(from: string, to: string) {
      if (from === to || replacements.has(from)) throw new DomainError("MERGE_CYCLE", 400);
      const source = head(c, "collection", from),
        target = head(c, "collection", to);
      if (source.data.archived || target.data.archived) throw new DomainError("INVALID_MERGE", 400);
      let parent = collectionSchema.parse(target.data).parent_id;
      while (parent) {
        if (parent === from) throw new DomainError("MERGE_DESCENDANT", 400);
        parent = collectionSchema.parse(head(c, "collection", parent).data).parent_id;
      }
      replacements.set(from, to);
      for (const child of c.heads.values())
        if (child.kind === "collection" && child.data.parent_id === from && !child.data.archived) {
          const collision = [...c.heads.values()].find(
            (r) =>
              r.kind === "collection" &&
              r.data.parent_id === to &&
              !r.data.archived &&
              String(r.data.name).toLocaleLowerCase() ===
                String(child.data.name).toLocaleLowerCase(),
          );
          if (collision) {
            children.push({
              source_id: child.entity_id,
              source_name: String(child.data.name),
              target_id: collision.entity_id,
              target_name: String(collision.data.name),
            });
            visit(child.entity_id, collision.entity_id);
          }
        }
    }
    visit(id, targetId);
    const memberships = [...c.heads.values()]
      .filter((r) => r.kind === "source")
      .flatMap((r) => {
        const s = sourceData(c, r.entity_id),
          replace = (v: string[]) => v.map((x) => replacements.get(x) ?? x);
        return replace(s.manual_include_ids).some((x) => replace(s.manual_exclude_ids).includes(x))
          ? [{ source_id: s.id, title: s.title }]
          : [];
      });
    return { children, memberships };
  }
  async function organize(actor: LocalActor, id: string, input: unknown) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = z
      .object({
        request_key: z.string(),
        expected_revision: z.number().int().positive(),
        include: z.array(z.uuid()).max(30).default([]),
        exclude: z.array(z.uuid()).max(30).default([]),
        tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
      })
      .strict()
      .parse(input);
    if (v.include.some((x) => v.exclude.includes(x)))
      throw new DomainError("MEMBERSHIP_CONFLICT", 400);
    return store.transaction(actor, v.request_key, { id, ...v }, (c) => {
      expectRevision(head(c, "source", id), v.expected_revision);
      const source = sourceData(c, id);
      for (const cid of [...v.include, ...v.exclude]) {
        const r = head(c, "collection", cid);
        if (r.data.archived || r.data.merged_into_id)
          throw new DomainError("COLLECTION_UNAVAILABLE");
      }
      return {
        mutations: [
          sourceMutation(c, id, {
            collection_ids: [...new Set([...source.collection_ids, ...v.include])].filter(
              (x) => !v.exclude.includes(x),
            ),
            manual_include_ids: v.include,
            manual_exclude_ids: v.exclude,
            tags: [...new Set(v.tags)],
            processing_state: ["awaiting_agent", "claimed", "review_pending"].includes(
              source.processing_state,
            )
              ? source.processing_state
              : "organized",
          }),
        ],
        result: { source_id: id },
      };
    });
  }
  async function settings(actor: LocalActor, input: unknown) {
    if (actor.kind !== "owner") throw new DomainError("OWNER_REQUIRED", 403);
    const v = z
      .object({
        request_key: z.string(),
        expected_revision: z.number().int().nonnegative(),
        auto_classify: z.boolean(),
      })
      .strict()
      .parse(input);
    return store.transaction(actor, v.request_key, v, (c) => {
      const r = c.heads.get("settings:workspace");
      if ((r?.revision ?? 0) !== v.expected_revision) throw new DomainError("REVISION_CONFLICT");
      return {
        mutations: [
          {
            kind: "settings",
            entity_id: "workspace",
            expected_revision: v.expected_revision,
            data: {
              auto_classify: v.auto_classify,
              default_agent_processing: false,
              raw_query_logging: false,
            },
            body: "Owner processing policy. Private sources still need a named selected-version grant.",
          },
        ],
        result: { saved: true },
      };
    });
  }
  return {
    snapshot,
    seedCollections,
    createProject,
    updateProject,
    collection,
    merge,
    mergePreview,
    organize,
    settings,
  };
}
