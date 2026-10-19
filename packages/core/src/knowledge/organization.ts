import { createHash, randomUUID } from "node:crypto";
import { z, projectSchema, collectionSchema, workspaceSchema } from "@atlas/contracts";
import type { PoolClient } from "pg";
import type { OwnerContext } from "../auth/owner.js";

export class DomainError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_INPUT",
    readonly status: 404 | 409 | 400,
  ) {
    super(code);
  }
}
const projectColumns = "id,name,slug,description,revision,archived_at";
const collectionColumns = "id,name,parent_id,revision,archived_at,merged_into_id";
const serialize = (row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
  );
export async function readWorkspace(c: PoolClient, w: string) {
  const r = await c.query("SELECT id,name,revision FROM atlas.workspaces WHERE id=$1", [w]);
  if (!r.rows[0]) throw new DomainError("NOT_FOUND", 404);
  return workspaceSchema.parse(r.rows[0]);
}
export async function listProjects(c: PoolClient, w: string) {
  return z
    .array(projectSchema)
    .parse(
      (
        await c.query(
          `SELECT ${projectColumns} FROM atlas.projects WHERE workspace_id=$1 ORDER BY name,id`,
          [w],
        )
      ).rows.map(serialize),
    );
}
export async function listCollections(c: PoolClient, w: string) {
  return z
    .array(collectionSchema)
    .parse(
      (
        await c.query(
          `SELECT ${collectionColumns} FROM atlas.collections WHERE workspace_id=$1 ORDER BY normalized_name,id`,
          [w],
        )
      ).rows.map(serialize),
    );
}

