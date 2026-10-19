import { randomUUID } from "node:crypto";
import { collectionSeedSchema, type CollectionSeed } from "@atlas/contracts";
import type { PoolClient } from "pg";

// Setup-only service: caller supplies a migration/setup transaction, never browser credentials.
// S06/S07 will authorize owner binding before exposing workspace creation through HTTP.
export async function seedCollections(
  client: PoolClient,
  workspaceId: string,
  input: CollectionSeed,
) {
  const seeds = collectionSeedSchema.parse(input);
  const locked = await client.query<{ owner_user_id: string }>(
    "SELECT owner_user_id FROM atlas.workspaces WHERE id=$1 FOR UPDATE",
    [workspaceId],
  );
  if (!locked.rowCount) throw new Error("Workspace does not exist");
  const owner = locked.rows[0]?.owner_user_id;
  if (!owner) throw new Error("Workspace owner is missing");
  for (const family of seeds) {
    const root = await seedOne(client, workspaceId, family.key, family.name, null, owner);
    for (const [index, name] of family.children.entries()) {
      await seedOne(client, workspaceId, `${family.key}/child-${index + 1}`, name, root, owner);
    }
  }
}

async function seedOne(
  client: PoolClient,
  workspaceId: string,
  key: string,
  name: string,
  parent: string | null,
  owner: string,
): Promise<string> {
  const prior = await client.query<{ id: string }>(
    "SELECT id FROM atlas.collections WHERE workspace_id=$1 AND seed_key=$2",
    [workspaceId, key],
  );
  if (prior.rows[0]) return prior.rows[0].id;
  const sibling = await client.query<{ id: string }>(
    "SELECT id FROM atlas.collections WHERE workspace_id=$1 AND parent_id IS NOT DISTINCT FROM $2::uuid AND normalized_name=$3 AND archived_at IS NULL",
    [workspaceId, parent, name.toLowerCase().trim()],
  );
  if (sibling.rows[0]) {
    // Existing user-created names win. Do not rename them or overwrite another seed identity.
    await client.query(
      "UPDATE atlas.collections SET seed_key=$3,revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2 AND seed_key IS NULL",
      [workspaceId, sibling.rows[0].id, key],
    );
    return sibling.rows[0].id;
  }
  const id = randomUUID();
  await client.query(
    "INSERT INTO atlas.collections(workspace_id,id,parent_id,name,normalized_name,seed_key,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [workspaceId, id, parent, name, name.trim().toLowerCase(), key, owner],
  );
  return id;
}

export async function createOwnerWorkspace(
  client: PoolClient,
  input: {
    ownerUserId: string;
    workspaceId: string;
    name: string;
    collections: CollectionSeed;
  },
) {
  if (!input.name.trim()) throw new Error("Workspace name is required");
  await client.query("INSERT INTO atlas.workspaces(id,owner_user_id,name) VALUES($1,$2,$3)", [
    input.workspaceId,
    input.ownerUserId,
    input.name.trim(),
  ]);
  await client.query(
    "INSERT INTO atlas_private.workspace_members(workspace_id,user_id,role,created_by_user_id) VALUES($1,$2,'owner',$2)",
    [input.workspaceId, input.ownerUserId],
  );
  await client.query(
    "INSERT INTO atlas.workspace_settings(workspace_id,created_by_user_id) VALUES($1,$2)",
    [input.workspaceId, input.ownerUserId],
  );
  await seedCollections(client, input.workspaceId, input.collections);
  return { id: input.workspaceId };
}
