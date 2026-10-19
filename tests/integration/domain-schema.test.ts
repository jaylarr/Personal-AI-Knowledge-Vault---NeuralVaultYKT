import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collectionSeedSchema } from "@atlas/contracts";
import {
  applyMigrations,
  assertLocalTestTarget,
  createOwnerWorkspace,
  createPool,
  readMigrations,
  seedCollections,
} from "@atlas/core";

function url(key: string) {
  const value = process.env[key] ?? "";
  assertLocalTestTarget(value, process.env.DATABASE_TARGET_ID);
  return value;
}
const admin = createPool(url("ATLAS_TEST_ADMIN_URL"), "atlas-domain-schema-tests");
const api = createPool(url("ATLAS_TEST_API_URL"), "atlas-domain-denial-tests");
const worker = createPool(url("ATLAS_TEST_WORKER_URL"), "atlas-domain-worker-denial-tests");
const seeds = collectionSeedSchema.parse(
  JSON.parse(await readFile("database/seeds/collections.json", "utf8")),
);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Fixture = {
  client: PoolClient;
  owner: string;
  workspace: string;
  other: string;
  otherOwner: string;
};
beforeAll(async () => {
  await applyMigrations(admin, await readMigrations(resolve("database/migrations")));
});
afterAll(async () => {
  await Promise.all([admin.end(), api.end(), worker.end()]);
});
async function fixture(work: (f: Fixture) => Promise<void>) {
  const client = await admin.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE atlas_owner");
    const owner = randomUUID(),
      otherOwner = randomUUID(),
      workspace = randomUUID(),
      other = randomUUID();
    await client.query(
      "INSERT INTO atlas.app_users(id,issuer,subject) VALUES($1::uuid,'https://fixture.example',$1::uuid::text),($2::uuid,'https://fixture.example',$2::uuid::text)",
      [owner, otherOwner],
    );
    for (const [id, userId] of [
      [workspace, owner],
      [other, otherOwner],
    ]) {
      if (!id || !userId) throw new Error("Missing fixture identifiers");
      await createOwnerWorkspace(client, {
        workspaceId: id,
        ownerUserId: userId,
        name: "Synthetic schema fixture",
        collections: seeds,
      });
    }
    await work({ client, owner, workspace, other, otherOwner });
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}
async function denied(client: PoolClient, sql: string, params: unknown[], code: string) {
  await client.query("SAVEPOINT invalid_row");
  let observed: unknown;
  try {
    await client.query(sql, params);
  } catch (error) {
    observed = error;
  }
  await client.query("ROLLBACK TO SAVEPOINT invalid_row");
  expect(observed).toMatchObject({ code });
}
async function item(f: Fixture, kind = "source", workspace = f.workspace, owner = f.owner) {
  const id = randomUUID();
  await f.client.query(
    "INSERT INTO atlas.knowledge_items(workspace_id,id,kind,title,scope,access_partition) VALUES($1,$2,$3,'Synthetic item','personal',$4)",
    [workspace, id, kind, `personal:${owner}`],
  );
  return id;
}
async function source(f: Fixture, text = "Source text with 🧠 evidence.") {
  const id = await item(f),
    version = randomUUID(),
    chunk = randomUUID();
  await f.client.query(
    "INSERT INTO atlas.sources(workspace_id,id,input_type) VALUES($1,$2,'note')",
    [f.workspace, id],
  );
  await f.client.query(
    `INSERT INTO atlas.source_versions(workspace_id,id,source_id,version,raw_sha256,normalized_sha256,object_key,byte_count,media_type,markdown,normalized_text)
    VALUES($1,$2,$3,1,$4,$4,$5,$6,'text/plain',$7,$7)`,
    [
      f.workspace,
      version,
      id,
      hash(text),
      `${version}/original.txt`,
      Buffer.byteLength(text),
      text,
    ],
  );
  await f.client.query(
    "INSERT INTO atlas.source_chunks(workspace_id,id,source_id,version_id,sequence,text,start_offset,end_offset,sha256,estimated_tokens) VALUES($1,$2,$3,$4,0,$5,0,$6,$7,40)",
    [f.workspace, chunk, id, version, text, Array.from(text).length, hash(text)],
  );
  await f.client.query(
    "UPDATE atlas.sources SET current_version_id=$3 WHERE workspace_id=$1 AND id=$2",
    [f.workspace, id, version],
  );
  return { id, version, chunk, text, length: Array.from(text).length };
}
async function memory(f: Fixture, subject = "synthetic.decision") {
  const id = await item(f, "memory");
  await f.client.query(
    "INSERT INTO atlas.memories(workspace_id,id,type,subject_key,structured_content,summary,claim_kind) VALUES($1,$2,'semantic',$3,'{}','Synthetic fact','explicit_fact')",
    [f.workspace, id, subject],
  );
  return id;
}
describe("normalized domain schema and exact seeds", () => {
  it("replays every migration from empty local namespaces without committing a reset", async () => {
    const client = await admin.connect();
    try {
      await client.query("BEGIN");
      await client.query("DROP SCHEMA atlas,atlas_private CASCADE");
      for (const migration of await readMigrations(resolve("database/migrations")))
        await client.query(migration.sql);
      const tables = await client.query(
        "SELECT count(*)::int AS total FROM pg_tables WHERE schemaname IN ('atlas','atlas_private')",
      );
      expect(tables.rows[0].total).toBe(42);
      const functions = await client.query(
        "SELECT count(*)::int AS total FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='atlas' AND p.prosecdef",
      );
      expect(functions.rows[0].total).toBe(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
  it("installs 42 owned/RLS-enabled tables and denies missing-context content reads", async () => {
    const result = await admin.query(
      "SELECT n.nspname,c.relname,c.relrowsecurity,r.rolname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname IN ('atlas','atlas_private') AND c.relkind='r'",
    );
    expect(result.rowCount).toBe(42);
    expect(result.rows.every((row) => row.relrowsecurity && row.rolname === "atlas_owner")).toBe(
      true,
    );
    expect((await api.query("SELECT title FROM atlas.knowledge_items")).rows).toEqual([]);
    await expect(
      worker.query("SELECT token_digest FROM atlas_private.agent_credentials"),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("matches all nine families and every child name in the untouched source brief", async () => {
    const brief = await readFile("docs/plans/2026-10-16-atlas-source-brief.md", "utf8");
    const section = brief.split("## 2.1 Initial top-level collections")[1]?.split("## 2.2")[0];
    const expected: { name: string; children: string[] }[] = [];
    for (const line of (section ?? "").split(/\r?\n/)) {
      if (line.startsWith("### ")) expected.push({ name: line.slice(4).trim(), children: [] });
      else if (line.startsWith("- ")) expected.at(-1)?.children.push(line.slice(2).trim());
    }
    expect(seeds.map(({ name, children }) => ({ name, children }))).toEqual(expected);
    expect(seeds).toHaveLength(9);
    await fixture(async (f) => {
      const count = await f.client.query(
        "SELECT count(*)::int AS total FROM atlas.collections WHERE workspace_id=$1",
        [f.workspace],
      );
      expect(count.rows[0].total).toBe(
        seeds.reduce((sum, family) => sum + family.children.length + 1, 0),
      );
      const defaults = await f.client.query(
        "SELECT auto_classify,default_agent_processing,log_raw_queries FROM atlas.workspace_settings WHERE workspace_id=$1",
        [f.workspace],
      );
      expect(defaults.rows[0]).toEqual({
        auto_classify: true,
        default_agent_processing: false,
        log_raw_queries: false,
      });
    });
  });
  it("reseed is idempotent and preserves renamed, archived and moved seed identities", async () =>
    fixture(async (f) => {
      const prior = await f.client.query(
        "SELECT id,seed_key FROM atlas.collections WHERE workspace_id=$1 ORDER BY seed_key",
        [f.workspace],
      );
      const root = prior.rows.find((row) => row.seed_key === "family-1");
      const child = prior.rows.find((row) => row.seed_key === "family-1/child-1");
      const destination = prior.rows.find((row) => row.seed_key === "family-2");
      await f.client.query(
        "UPDATE atlas.collections SET parent_id=$3 WHERE workspace_id=$1 AND id=$2",
        [f.workspace, child.id, destination.id],
      );
      await f.client.query(
        "UPDATE atlas.collections SET name='My renamed personal collection',normalized_name='my renamed personal collection',archived_at=now() WHERE workspace_id=$1 AND id=$2",
        [f.workspace, root.id],
      );
      await seedCollections(f.client, f.workspace, seeds);
      expect(
        (
          await f.client.query(
            "SELECT parent_id FROM atlas.collections WHERE workspace_id=$1 AND id=$2",
            [f.workspace, child.id],
          )
        ).rows[0].parent_id,
      ).toBe(destination.id);
      expect(
        (
          await f.client.query(
            "SELECT id,seed_key FROM atlas.collections WHERE workspace_id=$1 ORDER BY seed_key",
            [f.workspace],
          )
        ).rows,
      ).toEqual(prior.rows);
      expect(
        (
          await f.client.query(
            "SELECT name,archived_at FROM atlas.collections WHERE workspace_id=$1 AND id=$2",
            [f.workspace, root.id],
          )
        ).rows[0].archived_at,
      ).not.toBeNull();
    }));
  it("uses opaque issuer/subject identity and restricts workspace membership to its actual owner", async () =>
    fixture(async (f) => {
      await f.client.query(
        "INSERT INTO atlas.app_users(issuer,subject) VALUES('https://fixture.example','opaque|subject:external')",
      );
      await denied(
        f.client,
        "INSERT INTO atlas_private.workspace_members(workspace_id,user_id) VALUES($1,$2)",
        [f.workspace, f.otherOwner],
        "23503",
      );
      await denied(
        f.client,
        "INSERT INTO atlas.workspace_settings(workspace_id) VALUES($1)",
        [f.workspace],
        "23505",
      );
    }));
  it("rejects cross-workspace parents, projects and agent ownership", async () =>
    fixture(async (f) => {
      const foreign = await f.client.query(
        "SELECT id FROM atlas.collections WHERE workspace_id=$1 LIMIT 1",
        [f.other],
      );
      await denied(
        f.client,
        "INSERT INTO atlas.collections(workspace_id,parent_id,name,normalized_name) VALUES($1,$2,'Bad','bad')",
        [f.workspace, foreign.rows[0].id],
        "23503",
      );
      const project = randomUUID();
      await f.client.query(
        "INSERT INTO atlas.projects(workspace_id,id,slug,name) VALUES($1,$2,'foreign','Foreign')",
        [f.other, project],
      );
      await denied(
        f.client,
        "INSERT INTO atlas.knowledge_items(workspace_id,kind,title,scope,project_id,access_partition) VALUES($1,'source','Bad','project',$2,$3)",
        [f.workspace, project, `project:${project}`],
        "23503",
      );
    }));
  it("rejects duplicate root and child siblings but permits the same child name under different roots", async () =>
    fixture(async (f) => {
      await denied(
        f.client,
        "INSERT INTO atlas.collections(workspace_id,name,normalized_name) VALUES($1,'Personal','personal')",
        [f.workspace],
        "23505",
      );
      const parents = await f.client.query(
        "SELECT id FROM atlas.collections WHERE workspace_id=$1 AND parent_id IS NULL LIMIT 2",
        [f.workspace],
      );
      for (const row of parents.rows)
        await f.client.query(
          "INSERT INTO atlas.collections(workspace_id,parent_id,name,normalized_name) VALUES($1,$2,'Common','common')",
          [f.workspace, row.id],
        );
      await denied(
        f.client,
        "INSERT INTO atlas.collections(workspace_id,parent_id,name,normalized_name) VALUES($1,$2,'Common','common')",
        [f.workspace, parents.rows[0].id],
        "23505",
      );
    }));
  it("prevents collection parent and merge cycles", async () =>
    fixture(async (f) => {
      const root = await f.client.query(
        "SELECT id FROM atlas.collections WHERE workspace_id=$1 AND seed_key='family-1'",
        [f.workspace],
      );
      const child = await f.client.query(
        "SELECT id FROM atlas.collections WHERE workspace_id=$1 AND parent_id=$2 LIMIT 1",
        [f.workspace, root.rows[0].id],
      );
      await denied(
        f.client,
        "UPDATE atlas.collections SET parent_id=$3 WHERE workspace_id=$1 AND id=$2",
        [f.workspace, root.rows[0].id, child.rows[0].id],
        "23514",
      );
      await f.client.query(
        "UPDATE atlas.collections SET archived_at=now(),merged_into_id=$3 WHERE workspace_id=$1 AND id=$2",
        [f.workspace, child.rows[0].id, root.rows[0].id],
      );
      await denied(
        f.client,
        "UPDATE atlas.collections SET archived_at=now(),merged_into_id=$3 WHERE workspace_id=$1 AND id=$2",
        [f.workspace, root.rows[0].id, child.rows[0].id],
        "23514",
      );
    }));
  it("stores two collection memberships without copying a source item", async () =>
    fixture(async (f) => {
      const s = await source(f);
      const collections = await f.client.query(
        "SELECT id FROM atlas.collections WHERE workspace_id=$1 LIMIT 2",
        [f.workspace],
      );
      for (const row of collections.rows)
        await f.client.query(
          "INSERT INTO atlas.collection_items(workspace_id,collection_id,item_id,origin) VALUES($1,$2,$3,'manual')",
          [f.workspace, row.id, s.id],
        );
      expect(
        (
          await f.client.query(
            "SELECT count(*)::int AS total,count(DISTINCT item_id)::int AS items FROM atlas.collection_items WHERE workspace_id=$1",
            [f.workspace],
          )
        ).rows[0],
      ).toEqual({ total: 2, items: 1 });
    }));
  it("rejects invalid scope combinations, personal audience forgery and wrong subtype kind", async () =>
    fixture(async (f) => {
      await denied(
        f.client,
        "INSERT INTO atlas.knowledge_items(workspace_id,kind,title,scope,access_partition) VALUES($1,'source','Bad','project','project:missing')",
        [f.workspace],
        "23514",
      );
      await denied(
        f.client,
        "INSERT INTO atlas.knowledge_items(workspace_id,kind,title,scope,access_partition) VALUES($1,'source','Bad','personal',$2)",
        [f.workspace, `personal:${f.otherOwner}`],
        "23514",
      );
      const id = await item(f, "entity");
      await denied(
        f.client,
        "INSERT INTO atlas.sources(workspace_id,id,input_type) VALUES($1,$2,'note')",
        [f.workspace, id],
        "23503",
      );
    }));
  it("keeps source history immutable and prevents another source's current version", async () =>
    fixture(async (f) => {
      const a = await source(f),
        b = await source(f);
      await denied(
        f.client,
        "UPDATE atlas.source_versions SET markdown='changed' WHERE workspace_id=$1 AND id=$2",
        [f.workspace, a.version],
        "23514",
      );
      await denied(
        f.client,
        "INSERT INTO atlas.source_versions(workspace_id,source_id,version,raw_sha256,normalized_sha256,object_key,byte_count,media_type,markdown,normalized_text) VALUES($1,$2,2,$3,$4,'bad-checksum',3,'text/plain','bad','bad')",
        [f.workspace, a.id, hash("bad"), "0".repeat(64)],
        "23514",
      );
      await denied(
        f.client,
        "DELETE FROM atlas.source_chunks WHERE workspace_id=$1 AND id=$2",
        [f.workspace, a.chunk],
        "23514",
      );
      await f.client.query("SAVEPOINT wrong_version");
      await f.client.query(
        "UPDATE atlas.sources SET current_version_id=$3 WHERE workspace_id=$1 AND id=$2",
        [f.workspace, a.id, b.version],
      );
      await expect(f.client.query("SET CONSTRAINTS ALL IMMEDIATE")).rejects.toMatchObject({
        code: "23503",
      });
      await f.client.query("ROLLBACK TO SAVEPOINT wrong_version");
    }));
  it("validates Unicode chunk/evidence offsets and cryptographic quote hashes", async () =>
    fixture(async (f) => {
      const s = await source(f),
        m = await memory(f);
      await f.client.query(
        "INSERT INTO atlas.memory_evidence(workspace_id,memory_id,source_version_id,chunk_id,start_offset,end_offset,quote_sha256) VALUES($1,$2,$3,$4,0,$5,$6)",
        [f.workspace, m, s.version, s.chunk, s.length, hash(s.text)],
      );
      await denied(
        f.client,
        "INSERT INTO atlas.memory_evidence(workspace_id,memory_id,source_version_id,chunk_id,start_offset,end_offset,quote_sha256) VALUES($1,$2,$3,$4,0,$5,$6)",
        [f.workspace, m, s.version, s.chunk, s.length, "0".repeat(64)],
        "23514",
      );
      await denied(
        f.client,
        "INSERT INTO atlas.source_chunks(workspace_id,source_id,version_id,sequence,text,start_offset,end_offset,sha256,estimated_tokens) VALUES($1,$2,$3,1,'fabricated',0,3,$4,2)",
        [f.workspace, s.id, s.version, hash("fabricated")],
        "23514",
      );
    }));
  it("rejects active unverified memories and self/cyclic supersession", async () =>
    fixture(async (f) => {
      const a = await memory(f),
        b = await memory(f);
      await denied(
        f.client,
        "UPDATE atlas.memories SET status='active' WHERE workspace_id=$1 AND id=$2",
        [f.workspace, a],
        "23514",
      );
      await f.client.query(
        "UPDATE atlas.memories SET status='active',verified_by_user_id=$2,verified_at=now(),valid_from=now()-interval '1 day' WHERE workspace_id=$1",
        [f.workspace, f.owner],
      );
      await denied(
        f.client,
        "UPDATE atlas.memories SET status='superseded',valid_to=now(),superseded_by_id=$2 WHERE workspace_id=$1 AND id=$2",
        [f.workspace, a],
        "23514",
      );
      await f.client.query(
        "UPDATE atlas.memories SET status='superseded',valid_to=now(),superseded_by_id=$3 WHERE workspace_id=$1 AND id=$2",
        [f.workspace, a, b],
      );
      await denied(
        f.client,
        "UPDATE atlas.memories SET status='superseded',valid_to=now(),superseded_by_id=$3 WHERE workspace_id=$1 AND id=$2",
        [f.workspace, b, a],
        "23514",
      );
    }));
  it("rejects active duplicate entities in the same audience but allows a different partition", async () =>
    fixture(async (f) => {
      for (let n = 0; n < 2; n++) {
        const id = await item(f, "entity");
        const sql =
          "INSERT INTO atlas.entities(workspace_id,id,access_partition,canonical_key,entity_type,status,approved_by_user_id,approved_at) VALUES($1,$2,$3,'postgres','technology','active',$4,now())";
        const params = [f.workspace, id, `personal:${f.owner}`, f.owner];
        if (n === 0) await f.client.query(sql, params);
        else await denied(f.client, sql, params, "23505");
      }
      const id = randomUUID();
      await f.client.query(
        "INSERT INTO atlas.knowledge_items(workspace_id,id,kind,title,scope,access_partition) VALUES($1,$2,'entity','Postgres','global_development',$3)",
        [f.workspace, id, `global:${f.workspace}`],
      );
      await f.client.query(
        "INSERT INTO atlas.entities(workspace_id,id,access_partition,canonical_key,entity_type,status,approved_by_user_id,approved_at) VALUES($1,$2,$3,'postgres','technology','active',$4,now())",
        [f.workspace, id, `global:${f.workspace}`, f.owner],
      );
    }));
  it("rejects self-links, duplicate active relationships and relationship endpoints", async () =>
    fixture(async (f) => {
      const a = await source(f),
        b = await source(f);
      for (let n = 0; n < 2; n++) {
        const id = await item(f, "relationship");
        const sql =
          "INSERT INTO atlas.relationships(workspace_id,id,from_item_id,to_item_id,from_kind,to_kind,type,status,claim_kind) VALUES($1,$2,$3,$4,'source','source','RELATED_TO','active','explicit_fact')";
        const params = [f.workspace, id, a.id, b.id];
        if (n === 0) await f.client.query(sql, params);
        else await denied(f.client, sql, params, "23505");
      }
      const id = await item(f, "relationship");
      await denied(
        f.client,
        "INSERT INTO atlas.relationships(workspace_id,id,from_item_id,to_item_id,from_kind,to_kind,type,claim_kind) VALUES($1,$2,$3,$3,'source','source','USES','explicit_fact')",
        [f.workspace, id, a.id],
        "23514",
      );
      await denied(
        f.client,
        "INSERT INTO atlas.relationships(workspace_id,id,from_item_id,to_item_id,from_kind,to_kind,type,claim_kind) VALUES($1,$2,$2,$3,'relationship','source','USES','explicit_fact')",
        [f.workspace, id, a.id],
        "23514",
      );
    }));
  it("rejects oversized/foreign/duplicate task batches and malformed claims", async () =>
    fixture(async (f) => {
      const s = await source(f),
        other = await source(f);
      const sql =
        "INSERT INTO atlas.organization_tasks(workspace_id,source_version_id,expected_source_revision,batch_index,chunk_ids) VALUES($1,$2,1,0,$3)";
      await denied(f.client, sql, [f.workspace, s.version, [s.chunk, s.chunk]], "23514");
      await denied(f.client, sql, [f.workspace, s.version, [other.chunk]], "23514");
      await denied(f.client, sql, [f.workspace, s.version, Array(21).fill(s.chunk)], "23514");
      await f.client.query(sql, [f.workspace, s.version, [s.chunk]]);
      await denied(f.client, sql, [f.workspace, s.version, [s.chunk]], "23505");
      await denied(
        f.client,
        "UPDATE atlas.organization_tasks SET state='claimed' WHERE workspace_id=$1",
        [f.workspace],
        "23514",
      );
    }));
  it("stores explicit version grants with maximum expiry and one named processor", async () =>
    fixture(async (f) => {
      const s = await source(f),
        agent = randomUUID(),
        other = randomUUID();
      for (const id of [agent, other])
        await f.client.query(
          "INSERT INTO atlas.agents(workspace_id,id,name,type) VALUES($1,$2,'Synthetic','codex')",
          [f.workspace, id],
        );
      const sql =
        "INSERT INTO atlas_private.processing_grants(workspace_id,source_version_id,agent_id,granted_by_user_id) VALUES($1,$2,$3,$4)";
      await f.client.query(sql, [f.workspace, s.version, agent, f.owner]);
      await denied(f.client, sql, [f.workspace, s.version, other, f.owner], "23505");
      await denied(
        f.client,
        "UPDATE atlas_private.processing_grants SET expires_at=now()+interval '8 days' WHERE workspace_id=$1",
        [f.workspace],
        "23514",
      );
      await f.client.query(
        "UPDATE atlas_private.processing_grants SET revoked_at=now() WHERE workspace_id=$1",
        [f.workspace],
      );
      await f.client.query(sql, [f.workspace, s.version, other, f.owner]);
    }));
  it("preserves submission provenance when an old task is superseded", async () =>
    fixture(async (f) => {
      const s = await source(f),
        agent = randomUUID(),
        task = randomUUID(),
        submission = randomUUID();
      await f.client.query(
        "INSERT INTO atlas.agents(workspace_id,id,name,type) VALUES($1,$2,'Synthetic','codex')",
        [f.workspace, agent],
      );
      await f.client.query(
        "INSERT INTO atlas.organization_tasks(workspace_id,id,source_version_id,expected_source_revision,batch_index,chunk_ids) VALUES($1,$2,$3,1,0,$4)",
        [f.workspace, task, s.version, [s.chunk]],
      );
      await f.client.query(
        "INSERT INTO atlas.organization_submissions(workspace_id,id,task_id,agent_id,idempotency_key,payload_sha256,payload) VALUES($1,$2,$3,$4,'synthetic',$5,'{}')",
        [f.workspace, submission, task, agent, hash("{}")],
      );
      await f.client.query(
        "UPDATE atlas.organization_tasks SET state='submitted',submission_id=$3 WHERE workspace_id=$1 AND id=$2",
        [f.workspace, task, submission],
      );
      await f.client.query(
        "UPDATE atlas.organization_tasks SET state='superseded' WHERE workspace_id=$1 AND id=$2",
        [f.workspace, task],
      );
      expect(
        (
          await f.client.query(
            "SELECT submission_id FROM atlas.organization_tasks WHERE workspace_id=$1 AND id=$2",
            [f.workspace, task],
          )
        ).rows[0].submission_id,
      ).toBe(submission);
      await denied(
        f.client,
        "DELETE FROM atlas.organization_submissions WHERE workspace_id=$1 AND id=$2",
        [f.workspace, submission],
        "23514",
      );
    }));
  it("requires actor identities, immutable audit and valid deterministic-job state", async () =>
    fixture(async (f) => {
      await denied(
        f.client,
        "INSERT INTO atlas.activity_events(workspace_id,actor_kind,action,correlation_id) VALUES($1,'human','probe',$2)",
        [f.workspace, randomUUID()],
        "23514",
      );
      await f.client.query(
        "INSERT INTO atlas.activity_events(workspace_id,actor_kind,user_id,action,correlation_id) VALUES($1,'human',$2,'probe',$3)",
        [f.workspace, f.owner, randomUUID()],
      );
      await denied(
        f.client,
        "DELETE FROM atlas.activity_events WHERE workspace_id=$1",
        [f.workspace],
        "23514",
      );
      const s = await source(f);
      await denied(
        f.client,
        "INSERT INTO atlas.ingestion_jobs(workspace_id,kind,source_version_id,status,stage,idempotency_key) VALUES($1,'chunk',$2,'processing','chunk',$3)",
        [f.workspace, s.version, hash("probe")],
        "23514",
      );
    }));
  it("builds simple-config lexical/trigram indexes and rejects unrelated search origins", async () =>
    fixture(async (f) => {
      const s = await source(f, "OpaqueFunctionName db_table"),
        other = await source(f);
      await f.client.query(
        "INSERT INTO atlas.search_documents(workspace_id,item_id,chunk_id,source_version_id,text,normalizer_version,origin_key) VALUES($1,$2,$3,$4,$5,'v1','one')",
        [f.workspace, s.id, s.chunk, s.version, s.text],
      );
      expect(
        (
          await f.client.query(
            "SELECT id FROM atlas.search_documents WHERE workspace_id=$1 AND search_vector @@ plainto_tsquery('simple','OpaqueFunctionName')",
            [f.workspace],
          )
        ).rowCount,
      ).toBe(1);
      await denied(
        f.client,
        "INSERT INTO atlas.search_documents(workspace_id,item_id,chunk_id,source_version_id,text,normalizer_version,origin_key) VALUES($1,$2,$3,$4,'forged','v1','bad')",
        [f.workspace, other.id, s.chunk, s.version],
        "23514",
      );
      const indexes = await f.client.query(
        "SELECT indexname FROM pg_indexes WHERE schemaname='atlas' AND indexname IN ('search_documents_fts','search_identifiers_trigram','jobs_ready','organization_live_batch')",
      );
      expect(indexes.rowCount).toBe(4);
    }));
});