export async function organizationMutation<T>(
  c: PoolClient,
  owner: OwnerContext,
  route: string,
  key: string,
  payload: unknown,
  work: () => Promise<T>,
): Promise<T> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(key)) throw new DomainError("INVALID_INPUT", 400);
  const locked = await c.query("SELECT id FROM atlas.workspaces WHERE id=$1 FOR UPDATE", [
    owner.workspaceId,
  ]);
  if (!locked.rowCount) throw new DomainError("NOT_FOUND", 404);
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const args = [owner.workspaceId, owner.principal.userId, route, key];
  const prior = await c.query(
    "SELECT request_hash,response_reference FROM atlas.idempotency_requests WHERE workspace_id=$1 AND principal_id=$2 AND route=$3 AND key=$4",
    args,
  );
  if (prior.rows[0]) {
    if (prior.rows[0].request_hash !== hash) throw new DomainError("CONFLICT", 409);
    return prior.rows[0].response_reference as T;
  }
  const response = await work();
  await c.query(
    "INSERT INTO atlas.idempotency_requests(workspace_id,principal_kind,principal_id,route,key,request_hash,response_reference,created_by_user_id) VALUES($1,'human',$2,$3,$4,$5,$6,$2)",
    [...args, hash, JSON.stringify(response)],
  );
  return response;
}
async function audit(c: PoolClient, o: OwnerContext, action: string) {
  await c.query(
    "INSERT INTO atlas.activity_events(workspace_id,actor_kind,user_id,action,correlation_id,created_by_user_id) VALUES($1,'human',$2,$3,$4,$2)",
    [o.workspaceId, o.principal.userId, action, randomUUID()],
  );
}
export async function createProject(
  c: PoolClient,
  o: OwnerContext,
  v: { name: string; slug: string; description: string },
) {
  const r = await c.query(
    `INSERT INTO atlas.projects(workspace_id,name,slug,description,created_by_user_id) VALUES($1,$2,$3,$4,$5) RETURNING ${projectColumns}`,
    [o.workspaceId, v.name, v.slug, v.description, o.principal.userId],
  );
  await audit(c, o, "project.created");
  return projectSchema.parse(serialize(r.rows[0]));
}
export async function patchProject(
  c: PoolClient,
  o: OwnerContext,
  id: string,
  v: {
    expected_revision: number;
    name?: string | undefined;
    description?: string | undefined;
    archived?: boolean | undefined;
  },
) {
  const existing = await c.query(
    "SELECT revision FROM atlas.projects WHERE workspace_id=$1 AND id=$2",
    [o.workspaceId, id],
  );
  if (!existing.rows[0]) throw new DomainError("NOT_FOUND", 404);
  const r = await c.query(
    `UPDATE atlas.projects SET name=coalesce($4,name),description=coalesce($5,description),archived_at=CASE WHEN $6::boolean IS NULL THEN archived_at WHEN $6 THEN coalesce(archived_at,now()) ELSE NULL END,revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2 AND revision=$3 RETURNING ${projectColumns}`,
    [
      o.workspaceId,
      id,
      v.expected_revision,
      v.name ?? null,
      v.description ?? null,
      v.archived ?? null,
    ],
  );
  if (!r.rows[0]) throw new DomainError("CONFLICT", 409);
  await audit(c, o, "project.updated");
  return projectSchema.parse(serialize(r.rows[0]));
}
async function activeParent(c: PoolClient, w: string, parent: string | null) {
  if (
    parent &&
    !(
      await c.query(
        "SELECT id FROM atlas.collections WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL",
        [w, parent],
      )
    ).rowCount
  )
    throw new DomainError("INVALID_INPUT", 400);
}
export async function createCollection(
  c: PoolClient,
  o: OwnerContext,
  v: { name: string; parent_id: string | null },
) {
  await activeParent(c, o.workspaceId, v.parent_id);
  const r = await c.query(
    `INSERT INTO atlas.collections(workspace_id,name,normalized_name,parent_id,created_by_user_id) VALUES($1,$2,lower(btrim($2::text)),$3,$4) RETURNING ${collectionColumns}`,
    [o.workspaceId, v.name, v.parent_id, o.principal.userId],
  );
  await audit(c, o, "collection.created");
  return collectionSchema.parse(serialize(r.rows[0]));
}
export async function patchCollection(
  c: PoolClient,
  o: OwnerContext,
  id: string,
  v: {
    expected_revision: number;
    name?: string | undefined;
    parent_id?: string | null | undefined;
    archived?: boolean | undefined;
  },
) {
  const row = (
    await c.query("SELECT * FROM atlas.collections WHERE workspace_id=$1 AND id=$2", [
      o.workspaceId,
      id,
    ])
  ).rows[0];
  if (!row) throw new DomainError("NOT_FOUND", 404);
  if (row.revision !== v.expected_revision || row.merged_into_id)
    throw new DomainError("CONFLICT", 409);
  await activeParent(c, o.workspaceId, v.parent_id === undefined ? row.parent_id : v.parent_id);
  const r = await c.query(
    `UPDATE atlas.collections SET name=coalesce($4,name),normalized_name=CASE WHEN $4::text IS NULL THEN normalized_name ELSE lower(btrim($4::text)) END,parent_id=$5,archived_at=CASE WHEN $6::boolean IS NULL THEN archived_at WHEN $6 THEN coalesce(archived_at,now()) ELSE NULL END,revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2 AND revision=$3 RETURNING ${collectionColumns}`,
    [
      o.workspaceId,
      id,
      v.expected_revision,
      v.name ?? null,
      v.parent_id === undefined ? row.parent_id : v.parent_id,
      v.archived ?? null,
    ],
  );
  await audit(c, o, "collection.updated");
  return collectionSchema.parse(serialize(r.rows[0]));
}

