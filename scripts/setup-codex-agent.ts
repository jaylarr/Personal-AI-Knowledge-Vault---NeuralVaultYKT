import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createPool, inTransaction } from "@atlas/core";
import { readNeonSetup, assertNeonMigrationTarget } from "./neon-target.js";
const pwsh =
  "C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe";
let stage = "target validation";
try {
  const { env } = await readNeonSetup();
  if (!env.ATLAS_OWNER_ISSUER || !env.ATLAS_OWNER_SUBJECT) throw Error("Owner binding required");
  const pool = createPool(assertNeonMigrationTarget(env), "atlas-codex-enrollment");
  try {
    stage = "owner and existing enrollment";
    const owner = (
      await pool.query(
        "SELECT u.id AS user_id,w.id AS workspace_id FROM atlas.app_users u JOIN atlas.workspaces w ON w.owner_user_id=u.id JOIN atlas_private.workspace_members m ON m.workspace_id=w.id AND m.user_id=u.id WHERE u.issuer=$1 AND u.subject=$2 AND u.disabled_at IS NULL AND w.deleted_at IS NULL",
        [env.ATLAS_OWNER_ISSUER, env.ATLAS_OWNER_SUBJECT],
      )
    ).rows;
    if (owner.length !== 1) throw Error("Exact enabled owner required");
    const o = owner[0];
    try {
      const saved = JSON.parse(await readFile(".local/codex-agent.json", "utf8")) as {
        credentialId: string;
        agentId: string;
      };
      await access(".local/atlas-codex-token.clixml");
      const valid = await pool.query(
        "SELECT c.id FROM atlas_private.agent_credentials c JOIN atlas.agents a ON a.workspace_id=c.workspace_id AND a.id=c.agent_id WHERE c.workspace_id=$1 AND c.id=$2 AND a.id=$3 AND c.revoked_at IS NULL AND c.expires_at>now() AND a.disabled_at IS NULL AND c.operations @> ARRAY['read','manage_projects','capture_checkpoint']::text[]",
        [o.workspace_id, saved.credentialId, saved.agentId],
      );
      if (!valid.rowCount) throw Error("Existing enrollment needs explicit renewal");
      process.stdout.write(
        "Existing scoped Codex enrollment preserved; DPAPI credential present.\n",
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      stage = "scoped credential enrollment";
      const token = `atlas_${randomBytes(32).toString("base64url")}`,
        digest = createHash("sha256").update(token).digest("hex");
      const enrolled = await inTransaction(pool, async (c) => {
        await c.query("SET LOCAL ROLE atlas_owner");
        const agent = (
          await c.query(
            "INSERT INTO atlas.agents(workspace_id,name,description,type,created_by_user_id) VALUES($1,'Codex on this Windows PC','Automatically registers repositories and records project checkpoints.','codex',$2) RETURNING id",
            [o.workspace_id, o.user_id],
          )
        ).rows[0];
        const credential = (
          await c.query(
            "INSERT INTO atlas_private.agent_credentials(workspace_id,agent_id,created_by_user_id,token_digest,display_prefix,expires_at,operations) VALUES($1,$2,$3,$4,$5,now()+interval '90 days',ARRAY['read','manage_projects','capture_checkpoint']) RETURNING id,expires_at",
            [o.workspace_id, agent.id, o.user_id, digest, token.slice(0, 14)],
          )
        ).rows[0];
        stage = "Windows credential protection";
        await new Promise<void>((done, fail) => {
          const child = spawn(
            pwsh,
            [
              "-NoProfile",
              "-File",
              resolve("scripts/protect-token.ps1"),
              "-Destination",
              resolve(".local/atlas-codex-token.clixml"),
            ],
            { stdio: ["pipe", "ignore", "ignore"], windowsHide: true },
          );
          child.on("error", fail);
          child.on("close", (code) =>
            code === 0 ? done() : fail(Error("DPAPI protection failed")),
          );
          child.stdin.end(token);
        });
        return {
          agentId: agent.id as string,
          credentialId: credential.id as string,
          workspaceId: o.workspace_id as string,
          expiresAt: (credential.expires_at as Date).toISOString(),
        };
      });
      await writeFile(".local/codex-agent.json", `${JSON.stringify(enrolled, null, 2)}\n`);
      process.stdout.write(
        "Scoped Codex agent enrolled for 90 days; raw credential protected by Windows DPAPI. No database/admin credential in MCP config.\n",
      );
    }
  } finally {
    await pool.end();
  }
} catch {
  process.stderr.write(`Codex enrollment failed during ${stage}; secrets redacted.\n`);
  process.exitCode = 1;
}
