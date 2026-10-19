import { createHash, randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyMigrations,
  assertLocalTestTarget,
  authenticateAgent,
  createOwnerWorkspace,
  createPool,
  readMigrations,
  requireItemAccess,
  withJobContext,
  withPrincipal,
  withProcessingContext,
} from "@atlas/core";
import type { JobContext } from "@atlas/core";
import type { Principal } from "@atlas/contracts";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const url = (key: string) => {
  const value = process.env[key] ?? "";
  assertLocalTestTarget(value, process.env.DATABASE_TARGET_ID);
  return value;
};
const admin = createPool(url("ATLAS_TEST_ADMIN_URL"), "atlas-access-fixtures");
const api = createPool(url("ATLAS_TEST_API_URL"), "atlas-access-api");
api.options.max = 1;
const worker = createPool(url("ATLAS_TEST_WORKER_URL"), "atlas-access-worker");
const owner = randomUUID(),
  otherOwner = randomUUID(),
  w = randomUUID(),
  otherW = randomUUID(),
  pa = randomUUID(),
  pb = randomUUID(),
  a = randomUUID(),
  b = randomUUID(),
  ca = randomUUID(),
  cb = randomUUID(),
  cp = randomUUID();
const tokenA = `atlas_${randomBytes(32).toString("base64url")}`,
  tokenB = `atlas_${randomBytes(32).toString("base64url")}`;
const lease = randomBytes(32).toString("base64url"),
  task = randomUUID(),
  grant = randomUUID(),
  job = randomUUID(),
  otherJob = randomUUID();
const ids: Record<string, string> = {};
const versions: Record<string, string> = {};
const chunks: Record<string, string> = {};
const human: Principal = {
  kind: "human",
  userId: owner,
  issuer: "https://fixture.example",
  subject: owner,
};
const otherHuman: Principal = {
  kind: "human",
  userId: otherOwner,
  issuer: "https://fixture.example",
  subject: otherOwner,
};
const agentA: Extract<Principal, { kind: "agent" }> = {
  kind: "agent",
  agentId: a,
  credentialId: ca,
  workspaceId: w,
};
const agentB: Extract<Principal, { kind: "agent" }> = {
  kind: "agent",
  agentId: b,
  credentialId: cb,
  workspaceId: w,
};
const processor: Extract<Principal, { kind: "agent" }> = {
  kind: "agent",
  agentId: a,
  credentialId: cp,
  workspaceId: w,
};
const queryAs = <T>(principal: Principal, work: (c: PoolClient) => Promise<T>, workspace = w) =>
  withPrincipal(api, principal, workspace, work);

async function addItem(
  c: PoolClient,
  name: string,
  kind: string,
  scope: string,
  project: string | null = null,
  agent: string | null = null,
  workspace = w,
  id: string = randomUUID(),
) {
  ids[name] = id;
  const partition =
    scope === "personal"
      ? `personal:${workspace === w ? owner : otherOwner}`
      : scope === "global_development"
        ? `global:${workspace}`
        : scope === "project"
          ? `project:${project}`
          : scope === "agent_private"
            ? `agent:${agent}`
            : `shared:${hash(name)}`;
  await c.query(
    "INSERT INTO atlas.knowledge_items(workspace_id,id,kind,title,scope,project_id,owner_agent_id,access_partition) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [workspace, id, kind, `${name} content`, scope, project, agent, partition],
  );
  return id;
}
async function addSource(
  c: PoolClient,
  name: string,
  scope: string,
  project: string | null = null,
  agent: string | null = null,
  workspace = w,
  id?: string,
) {
  const source = await addItem(c, name, "source", scope, project, agent, workspace, id);
  const version = randomUUID(),
    chunk = randomUUID();
  versions[name] = version;
  chunks[name] = chunk;
  const text = `${name} original text`;
  await c.query("INSERT INTO atlas.sources(workspace_id,id,input_type) VALUES($1,$2,'note')", [
    workspace,
    source,
  ]);
  await c.query(
    "INSERT INTO atlas.source_versions(workspace_id,id,source_id,version,raw_sha256,normalized_sha256,object_key,byte_count,media_type,markdown,normalized_text) VALUES($1,$2,$3,1,$4,$4,$5,$6,'text/plain',$7,$7)",
    [workspace, version, source, hash(text), `${version}/original`, Buffer.byteLength(text), text],
  );
  await c.query(
    "INSERT INTO atlas.source_chunks(workspace_id,id,source_id,version_id,sequence,text,start_offset,end_offset,sha256,estimated_tokens) VALUES($1,$2,$3,$4,0,$5,0,$6,$7,20)",
    [workspace, chunk, source, version, text, text.length, hash(text)],
  );
  await c.query("UPDATE atlas.sources SET current_version_id=$3 WHERE workspace_id=$1 AND id=$2", [
    workspace,
    source,
    version,
  ]);
}
async function addMemory(c: PoolClient, name: string, evidence: string[]) {
  const id = await addItem(c, name, "memory", "project", pa);
  await c.query(
    "INSERT INTO atlas.memories(workspace_id,id,type,subject_key,structured_content,summary,status,claim_kind,verified_by_user_id,verified_at) VALUES($1,$2,'semantic',$3,'{}',$3,'active','explicit_fact',$4,now())",
    [w, id, name, owner],
  );
  for (const source of evidence)
    await c.query(
      "INSERT INTO atlas.memory_evidence(workspace_id,memory_id,source_version_id,chunk_id,start_offset,end_offset,quote_sha256) VALUES($1,$2,$3,$4,0,$5,$6)",
      [
        w,
        id,
        versions[source],
        chunks[source],
        `${source} original text`.length,
        hash(`${source} original text`),
      ],
    );
}

