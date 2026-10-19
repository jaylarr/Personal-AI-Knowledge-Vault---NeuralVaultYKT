import { randomUUID } from "node:crypto";
import { z, type CollectionSeed, type Principal } from "@atlas/contracts";
import type { Pool, PoolClient } from "pg";
import { AccessDenied } from "./authorization.js";
import { createOwnerWorkspace } from "../knowledge/workspaces.js";

export type VerifiedIdentity = { issuer: string; subject: string };
export type OwnerContext = {
  principal: Extract<Principal, { kind: "human" }>;
  workspaceId: string;
};
const identitySchema = z.object({ issuer: z.url(), subject: z.string().min(1).max(512) }).strict();

export async function resolveOwner(
  pool: Pool,
  identity: VerifiedIdentity,
  binding: VerifiedIdentity,
): Promise<OwnerContext> {
  identitySchema.parse(identity);
  identitySchema.parse(binding);
  if (identity.issuer !== binding.issuer || identity.subject !== binding.subject)
    throw new AccessDenied();
  const result = await pool.query<{ user_id: string; workspace_id: string }>(
    "SELECT user_id,workspace_id FROM atlas_private.resolve_owner($1,$2)",
    [identity.issuer, identity.subject],
  );
  const row = result.rows[0];
  if (result.rowCount !== 1 || !row) throw new AccessDenied();
  return {
    principal: { kind: "human", userId: row.user_id, ...identity },
    workspaceId: row.workspace_id,
  };
}

// Setup transaction only. Never called by a public route; identity must already
// have been verified with the configured branch's JWT verifier.
export async function bindOwner(
  client: PoolClient,
  identity: VerifiedIdentity,
  seeds: CollectionSeed,
) {
  identitySchema.parse(identity);
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('atlas-installation-owner',0))",
  );
  const users = await client.query<{
    id: string;
    issuer: string;
    subject: string;
    disabled_at: Date | null;
  }>("SELECT id,issuer,subject,disabled_at FROM atlas.app_users");
  if (
    users.rows.some(
      (u) => u.issuer !== identity.issuer || u.subject !== identity.subject || u.disabled_at,
    )
  )
    throw new AccessDenied();
  let userId = users.rows[0]?.id;
  if (!userId) {
    userId = randomUUID();
    await client.query("INSERT INTO atlas.app_users(id,issuer,subject) VALUES($1,$2,$3)", [
      userId,
      identity.issuer,
      identity.subject,
    ]);
  }
  const existing = await client.query<{ id: string; deleted_at: Date | null }>(
    "SELECT id,deleted_at FROM atlas.workspaces WHERE owner_user_id=$1",
    [userId],
  );
  if (existing.rowCount) {
    if (existing.rowCount !== 1 || existing.rows[0]?.deleted_at) throw new AccessDenied();
    const member = await client.query(
      "SELECT id FROM atlas_private.workspace_members WHERE workspace_id=$1 AND user_id=$2 AND role='owner'",
      [existing.rows[0]?.id, userId],
    );
    if (member.rowCount !== 1) throw new AccessDenied();
    return { userId, workspaceId: existing.rows[0]?.id };
  }
  const workspaceId = randomUUID();
  await createOwnerWorkspace(client, {
    ownerUserId: userId,
    workspaceId,
    name: "Your workspace",
    collections: seeds,
  });
  return { userId, workspaceId };
}
