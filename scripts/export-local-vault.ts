// Read-only export on the exact existing target. Never deletes or updates cloud history.
import { writeFile } from "node:fs/promises";
import { createPool } from "@atlas/core";
import { readNeonSetup, assertNeonMigrationTarget } from "./neon-target.js";
try {
  const { env } = await readNeonSetup(),
    pool = createPool(assertNeonMigrationTarget(env), "atlas-readonly-local-export");
  try {
    const c = await pool.connect();
    try {
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const owners = await c.query(
        "SELECT u.id,w.id AS workspace_id FROM atlas.app_users u JOIN atlas.workspaces w ON w.owner_user_id=u.id WHERE u.issuer=$1 AND u.subject=$2 AND u.disabled_at IS NULL AND w.deleted_at IS NULL",
        [env.ATLAS_OWNER_ISSUER, env.ATLAS_OWNER_SUBJECT],
      );
      if (owners.rowCount !== 1) throw Error("Exact bound owner required");
      const w = owners.rows[0].workspace_id;
      const projects = (
        await c.query(
          "SELECT id,name,slug,description,archived_at,created_at FROM atlas.projects WHERE workspace_id=$1 ORDER BY id",
          [w],
        )
      ).rows;
      const repositories = (
        await c.query(
          "SELECT project_id,repository_digest FROM atlas_private.project_repositories WHERE workspace_id=$1",
          [w],
        )
      ).rows;
      const checkpoints = (
        await c.query(
          "SELECT id,project_id,created_at,created_by_agent_id,title,kind,markdown,provenance,request_key,content_digest,status FROM atlas.project_checkpoints WHERE workspace_id=$1 ORDER BY created_at,id",
          [w],
        )
      ).rows;
      const collections = (
        await c.query(
          "SELECT id,parent_id,name,archived_at FROM atlas.collections WHERE workspace_id=$1 ORDER BY id",
          [w],
        )
      ).rows;
      const receipts = (
        await c.query(
          "SELECT project_id,agent_id,request_key,content_digest,checkpoint_id FROM atlas_private.checkpoint_requests WHERE workspace_id=$1",
          [w],
        )
      ).rows;
      const counts = (
        await c.query(
          "SELECT (SELECT count(*)::int FROM atlas.sources WHERE workspace_id=$1) AS sources,(SELECT count(*)::int FROM atlas.memories WHERE workspace_id=$1) AS memories,(SELECT count(*)::int FROM atlas.entities WHERE workspace_id=$1) AS entities,(SELECT count(*)::int FROM atlas.relationships WHERE workspace_id=$1) AS relationships",
          [w],
        )
      ).rows[0];
      if (Object.values(counts).some((v) => v !== 0))
        throw Error(
          "Additional source/memory content requires a complete export adapter; cloud left unchanged",
        );
      const exported = {
        format: 1,
        exported_at: new Date().toISOString(),
        projects,
        repositories,
        checkpoints,
        collections,
        receipts,
        counts,
      };
      await writeFile(
        process.argv[2] === "final"
          ? ".local/neon-knowledge-export-final.json"
          : ".local/neon-knowledge-export.json",
        `${JSON.stringify(exported, null, 2)}\n`,
        { flag: "wx" },
      );
      await c.query("COMMIT");
      process.stdout.write(
        `Read-only export: ${projects.length} projects, ${checkpoints.length} checkpoints, ${collections.length} collections. Other knowledge counts: ${JSON.stringify(counts)}. Cloud unchanged.\n`,
      );
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  } finally {
    await pool.end();
  }
} catch {
  process.stderr.write(
    "Local export failed; cloud unchanged and secrets redacted. Preserve any existing export before retrying.\n",
  );
  process.exitCode = 1;
}