beforeAll(async () => {
  await applyMigrations(admin, await readMigrations(resolve("database/migrations")));
  // Guarded disposable local fixture only. No cloud URL or real vault can reach this reset.
  const c = await admin.connect();
  try {
    await c.query("BEGIN");
    await c.query("TRUNCATE atlas.app_users CASCADE");
    await c.query("SET LOCAL ROLE atlas_owner");
    await c.query(
      "INSERT INTO atlas.app_users(id,issuer,subject) VALUES($1::uuid,'https://fixture.example',$1::uuid::text),($2::uuid,'https://fixture.example',$2::uuid::text)",
      [owner, otherOwner],
    );
    await createOwnerWorkspace(c, {
      ownerUserId: owner,
      workspaceId: w,
      name: "Owner fixture",
      collections: [],
    });
    await createOwnerWorkspace(c, {
      ownerUserId: otherOwner,
      workspaceId: otherW,
      name: "Other fixture",
      collections: [],
    });
    for (const [id, name] of [
      [pa, "project-a"],
      [pb, "project-b"],
    ])
      await c.query("INSERT INTO atlas.projects(workspace_id,id,slug,name) VALUES($1,$2,$3,$3)", [
        w,
        id,
        name,
      ]);
    for (const id of [a, b])
      await c.query(
        "INSERT INTO atlas.agents(workspace_id,id,name,type) VALUES($1,$2,'Synthetic','codex')",
        [w, id],
      );
    for (const [id, agent, token, operations] of [
      [ca, a, tokenA, ["read", "propose", "process_knowledge"]],
      [cb, b, tokenB, ["read", "propose", "process_knowledge"]],
      [cp, a, `atlas_${randomBytes(32).toString("base64url")}`, ["process_knowledge"]],
    ])
      await c.query(
        "INSERT INTO atlas_private.agent_credentials(workspace_id,id,agent_id,token_digest,display_prefix,expires_at,operations) VALUES($1,$2,$3,$4,'atlas_test',now()+interval '1 day',$5)",
        [w, id, agent, hash(String(token)), operations],
      );
    await c.query(
      "INSERT INTO atlas_private.agent_project_grants(workspace_id,agent_id,project_id,read,propose,process_knowledge) VALUES($1,$2,$3,true,true,true),($1,$4,$5,true,true,true)",
      [w, a, pa, b, pb],
    );
    await c.query(
      "INSERT INTO atlas_private.agent_scope_grants(workspace_id,agent_id,scope,read,propose,process_knowledge) VALUES($1,$2,'global_development',true,true,true),($1,$2,'agent_private',true,true,true),($1,$3,'agent_private',true,true,true)",
      [w, a, b],
    );
    await addSource(c, "personal", "personal");
    await addSource(c, "global", "global_development");
    await addSource(c, "projectA", "project", pa);
    await addSource(c, "projectB", "project", pb);
    await addSource(c, "privateA", "agent_private", null, a);
    await addSource(c, "privateB", "agent_private", null, b);
    await addSource(c, "sharedA", "shared_agents");
    await addSource(c, "sharedB", "shared_agents");
    // Deliberately colliding item UUID in the other workspace proves the mandatory row boundary.
    await addSource(c, "foreign", "global_development", null, null, otherW, ids.global);
    await c.query(
      "INSERT INTO atlas_private.item_agent_grants(workspace_id,agent_id,item_id,read,propose,process_knowledge) VALUES($1,$2,$3,true,true,true),($1,$4,$5,true,true,true)",
      [w, a, ids.sharedA, b, ids.sharedB],
    );
    await addMemory(c, "allowedMemory", ["projectA", "global"]);
    await addMemory(c, "privateEvidenceMemory", ["projectA", "personal"]);
    await addMemory(c, "emptyEvidenceMemory", []);
    await c.query(
      "INSERT INTO atlas.memory_versions(workspace_id,memory_id,version,snapshot,reason) VALUES($1,$2,1,'{\"old_private_text\":\"hidden\"}','Synthetic history')",
      [w, ids.allowedMemory],
    );
    const entity = await addItem(c, "hiddenEntity", "entity", "project", pa);
    await c.query(
      "INSERT INTO atlas.entities(workspace_id,id,access_partition,canonical_key,entity_type,status,approved_by_user_id,approved_at) VALUES($1,$2,$3,'hidden-concept','concept','active',$4,now())",
      [w, entity, `project:${pa}`, owner],
    );
    await c.query(
      "INSERT INTO atlas.entity_evidence(workspace_id,entity_id,source_version_id,start_offset,end_offset,quote_sha256) VALUES($1,$2,$3,0,$4,$5)",
      [
        w,
        entity,
        versions.personal,
        "personal original text".length,
        hash("personal original text"),
      ],
    );
    for (const [name, to] of [
      ["allowedEdge", "global"],
      ["hiddenEdge", "personal"],
    ]) {
      if (!name || !to) throw Error("Invalid fixture edge");
      const id = await addItem(c, name, "relationship", "project", pa);
      await c.query(
        "INSERT INTO atlas.relationships(workspace_id,id,from_item_id,to_item_id,from_kind,to_kind,type,status,claim_kind) VALUES($1,$2,$3,$4,'source','source','RELATED_TO','active','explicit_fact')",
        [w, id, ids.projectA, ids[to]],
      );
      await c.query(
        "INSERT INTO atlas.relationship_evidence(workspace_id,relationship_id,source_version_id,start_offset,end_offset,quote_sha256) VALUES($1,$2,$3,0,$4,$5)",
        [w, id, versions.projectA, "projectA original text".length, hash("projectA original text")],
      );
    }
    for (const [name, source] of [
      ["visibleCollection", "projectA"],
      ["hiddenCollection", "personal"],
    ]) {
      const id = randomUUID();
      if (!name || !source) throw Error("Invalid fixture collection");
      ids[name] = id;
      await c.query(
        "INSERT INTO atlas.collections(workspace_id,id,name,normalized_name) VALUES($1,$2,$3,lower($3))",
        [w, id, name],
      );
      await c.query(
        "INSERT INTO atlas.collection_items(workspace_id,collection_id,item_id,origin) VALUES($1,$2,$3,'manual')",
        [w, id, ids[source]],
      );
      const tag = randomUUID();
      ids[`${name}Tag`] = tag;
      await c.query(
        "INSERT INTO atlas.tags(workspace_id,id,name,normalized_name) VALUES($1,$2,$3,lower($3))",
        [w, tag, name],
      );
      await c.query(
        "INSERT INTO atlas.knowledge_tags(workspace_id,tag_id,item_id) VALUES($1,$2,$3)",
        [w, tag, ids[source]],
      );
    }
    for (const name of ["projectA", "personal"])
      await c.query(
        "INSERT INTO atlas.search_documents(workspace_id,item_id,chunk_id,source_version_id,text,normalizer_version,origin_key) VALUES($1,$2,$3,$4,$5,'v1',$5)",
        [w, ids[name], chunks[name], versions[name], name],
      );
    await c.query(
      "INSERT INTO atlas.search_documents(workspace_id,item_id,item_revision,text,normalizer_version,origin_key) VALUES($1,$2,1,'private evidence summary','v1','private-memory')",
      [w, ids.privateEvidenceMemory],
    );
    for (const [name, item] of [
      ["visibleTrace", "projectA"],
      ["hiddenTrace", "personal"],
    ]) {
      if (!name || !item) throw Error("Invalid trace");
      const id = randomUUID();
      ids[name] = id;
      await c.query(
        "INSERT INTO atlas.retrieval_traces(workspace_id,id,agent_id,query_hash,requested_tokens,used_tokens,latency_ms) VALUES($1,$2,$3,$4,2048,20,1)",
        [w, id, a, hash(name)],
      );
      await c.query(
        "INSERT INTO atlas.retrieval_trace_items(workspace_id,trace_id,item_id,item_revision,rank) VALUES($1,$2,$3,1,0)",
        [w, id, ids[item]],
      );
    }
    await c.query(
      "INSERT INTO atlas.organization_tasks(workspace_id,id,source_version_id,expected_source_revision,batch_index,chunk_ids,allowed_collection_ids,assigned_agent_id,state,lease_digest,lease_expires_at,first_claimed_at,claimed_by_agent_id) VALUES($1,$2,$3,1,0,$4,$5,$6,'claimed',$7,now()+interval '15 minutes',now(),$6)",
      [w, task, versions.personal, [chunks.personal], [ids.visibleCollection], a, hash(lease)],
    );
    await c.query(
      "INSERT INTO atlas_private.processing_grants(workspace_id,id,source_version_id,agent_id,granted_by_user_id,allowed_collection_ids) VALUES($1,$2,$3,$4,$5,$6)",
      [w, grant, versions.personal, a, owner, [ids.visibleCollection]],
    );
    // The second chunk and old version are intentionally outside the processing grant's batch.
    const extra = randomUUID();
    ids.extraChunk = extra;
    await c.query(
      "INSERT INTO atlas.source_chunks(workspace_id,id,source_id,version_id,sequence,text,start_offset,end_offset,sha256,estimated_tokens) VALUES($1,$2,$3,$4,1,'personal',0,8,$5,4)",
      [w, extra, ids.personal, versions.personal, hash("personal")],
    );
    for (const [id, name, delay] of [
      [job, "projectA", "2 days"],
      [otherJob, "projectB", "1 day"],
    ])
      await c.query(
        "INSERT INTO atlas.ingestion_jobs(workspace_id,id,kind,source_version_id,stage,idempotency_key,available_at) VALUES($1,$2,'chunk',$3,'chunk',$4,now()-$5::interval)",
        [w, id, versions[String(name)], hash(String(id)), delay],
      );
    await c.query("COMMIT");
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
}, 20000);
afterAll(async () => {
  // Test-created rows only exist in the exact dedicated local test database.
  await admin.query("TRUNCATE atlas.app_users CASCADE");
  await Promise.all([admin.end(), api.end(), worker.end()]);
});

describe("real non-owner authorization", () => {
  it("resolves only active digested credentials without exposing secrets", async () => {
    expect(await authenticateAgent(api, tokenA)).toEqual(agentA);
    await expect(authenticateAgent(api, `atlas_${"X".repeat(43)}`)).rejects.toThrow(
      "Access denied",
    );
    for (const pool of [api, worker])
      await expect(
        pool.query("SELECT token_digest FROM atlas_private.agent_credentials"),
      ).rejects.toMatchObject({ code: "42501" });
    await expect(
      worker.query("SELECT * FROM atlas_private.authenticate_agent($1)", [hash(tokenA)]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("lets each enabled owner see only their own workspace and rejects incorrect JWT identity context", async () => {
    const one = await queryAs(human, (c) =>
      c.query("SELECT DISTINCT workspace_id FROM atlas.knowledge_items"),
    );
    expect(one.rows).toEqual([{ workspace_id: w }]);
    const two = await queryAs(
      otherHuman,
      (c) => c.query("SELECT DISTINCT workspace_id FROM atlas.knowledge_items"),
      otherW,
    );
    expect(two.rows).toEqual([{ workspace_id: otherW }]);
    expect(
      (
        await queryAs({ ...human, subject: "forged" }, (c) =>
          c.query("SELECT id FROM atlas.knowledge_items"),
        )
      ).rowCount,
    ).toBe(0);
    expect(
      (await queryAs(human, (c) => c.query("SELECT id FROM atlas.knowledge_items"), otherW))
        .rowCount,
    ).toBe(0);
  });
  it("enforces all five scopes and rejects colliding item UUIDs across workspaces", async () => {
    const rows = await queryAs(agentA, (c) =>
      c.query("SELECT title,workspace_id FROM atlas.knowledge_items ORDER BY title"),
    );
    expect(rows.rows.map((r) => r.title)).toEqual([
      "allowedEdge content",
      "allowedMemory content",
      "global content",
      "privateA content",
      "projectA content",
      "sharedA content",
    ]);
    expect(rows.rows.every((r) => r.workspace_id === w)).toBe(true);
    const rowsB = await queryAs(agentB, (c) =>
      c.query("SELECT title FROM atlas.knowledge_items ORDER BY title"),
    );
    expect(rowsB.rows.map((r) => r.title)).toEqual([
      "privateB content",
      "projectB content",
      "sharedB content",
    ]);
  });
  it("hides private evidence summaries/entities/edges, source children and prior memory snapshots", async () =>
    queryAs(agentA, async (c) => {
      expect((await c.query("SELECT id FROM atlas.memories")).rows).toEqual([
        { id: ids.allowedMemory },
      ]);
      expect((await c.query("SELECT id FROM atlas.entities")).rowCount).toBe(0);
      expect((await c.query("SELECT id FROM atlas.relationships")).rows).toEqual([
        { id: ids.allowedEdge },
      ]);
      expect(
        (await c.query("SELECT id FROM atlas.source_versions WHERE source_id=$1", [ids.personal]))
          .rowCount,
      ).toBe(0);
      expect((await c.query("SELECT snapshot FROM atlas.memory_versions")).rowCount).toBe(0);
      await expect(requireItemAccess(c, ids.privateEvidenceMemory ?? "", "read")).rejects.toThrow(
        "Access denied",
      );
    }));
  it("filters collections, tags, search results and traces before counts", async () =>
    queryAs(agentA, async (c) => {
      expect((await c.query("SELECT id FROM atlas.collections")).rows).toEqual([
        { id: ids.visibleCollection },
      ]);
      expect((await c.query("SELECT id FROM atlas.tags")).rows).toEqual([
        { id: ids.visibleCollectionTag },
      ]);
      expect(
        (await c.query("SELECT count(*)::int AS count FROM atlas.search_documents")).rows[0].count,
      ).toBe(1);
      expect((await c.query("SELECT id FROM atlas.retrieval_traces")).rows).toEqual([
        { id: ids.visibleTrace },
      ]);
      expect(
        (await c.query("SELECT count(*)::int AS count FROM atlas.retrieval_trace_items")).rows[0]
          .count,
      ).toBe(1);
    }));
  it("denies missing/malformed context and clears principal identity after pooled reuse/rollback", async () => {
    expect((await api.query("SELECT id FROM atlas.knowledge_items")).rowCount).toBe(0);
    await queryAs(agentA, (c) => c.query("SELECT id FROM atlas.knowledge_items"));
    await expect(
      queryAs(human, async (c) => {
        await c.query("SELECT id FROM atlas.knowledge_items");
        throw Error("rollback probe");
      }),
    ).rejects.toThrow("rollback probe");
    expect((await api.query("SELECT id FROM atlas.knowledge_items")).rowCount).toBe(0);
    await api.query("BEGIN");
    try {
      await api.query(
        "SELECT set_config('app.workspace_id','invalid',true),set_config('app.user_id','invalid',true)",
      );
      expect((await api.query("SELECT id FROM atlas.knowledge_items")).rowCount).toBe(0);
    } finally {
      await api.query("ROLLBACK");
    }
  });
  it("allows owner writes with own provenance but prevents an agent from modifying or approving canonical data", async () => {
    await queryAs(human, async (c) => {
      const id = randomUUID();
      await c.query(
        "INSERT INTO atlas.collections(workspace_id,id,name,normalized_name,created_by_user_id) VALUES($1,$2,'Owner created','owner created',$3)",
        [w, id, owner],
      );
      await c.query("DELETE FROM atlas.collections WHERE workspace_id=$1 AND id=$2", [w, id]);
    });
    expect(
      (
        await queryAs(agentA, (c) =>
          c.query("UPDATE atlas.memories SET status='archived' WHERE id=$1", [ids.allowedMemory]),
        )
      ).rowCount,
    ).toBe(0);
    await expect(
      queryAs(agentA, (c) =>
        c.query(
          "INSERT INTO atlas.agents(workspace_id,name,type,created_by_agent_id) VALUES($1,'Forged','other',$2)",
          [w, a],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      queryAs(agentA, (c) => c.query("UPDATE atlas_private.agent_project_grants SET read=true")),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("permits only evidence-scoped pending proposals and denies forged reviewer/actor", async () => {
    await queryAs(agentA, async (c) => {
      await c.query(
        "INSERT INTO atlas.review_queue(workspace_id,kind,target_item_id,direct_request_key,payload,created_by_agent_id) VALUES($1,'decision',$2,$3,'{}',$4)",
        [w, ids.projectA, randomUUID(), a],
      );
      await requireItemAccess(c, ids.projectA ?? "", "propose");
    });
    await expect(
      queryAs(agentA, (c) =>
        c.query(
          "INSERT INTO atlas.review_queue(workspace_id,kind,target_item_id,direct_request_key,payload,status,reviewer_user_id,reviewed_at,created_by_agent_id) VALUES($1,'decision',$2,$3,'{}','approved',$4,now(),$5)",
          [w, ids.projectA, randomUUID(), owner, a],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      queryAs(agentA, (c) =>
        c.query(
          "INSERT INTO atlas.review_queue(workspace_id,kind,target_item_id,direct_request_key,payload,created_by_agent_id) VALUES($1,'decision',$2,$3,'{}',$4)",
          [w, ids.personal, randomUUID(), a],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("immediately removes derivatives, graph edges and traces when supporting source grants are revoked", async () => {
    await admin.query(
      "UPDATE atlas_private.agent_scope_grants SET read=false,propose=false,process_knowledge=false WHERE workspace_id=$1 AND agent_id=$2 AND scope='global_development'",
      [w, a],
    );
    try {
      await queryAs(agentA, async (c) => {
        expect((await c.query("SELECT id FROM atlas.memories")).rowCount).toBe(0);
        expect((await c.query("SELECT id FROM atlas.relationships")).rowCount).toBe(0);
      });
    } finally {
      await admin.query(
        "UPDATE atlas_private.agent_scope_grants SET read=true,propose=true,process_knowledge=true WHERE workspace_id=$1 AND agent_id=$2 AND scope='global_development'",
        [w, a],
      );
    }
    await admin.query(
      "UPDATE atlas_private.agent_project_grants SET read=false,propose=false,process_knowledge=false WHERE workspace_id=$1 AND agent_id=$2",
      [w, a],
    );
    try {
      expect(
        (await queryAs(agentA, (c) => c.query("SELECT id FROM atlas.retrieval_traces"))).rowCount,
      ).toBe(0);
    } finally {
      await admin.query(
        "UPDATE atlas_private.agent_project_grants SET read=true,propose=true,process_knowledge=true WHERE workspace_id=$1 AND agent_id=$2",
        [w, a],
      );
    }
  });
  it("hides stale derivatives/search and hides source traces on quarantine", async () => {
    for (const change of [
      { set: "sensitivity='quarantined'", restore: "sensitivity='clear'" },
      { set: "current_version_id=NULL", restore: "current_version_id=$3" },
    ]) {
      await queryAs(agentA, async (c) => {
        await admin.query(
          `UPDATE atlas.sources SET ${change.set} WHERE workspace_id=$1 AND id=$2`,
          [w, ids.projectA],
        );
        try {
          expect((await c.query("SELECT id FROM atlas.memories")).rowCount).toBe(0);
          expect((await c.query("SELECT id FROM atlas.relationships")).rowCount).toBe(0);
          expect((await c.query("SELECT id FROM atlas.search_documents")).rowCount).toBe(0);
          // Traces contain item IDs/revisions, never source text. An unchanged
          // source audience may retain that metadata after a version switch.
          expect((await c.query("SELECT id FROM atlas.retrieval_traces")).rowCount).toBe(
            change.set.includes("quarantined") ? 0 : 1,
          );
        } finally {
          await admin.query(
            `UPDATE atlas.sources SET ${change.restore} WHERE workspace_id=$1 AND id=$2`,
            change.restore.includes("$3")
              ? [w, ids.projectA, versions.projectA]
              : [w, ids.projectA],
          );
        }
      });
    }
  });
  it("rechecks expired/revoked credentials and disabled owner/agent on every read", async () => {
    for (const change of [
      {
        sql: "UPDATE atlas_private.agent_credentials SET issued_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE workspace_id=$1 AND id=$2",
        undo: "UPDATE atlas_private.agent_credentials SET issued_at=now(),expires_at=now()+interval '1 day' WHERE workspace_id=$1 AND id=$2",
        values: [w, ca],
      },
      {
        sql: "UPDATE atlas_private.agent_credentials SET revoked_at=now() WHERE workspace_id=$1 AND id=$2",
        undo: "UPDATE atlas_private.agent_credentials SET revoked_at=NULL WHERE workspace_id=$1 AND id=$2",
        values: [w, ca],
      },
      {
        sql: "UPDATE atlas.agents SET disabled_at=now() WHERE workspace_id=$1 AND id=$2",
        undo: "UPDATE atlas.agents SET disabled_at=NULL WHERE workspace_id=$1 AND id=$2",
        values: [w, a],
      },
      {
        sql: "UPDATE atlas.app_users SET disabled_at=now() WHERE id=$1",
        undo: "UPDATE atlas.app_users SET disabled_at=NULL WHERE id=$1",
        values: [owner],
      },
    ]) {
      await admin.query(change.sql, change.values);
      try {
        expect(
          (await queryAs(agentA, (c) => c.query("SELECT id FROM atlas.knowledge_items"))).rowCount,
        ).toBe(0);
        await expect(authenticateAgent(api, tokenA)).rejects.toThrow("Access denied");
      } finally {
        await admin.query(change.undo, change.values);
      }
    }
  });
  it("a processing-only credential reads only its assigned private batch and no memory/general history", async () => {
    expect(
      (await queryAs(processor, (c) => c.query("SELECT id FROM atlas.source_chunks"))).rowCount,
    ).toBe(0);
    await withProcessingContext(api, processor, task, lease, async (c) => {
      // Whole versions include the full text, editor state and storage key.
      // A purpose-only batch grant must expose none of those columns.
      expect((await c.query("SELECT * FROM atlas.source_versions")).rowCount).toBe(0);
      expect((await c.query("SELECT id FROM atlas.source_chunks")).rows).toEqual([
        { id: chunks.personal },
      ]);
      expect((await c.query("SELECT id FROM atlas.memories")).rowCount).toBe(0);
      expect(
        (await c.query("SELECT id FROM atlas.source_chunks WHERE id=$1", [ids.extraChunk]))
          .rowCount,
      ).toBe(0);
    });
    expect((await api.query("SELECT id FROM atlas.source_chunks")).rowCount).toBe(0);
    await expect(withProcessingContext(api, agentB, task, lease, async () => true)).rejects.toThrow(
      "Access denied",
    );
    await expect(
      withProcessingContext(
        api,
        processor,
        task,
        randomBytes(32).toString("base64url"),
        async () => true,
      ),
    ).rejects.toThrow("Access denied");
  });
  it("rejects revoked grants, quarantined content, stale revisions and expired/rotated task leases", async () => {
    const variants = [
      {
        sql: "UPDATE atlas_private.processing_grants SET revoked_at=now() WHERE workspace_id=$1 AND id=$2",
        undo: "UPDATE atlas_private.processing_grants SET revoked_at=NULL WHERE workspace_id=$1 AND id=$2",
        values: [w, grant],
      },
      {
        sql: "UPDATE atlas.sources SET sensitivity='quarantined' WHERE workspace_id=$1 AND id=$2",
        undo: "UPDATE atlas.sources SET sensitivity='clear' WHERE workspace_id=$1 AND id=$2",
        values: [w, ids.personal],
      },
      {
        sql: "UPDATE atlas.sources SET content_revision=2 WHERE workspace_id=$1 AND id=$2",
        undo: "UPDATE atlas.sources SET content_revision=1 WHERE workspace_id=$1 AND id=$2",
        values: [w, ids.personal],
      },
      {
        sql: "UPDATE atlas.organization_tasks SET lease_expires_at=now()-interval '1 minute' WHERE workspace_id=$1 AND id=$2",
        undo: "UPDATE atlas.organization_tasks SET lease_expires_at=now()+interval '15 minutes' WHERE workspace_id=$1 AND id=$2",
        values: [w, task],
      },
      {
        sql: "UPDATE atlas.organization_tasks SET lease_digest=repeat('0',64) WHERE workspace_id=$1 AND id=$2",
        undo: "UPDATE atlas.organization_tasks SET lease_digest=$3 WHERE workspace_id=$1 AND id=$2",
        values: [w, task],
      },
    ];
    for (const variant of variants) {
      await admin.query(variant.sql, variant.values);
      try {
        await expect(
          withProcessingContext(api, processor, task, lease, async () => true),
        ).rejects.toThrow("Access denied");
      } finally {
        await admin.query(
          variant.undo,
          variant.undo.includes("$3") ? [...variant.values, hash(lease)] : variant.values,
        );
      }
    }
  });
  it("denies an expired named processing grant even with a current task lease", async () => {
    const expired = randomUUID();
    await admin.query(
      "UPDATE atlas_private.processing_grants SET revoked_at=now() WHERE workspace_id=$1 AND id=$2",
      [w, grant],
    );
    try {
      await admin.query(
        "INSERT INTO atlas_private.processing_grants(workspace_id,id,source_version_id,agent_id,allowed_collection_ids,granted_by_user_id,created_at,expires_at) SELECT workspace_id,$3,source_version_id,agent_id,allowed_collection_ids,granted_by_user_id,now()-interval '2 days',now()-interval '1 day' FROM atlas_private.processing_grants WHERE workspace_id=$1 AND id=$2",
        [w, grant, expired],
      );
      await expect(
        withProcessingContext(api, processor, task, lease, async () => true),
      ).rejects.toThrow("Access denied");
    } finally {
      await admin.query(
        "UPDATE atlas_private.processing_grants SET revoked_at=now() WHERE workspace_id=$1 AND id=$2",
        [w, expired],
      );
      await admin.query(
        "UPDATE atlas_private.processing_grants SET revoked_at=NULL WHERE workspace_id=$1 AND id=$2",
        [w, grant],
      );
    }
  });
  it("keeps definer helpers in the private NOLOGIN boundary with fixed search paths and no public execution", async () => {
    const helpers = await admin.query(
      "SELECT p.proconfig,r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='atlas_private' AND p.prosecdef",
    );
    expect(helpers.rowCount).toBeGreaterThan(0);
    for (const row of helpers.rows) {
      expect(row.rolname).toBe("atlas_owner");
      expect(row.rolcanlogin || row.rolsuper || row.rolbypassrls || row.public_execute).toBe(false);
      expect(row.proconfig).toContain('search_path=""');
    }
  });
  it("processing submissions require the actual agent and cannot become canonical approved memories", async () => {
    await withProcessingContext(api, processor, task, lease, async (c) => {
      await c.query(
        "INSERT INTO atlas.organization_submissions(workspace_id,task_id,agent_id,idempotency_key,payload_sha256,payload,created_by_agent_id) VALUES($1,$2,$3,'synthetic-processing',$4,'{}',$3)",
        [w, task, a, hash("{}")],
      );
    });
    await expect(
      withProcessingContext(api, processor, task, lease, (c) =>
        c.query(
          "INSERT INTO atlas.organization_submissions(workspace_id,task_id,agent_id,idempotency_key,payload_sha256,payload,created_by_agent_id) VALUES($1,$2,$3,'forged',$4,'{}',$3)",
          [w, task, b, hash("{}")],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("worker fenced lease boundary", () => {
  let context: JobContext;
  it("allows only the worker login to claim a job and read that job's source", async () => {
    await expect(api.query("SELECT * FROM atlas_private.claim_job()")).rejects.toMatchObject({
      code: "42501",
    });
    const claimed = await worker.query<{
      workspace_id: string;
      job_id: string;
      source_version_id: string;
      lease_token: string;
    }>("SELECT * FROM atlas_private.claim_job()");
    const row = claimed.rows[0];
    if (!row) throw Error("No job claimed");
    expect(row.job_id).toBe(job);
    context = {
      workspaceId: row.workspace_id,
      jobId: row.job_id,
      sourceVersionId: row.source_version_id,
      leaseToken: row.lease_token,
    };
    await withJobContext(worker, context, async (c) => {
      expect((await c.query("SELECT id FROM atlas.source_versions")).rows).toEqual([
        { id: versions.projectA },
      ]);
      expect((await c.query("SELECT id FROM atlas.ingestion_jobs")).rows).toEqual([{ id: job }]);
      expect((await c.query("SELECT id FROM atlas.knowledge_items")).rows).toEqual([
        { id: ids.projectA },
      ]);
    });
  });
  it("rejects worker impersonation, wrong job/source/lease and access to credentials or approval", async () => {
    expect(
      (
        await withPrincipal(worker, human, w, (c) =>
          c.query("SELECT id FROM atlas.knowledge_items"),
        )
      ).rowCount,
    ).toBe(0);
    await expect(withJobContext(api, context, async () => true)).rejects.toThrow("Access denied");
    for (const wrong of [
      { ...context, jobId: otherJob },
      { ...context, sourceVersionId: versions.projectB ?? null },
      { ...context, leaseToken: randomUUID() },
    ])
      await expect(withJobContext(worker, wrong, async () => true)).rejects.toThrow(
        "Access denied",
      );
    await expect(
      withJobContext(worker, context, (c) => c.query("UPDATE atlas.memories SET status='active'")),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      withJobContext(worker, context, (c) =>
        c.query("SELECT token_digest FROM atlas_private.agent_credentials"),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("allows scoped deterministic results and own worker provenance but denies another job's results", async () => {
    await withJobContext(worker, context, async (c) => {
      await c.query(
        "INSERT INTO atlas.job_results(workspace_id,job_id,stage,input_hash,pipeline_version,result) VALUES($1,$2,'chunk',$3,'v1','{}')",
        [w, job, hash("own-result")],
      );
      await c.query(
        "INSERT INTO atlas.activity_events(workspace_id,actor_kind,job_id,action,target_item_id,correlation_id) VALUES($1,'worker',$2,'chunked',$3,$4)",
        [w, job, ids.projectA, randomUUID()],
      );
      expect((await c.query("SELECT id FROM atlas.job_results")).rowCount).toBe(1);
    });
    await expect(
      withJobContext(worker, context, (c) =>
        c.query(
          "INSERT INTO atlas.job_results(workspace_id,job_id,stage,input_hash,pipeline_version,result) VALUES($1,$2,'chunk',$3,'v1','{}')",
          [w, otherJob, hash("forged-result")],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("heartbeats the current fenced lease and blocks access after cancellation/expiry", async () => {
    expect(
      await withJobContext(
        worker,
        context,
        async (c) =>
          (
            await c.query("SELECT atlas_private.heartbeat_job($1,$2) AS ok", [
              job,
              context.leaseToken,
            ])
          ).rows[0].ok,
      ),
    ).toBe(true);
    await admin.query(
      "UPDATE atlas.ingestion_jobs SET cancel_requested_at=now() WHERE workspace_id=$1 AND id=$2",
      [w, job],
    );
    try {
      await expect(withJobContext(worker, context, async () => true)).rejects.toThrow(
        "Access denied",
      );
    } finally {
      await admin.query(
        "UPDATE atlas.ingestion_jobs SET cancel_requested_at=NULL WHERE workspace_id=$1 AND id=$2",
        [w, job],
      );
    }
    await admin.query(
      "UPDATE atlas.ingestion_jobs SET lease_expires_at=now()-interval '1 second' WHERE workspace_id=$1 AND id=$2",
      [w, job],
    );
    try {
      await expect(withJobContext(worker, context, async () => true)).rejects.toThrow(
        "Access denied",
      );
    } finally {
      await admin.query(
        "UPDATE atlas.ingestion_jobs SET lease_expires_at=now()+interval '120 seconds' WHERE workspace_id=$1 AND id=$2",
        [w, job],
      );
    }
  });
  it("rechecks source versions and cancellation inside an already-open worker transaction", async () => {
    await withJobContext(worker, context, async (c) => {
      await admin.query(
        "UPDATE atlas.sources SET current_version_id=NULL WHERE workspace_id=$1 AND id=$2",
        [w, ids.projectA],
      );
      try {
        expect((await c.query("SELECT id FROM atlas.source_chunks")).rowCount).toBe(0);
      } finally {
        await admin.query(
          "UPDATE atlas.sources SET current_version_id=$3 WHERE workspace_id=$1 AND id=$2",
          [w, ids.projectA, versions.projectA],
        );
      }
      await admin.query(
        "UPDATE atlas.ingestion_jobs SET cancel_requested_at=now() WHERE workspace_id=$1 AND id=$2",
        [w, job],
      );
      try {
        await expect(
          c.query(
            "INSERT INTO atlas.job_results(workspace_id,job_id,stage,input_hash,pipeline_version,result) VALUES($1,$2,'chunk',$3,'v1','{}')",
            [w, job, hash("cancelled-write")],
          ),
        ).rejects.toMatchObject({ code: "42501" });
      } finally {
        await admin.query(
          "UPDATE atlas.ingestion_jobs SET cancel_requested_at=NULL WHERE workspace_id=$1 AND id=$2",
          [w, job],
        );
      }
    });
  });
  it("finishes only the matching job and clears worker identity after commit", async () => {
    expect(
      await withJobContext(
        worker,
        context,
        async (c) =>
          (
            await c.query("SELECT atlas_private.finish_job($1,$2,'completed') AS ok", [
              job,
              context.leaseToken,
            ])
          ).rows[0].ok,
      ),
    ).toBe(true);
    await expect(withJobContext(worker, context, async () => true)).rejects.toThrow(
      "Access denied",
    );
    expect((await worker.query("SELECT id FROM atlas.source_versions")).rowCount).toBe(0);
  });
});