export async function mergeCollections(
  c: PoolClient,
  o: OwnerContext,
  source: string,
  v: {
    target_id: string;
    expected_revision: number;
    target_revision: number;
    child_conflicts: Record<string, string>;
  },
) {
  const w = o.workspaceId;
  if (source === v.target_id) throw new DomainError("INVALID_INPUT", 400);
  const rows = await c.query(
    "SELECT id,revision FROM atlas.collections WHERE workspace_id=$1 AND id=ANY($2::uuid[]) AND archived_at IS NULL",
    [w, [source, v.target_id]],
  );
  if (
    rows.rowCount !== 2 ||
    rows.rows.find((r) => r.id === source)?.revision !== v.expected_revision ||
    rows.rows.find((r) => r.id === v.target_id)?.revision !== v.target_revision
  )
    throw new DomainError("CONFLICT", 409);
  const descendant = await c.query(
    "WITH RECURSIVE tree(id) AS (SELECT id FROM atlas.collections WHERE workspace_id=$1 AND id=$2 UNION SELECT c.id FROM atlas.collections c JOIN tree t ON c.parent_id=t.id WHERE c.workspace_id=$1) SELECT id FROM tree WHERE id=$3",
    [w, source, v.target_id],
  );
  if (descendant.rowCount) throw new DomainError("INVALID_INPUT", 400);
  const used = new Set<string>();
  async function merge(from: string, to: string) {
    const conflict = await c.query(
      "SELECT 1 FROM atlas.classification_overrides a JOIN atlas.classification_overrides b ON b.workspace_id=a.workspace_id AND b.source_id=a.source_id WHERE a.workspace_id=$1 AND a.collection_id=$2 AND b.collection_id=$3 AND a.decision<>b.decision LIMIT 1",
      [w, from, to],
    );
    if (conflict.rowCount) throw new DomainError("CONFLICT", 409);
    await c.query(
      "INSERT INTO atlas.collection_items(workspace_id,collection_id,item_id,origin,confidence,locked,created_by_user_id) SELECT workspace_id,$3::uuid,item_id,origin,confidence,locked,$4::uuid FROM atlas.collection_items WHERE workspace_id=$1 AND collection_id=$2 ON CONFLICT(workspace_id,collection_id,item_id) DO UPDATE SET origin=CASE WHEN atlas.collection_items.origin='manual' OR excluded.origin='manual' THEN 'manual' ELSE 'ai' END,locked=atlas.collection_items.locked OR excluded.locked,confidence=greatest(atlas.collection_items.confidence,excluded.confidence)",
      [w, from, to, o.principal.userId],
    );
    await c.query(
      "INSERT INTO atlas.classification_overrides(workspace_id,source_id,collection_id,decision,actor_user_id,created_by_user_id) SELECT workspace_id,source_id,$3::uuid,decision,actor_user_id,$4::uuid FROM atlas.classification_overrides WHERE workspace_id=$1 AND collection_id=$2 ON CONFLICT(workspace_id,source_id,collection_id) DO NOTHING",
      [w, from, to, o.principal.userId],
    );
    const children = await c.query(
      "SELECT id,normalized_name FROM atlas.collections WHERE workspace_id=$1 AND parent_id=$2 AND archived_at IS NULL ORDER BY id",
      [w, from],
    );
    for (const child of children.rows) {
      const sibling = (
        await c.query(
          "SELECT id FROM atlas.collections WHERE workspace_id=$1 AND parent_id=$2 AND normalized_name=$3 AND archived_at IS NULL",
          [w, to, child.normalized_name],
        )
      ).rows[0];
      if (sibling) {
        if (v.child_conflicts[child.id] !== sibling.id) throw new DomainError("CONFLICT", 409);
        used.add(child.id);
        await merge(child.id, sibling.id);
      } else
        await c.query(
          "UPDATE atlas.collections SET parent_id=$3,revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",
          [w, child.id, to],
        );
    }
    await c.query("DELETE FROM atlas.collection_items WHERE workspace_id=$1 AND collection_id=$2", [
      w,
      from,
    ]);
    await c.query(
      "DELETE FROM atlas.classification_overrides WHERE workspace_id=$1 AND collection_id=$2",
      [w, from],
    );
    await c.query(
      "UPDATE atlas.collections SET archived_at=now(),merged_into_id=$3,revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",
      [w, from, to],
    );
    await c.query(
      "UPDATE atlas.collections SET revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",
      [w, to],
    );
  }
  await merge(source, v.target_id);
  if (Object.keys(v.child_conflicts).some((id) => !used.has(id)))
    throw new DomainError("INVALID_INPUT", 400);
  await audit(c, o, "collection.merged");
  return collectionSchema.parse(
    serialize(
      (
        await c.query(
          `SELECT ${collectionColumns} FROM atlas.collections WHERE workspace_id=$1 AND id=$2`,
          [w, source],
        )
      ).rows[0],
    ),
  );
}
