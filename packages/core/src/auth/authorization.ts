import { createHash } from "node:crypto";
import { principalSchema, z, type Principal } from "@atlas/contracts";
import type { Pool, PoolClient } from "pg";
import { inTransaction, withPrincipal } from "../db/transaction.js";

export class AccessDenied extends Error {
  constructor() {
    super("Access denied");
  }
}

export async function authenticateAgent(
  pool: Pool,
  rawToken: string,
): Promise<Extract<Principal, { kind: "agent" }>> {
  if (!/^atlas_[A-Za-z0-9_-]{43}$/.test(rawToken)) throw new AccessDenied();
  const digest = createHash("sha256").update(rawToken).digest("hex");
  const result = await pool.query<{
    workspace_id: string;
    agent_id: string;
    credential_id: string;
  }>("SELECT workspace_id,agent_id,credential_id FROM atlas_private.authenticate_agent($1)", [
    digest,
  ]);
  const row = result.rows[0];
  if (!row) throw new AccessDenied();
  return principalSchema.parse({
    kind: "agent",
    workspaceId: row.workspace_id,
    agentId: row.agent_id,
    credentialId: row.credential_id,
  }) as Extract<Principal, { kind: "agent" }>;
}

export async function requireItemAccess(
  client: PoolClient,
  itemId: string,
  action: "read" | "propose" | "update" | "delete" = "read",
) {
  z.uuid().parse(itemId);
  const result =
    action === "read"
      ? await client.query<{ allowed: boolean }>(
          "SELECT atlas_private.can_read_item($1) AS allowed",
          [itemId],
        )
      : await client.query<{ allowed: boolean }>(
          "SELECT atlas_private.can_write_item($1,$2) AS allowed",
          [itemId, action],
        );
  if (result.rows[0]?.allowed !== true) throw new AccessDenied();
}

export async function withProcessingContext<T>(
  pool: Pool,
  principal: Extract<Principal, { kind: "agent" }>,
  taskId: string,
  leaseToken: string,
  work: (client: PoolClient) => Promise<T>,
) {
  z.uuid().parse(taskId);
  if (!/^[A-Za-z0-9_-]{43}$/.test(leaseToken)) throw new AccessDenied();
  return withPrincipal(pool, principal, principal.workspaceId, async (client) => {
    await client.query(
      "SELECT set_config('app.processing_task_id',$1,true),set_config('app.processing_lease_digest',$2,true)",
      [taskId, createHash("sha256").update(leaseToken).digest("hex")],
    );
    const allowed = await client.query<{ allowed: boolean }>(
      "SELECT atlas_private.can_process_task($1) AS allowed",
      [taskId],
    );
    if (allowed.rows[0]?.allowed !== true) throw new AccessDenied();
    return work(client);
  });
}

const jobContextSchema = z
  .object({
    workspaceId: z.uuid(),
    jobId: z.uuid(),
    sourceVersionId: z.uuid().nullable(),
    leaseToken: z.uuid(),
  })
  .strict();
export type JobContext = z.infer<typeof jobContextSchema>;
export async function withJobContext<T>(
  pool: Pool,
  input: JobContext,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const context = jobContextSchema.parse(input);
  return inTransaction(pool, async (client) => {
    await client.query(
      `SELECT set_config('app.principal_kind','worker',true),set_config('app.workspace_id',$1,true),
      set_config('app.job_id',$2,true),set_config('app.source_version_id',$3,true),set_config('app.job_lease_token',$4,true),
      set_config('app.user_id','',true),set_config('app.agent_id','',true),set_config('app.credential_id','',true),
      set_config('app.issuer','',true),set_config('app.subject','',true),set_config('app.processing_task_id','',true),set_config('app.processing_lease_digest','',true)`,
      [context.workspaceId, context.jobId, context.sourceVersionId ?? "", context.leaseToken],
    );
    const allowed = await client.query<{ allowed: boolean }>(
      "SELECT atlas_private.valid_job() AS allowed",
    );
    if (allowed.rows[0]?.allowed !== true) throw new AccessDenied();
    return work(client);
  });
}
