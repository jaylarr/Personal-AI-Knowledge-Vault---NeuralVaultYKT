import { principalSchema, type Principal } from "@atlas/contracts";
import type { Pool, PoolClient } from "pg";

export async function inTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let broken: Error | undefined;
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      broken = new Error("Transaction rollback failed");
    }
    throw error;
  } finally {
    client.release(broken);
  }
}

export async function withPrincipal<T>(
  pool: Pool,
  input: Principal,
  workspaceId: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const principal = principalSchema.parse(input);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId)) {
    throw new Error("Invalid workspace ID");
  }
  if (principal.kind === "agent" && principal.workspaceId !== workspaceId) {
    throw new Error("Agent workspace mismatch");
  }
  return inTransaction(pool, async (client) => {
    await client.query(
      `SELECT set_config('app.principal_kind',$1,true),
      set_config('app.user_id',$2,true), set_config('app.agent_id',$3,true),
      set_config('app.workspace_id',$4,true),set_config('app.credential_id',$5,true),
      set_config('app.issuer',$6,true),set_config('app.subject',$7,true),
      set_config('app.job_id','',true),set_config('app.job_lease_token','',true),set_config('app.source_version_id','',true),
      set_config('app.processing_task_id','',true),set_config('app.processing_lease_digest','',true)`,
      [
        principal.kind,
        principal.kind === "human" ? principal.userId : "",
        principal.kind === "agent" ? principal.agentId : "",
        workspaceId,
        principal.kind === "agent" ? principal.credentialId : "",
        principal.kind === "human" ? principal.issuer : "",
        principal.kind === "human" ? principal.subject : "",
      ],
    );
    return work(client);
  });
}
