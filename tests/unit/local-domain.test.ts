import { mkdtemp, rm, readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalVault } from "@atlas/core/local-vault";
import {
  createLocalStore,
  createSourceService,
  chunkText,
  sha256,
  createAuthorization,
  createCollaboration,
  head,
  sourceData,
  versionData,
  createLocalOrganization,
  createRetrieval,
  packetUnits,
  packContext,
  backupLocalVault,
  restoreLocalVault,
  assertRead,
  htmlToText,
  isPublicAddress,
  validateImportUrl,
} from "@atlas/core/local-domain";
import { localMemorySchema, type LocalActor } from "@atlas/contracts";
import { createLocalServices } from "../../apps/api/src/local-vault.js";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";

let root: string;
const owner: LocalActor = { kind: "owner", id: "fixture-owner" };
const key = () => randomUUID();
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "atlas-domain-"));
});
afterEach(async () => {
  if (!root.includes("atlas-domain-")) throw Error("Invalid fixture root");
  await rm(root, { recursive: true, force: true });
});
function services() {
  const vault = createLocalVault(root, "fixture-agent"),
    store = createLocalStore(vault);
  return {
    vault,
    store,
    sources: createSourceService(store),
    auth: createAuthorization(store, { id: "fixture-installed" }),
    tasks: createCollaboration(store),
  };
}
describe("local domain integrity", () => {
  it("preserves exact source bytes, whitespace and Unicode spans across fresh stores", async () => {
    const s = services(),
      content = "  # Brief\r\n\r\nUse stable_id with 🧠 evidence.  \r\n",
      request_key = key();
    const saved = await s.sources.capture(owner, { request_key, title: "Brief", content });
    expect(await s.sources.capture(owner, { request_key, title: "Brief", content })).toEqual(saved);
    await expect(
      s.sources.capture(owner, { request_key, title: "Changed", content }),
    ).rejects.toMatchObject({ code: "REQUEST_CONFLICT" });
    const fresh = services(),
      c = await fresh.store.catalog(),
      v = versionData(c, String(saved.version_id));
    expect(v.text).toBe(content.replaceAll("\r\n", "\n"));
    expect((await fresh.store.read(v.original_path)).toString()).toBe(content);
    expect((await fresh.vault.snapshot()).notes).toHaveLength(0);
    const chunks = chunkText(String(saved.source_id), v.id, v.text);
    expect(chunks.map((x) => x.text).join("")).toBe(v.text);
    expect(chunkText(String(saved.source_id), v.id, v.text)).toEqual(chunks);
    expect(c.warnings).toEqual([]);
  });
  it("only acknowledges one concurrent expected head and preserves tampered bytes", async () => {
    const s = services(),
      saved = await s.sources.capture(owner, {
        request_key: key(),
        title: "Draft",
        content: "Original",
      }),
      c = await s.store.catalog(),
      r = head(c, "source", String(saved.source_id));
    const outcomes = await Promise.allSettled(
      ["First", "Second"].map((content) =>
        s.sources.edit(owner, r.entity_id, {
          request_key: key(),
          expected_revision: r.revision,
          expected_file_digest: r.file_digest,
          content,
        }),
      ),
    );
    expect(outcomes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const next = await s.store.catalog(),
      v = head(next, "version", sourceData(next, r.entity_id).current_version_id),
      path = await s.vault.safePath(v.path);
    const raw = await readFile(path, "utf8");
    await writeFile(path, raw + "\nExternal edit");
    const altered = await s.store.catalog();
    expect(altered.incomplete).toBe(true);
    await expect(
      s.sources.capture(owner, {
        request_key: key(),
        title: "Blocked",
        content: "Preserve current edit",
      }),
    ).rejects.toMatchObject({ code: "CATALOG_INTEGRITY" });
    expect(await readFile(path, "utf8")).toBe(raw + "\nExternal edit");
  });
  it("keeps private processing purpose-scoped and requires owner evidence review", async () => {
    const s = services(),
      saved = await s.sources.capture(owner, {
        request_key: key(),
        title: "Fictional decision",
        content: "The fictional clinic uses SQLite for its offline fixture.",
      });
    await s.sources.processJob(String(saved.job_id));
    const credential = await s.auth.create(owner, {
      request_key: key(),
      name: "Fixture processor",
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      capabilities: ["process_knowledge", "propose", "read"],
    });
    const actor = await s.auth.authenticate(String(credential.token)),
      c = await s.store.catalog(),
      r = head(c, "source", String(saved.source_id));
    expect(() => assertRead(c, actor, r.data)).toThrowError("NOT_FOUND");
    const granted = await s.tasks.grant(owner, r.entity_id, {
      request_key: key(),
      expected_revision: r.revision,
      agent_id: actor.id,
      source_version_id: saved.version_id,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    const taskId = String((granted.task_ids as string[])[0]);
    await expect(s.tasks.claim(actor, taskId, 256)).rejects.toMatchObject({
      code: "BUDGET_INSUFFICIENT",
    });
    expect(head(await s.store.catalog(), "task", taskId).data.state).toBe("awaiting_agent");
    const claim = await s.tasks.claim(actor, taskId, 8192);
    await expect(s.tasks.claim(actor, taskId, 8192)).rejects.toMatchObject({
      code: "TASK_ALREADY_CLAIMED",
    });
    await s.tasks.read(actor, taskId, claim.lease_token, {
      range: { start: 0, end: 3 },
      token_budget: 8192,
    });
    expect(head(await s.store.catalog(), "task", taskId).data.delivered_chunk_ids).toEqual([]);
    const read = await s.tasks.read(actor, taskId, claim.lease_token, { token_budget: 8192 });
    const chunk = read.chunks[0]!;
    const organization = {
      contract_version: 1,
      source_version_id: saved.version_id,
      expected_source_revision: 1,
      coverage_chunk_ids: claim.chunk_ids,
      classifications: [],
      tags: [],
      entities: [],
      relationships: [],
      memories: [
        {
          candidate_id: "decision",
          type: "project",
          title: "Fixture storage choice",
          subject_key: "fixture.storage",
          summary: "The fictional clinic uses SQLite.",
          structured_content: {},
          claim_kind: "explicit_fact",
          confidence: 0.9,
          evidence: [
            {
              source_version_id: saved.version_id,
              chunk_id: chunk.id,
              start_offset: chunk.start_offset,
              end_offset: chunk.end_offset,
              quote_sha256: sha256(chunk.text),
            },
          ],
        },
      ],
    };
    const requestKey = key(),
      submitted = await s.tasks.submit(actor, taskId, claim.lease_token, requestKey, organization);
    expect(
      await s.tasks.submit(actor, taskId, claim.lease_token, requestKey, organization),
    ).toEqual(submitted);
    const proposed = head(await s.store.catalog(), "memory", submitted.candidates[0]!.id);
    await expect(
      s.tasks.review(actor, "memory", proposed.entity_id, {
        request_key: key(),
        expected_revision: proposed.revision,
        action: "approve",
        reason: "Agent cannot approve",
      }),
    ).rejects.toMatchObject({ code: "OWNER_REQUIRED" });
    await s.tasks.review(owner, "memory", proposed.entity_id, {
      request_key: key(),
      expected_revision: proposed.revision,
      action: "approve",
      reason: "Checked against exact fictional source",
    });
    expect(head(await s.store.catalog(), "memory", proposed.entity_id).data.status).toBe("active");
    const agentRecord = head(await s.store.catalog(), "agent", actor.id);
    await s.auth.update(owner, actor.id, {
      request_key: key(),
      expected_revision: agentRecord.revision,
      revoke: true,
    });
    await expect(s.auth.authenticate(String(credential.token))).rejects.toMatchObject({
      code: "AGENT_ACCESS_DENIED",
    });
    await expect(
      s.tasks.submit(actor, taskId, claim.lease_token, requestKey, organization),
    ).rejects.toMatchObject({ code: "AGENT_ACCESS_DENIED" });
  });
});

describe("local API, retrieval and recovery", () => {
  it("reports omitted critical constraints within the complete escaped Unicode packet budget", () => {
    const items = Array.from({ length: 3 }, () => ({
      id: randomUUID(),
      type: "memory",
      title: "Critical fixture constraint",
      summary: '🧠\\"'.repeat(120),
      status: "active",
      critical: true,
      source_refs: [],
    }));
    const packet = packContext(items, 2048, randomUUID());
    expect(packet.items).toHaveLength(1);
    expect(packet.items[0]?.critical).toBe(true);
    expect(packet.warnings.some((w) => w.startsWith("BUDGET_INSUFFICIENT"))).toBe(true);
    expect(packet.budget.used).toBe(packetUnits(packet));
    expect(packet.budget.used).toBeLessThanOrEqual(2048);
    expect(() => packContext(items, 256, randomUUID())).toThrow("BUDGET_INSUFFICIENT");
  });
  it("requires the owner cookie, bounds uploads and keeps the existing workflow scoped", async () => {
    const token = `atlas_${"q".repeat(43)}`,
      local = createLocalServices(root, { agentId: "fixture-installed", token }),
      app = createApp(
        loadConfig({ API_PORT: "4321", NODE_ENV: "test" }),
        undefined,
        undefined,
        local,
      ),
      base = "http://localhost:4321";
    const json = { "Content-Type": "application/json" },
      cookie = { Cookie: `atlas_local=${local.cookie}`, ...json };
    try {
      expect((await app.request(`${base}/api/v1/local/domain/`)).status).toBe(401);
      expect(
        (
          await app.request(`${base}/api/v1/local/domain/`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ).status,
      ).toBe(401);
      expect((await app.request(`${base}/api/v1/local/domain`, { headers: cookie })).status).toBe(
        200,
      );
      const saved = await app.request(`${base}/api/v1/local/domain/sources`, {
        method: "POST",
        headers: cookie,
        body: JSON.stringify({
          request_key: key(),
          title: "Owner API source",
          content: "Private API canary",
        }),
      });
      expect(saved.status).toBe(201);
      const value = (await saved.json()) as { source_id: string };
      const read = await app.request(`${base}/api/v1/local/domain/sources/${value.source_id}`, {
        headers: cookie,
      });
      expect(read.status).toBe(200);
      const graph = await app.request(`${base}/api/v1/local/vault?proposals=1`, {
        headers: cookie,
      });
      expect(graph.status).toBe(200);
      expect(await graph.text()).not.toContain("Private API canary");
      const denied = await app.request(`${base}/api/v1/agent/domain/retrieval/source`, {
        method: "POST",
        headers: { ...json, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source_id: value.source_id }),
      });
      expect(denied.status).toBe(404);
      expect(await denied.text()).not.toContain("Private API canary");
      expect(
        (
          await app.request(`${base}/api/v1/agent/domain/session`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await app.request(`${base}/api/v1/local/domain/agents`, {
            method: "POST",
            headers: { ...cookie, Origin: "https://attacker.invalid" },
            body: "{}",
          })
        ).status,
      ).toBe(403);
      const spoof = await app.request(`${base}/api/v1/local/domain/uploads`, {
        method: "POST",
        headers: {
          Cookie: cookie.Cookie,
          "Content-Type": "application/octet-stream",
          "X-Atlas-Media-Type": "image/png",
        },
        body: "not a PNG",
      });
      expect(spoof.status).toBe(415);
      const until = Date.now() + 5000;
      while (local.domain.runner.status().running && Date.now() < until)
        await new Promise((r) => setTimeout(r, 20));
    } finally {
      local.domain.close();
    }
  }, 15000);
  it("returns source-backed current facts within the complete serialized budget and invalidates stale evidence", async () => {
    const s = services(),
      captured = await s.sources.capture(owner, {
        request_key: key(),
        title: "exact_identifier",
        content: "Use exact_identifier for the fictional offline project.",
      }),
      c = await s.store.catalog(),
      version = versionData(c, String(captured.version_id)),
      chunk = chunkText(String(captured.source_id), version.id, version.text)[0];
    if (!chunk) throw Error("Missing fixture chunk");
    const proposed = await s.tasks.propose(owner, {
        request_key: key(),
        title: "Identifier decision",
        subject_key: "fixture.identifier",
        type: "project",
        summary: "Use exact_identifier.",
        structured_content: {},
        claim_kind: "explicit_fact",
        scope: "personal",
        project_id: null,
        evidence: [
          {
            source_version_id: version.id,
            chunk_id: chunk.id,
            start_offset: chunk.start_offset,
            end_offset: chunk.end_offset,
            quote_sha256: chunk.text_sha256,
          },
        ],
      }),
      memory = head(await s.store.catalog(), "memory", String(proposed.memory_id));
    const retrieval = createRetrieval(s.store);
    await s.sources.capture(owner, {
      request_key: key(),
      title: "Identifier prefix confuser",
      content: "The fictional project also mentions exact_identifier_extended.",
    });
    expect(
      (
        await retrieval.retrieve(owner, { query: "Identifier decision", token_budget: 4096 })
      ).items.some((i) => i.id === memory.entity_id),
    ).toBe(false);
    await s.tasks.review(owner, "memory", memory.entity_id, {
      request_key: key(),
      expected_revision: memory.revision,
      action: "approve",
      reason: "Checked the fictional exact identifier",
    });
    const packet = await retrieval.retrieve(owner, {
      query: "exact_identifier",
      token_budget: 4096,
    });
    expect(packet.items.some((i) => i.id === memory.entity_id)).toBe(true);
    expect(packet.items[0]?.id).toBe(captured.source_id);
    expect(packet.budget.used).toBe(packetUnits(packet));
    expect(packet.budget.used).toBeLessThanOrEqual(4096);
    const trace = head(await s.store.catalog(), "trace", packet.trace_id);
    const receipt = JSON.parse(
      await readFile(
        join(s.store.vault.root, ".atlas", "transactions", trace.transaction_id, "manifest.json"),
        "utf8",
      ),
    );
    expect(receipt.result).toEqual({ trace_id: packet.trace_id });
    expect(JSON.stringify(receipt)).not.toContain("Use exact_identifier.");
    const current = head(await s.store.catalog(), "source", String(captured.source_id));
    await s.sources.edit(owner, current.entity_id, {
      request_key: key(),
      expected_revision: current.revision,
      expected_file_digest: current.file_digest,
      content: "A replacement source with different evidence.",
    });
    expect(
      (
        await retrieval.retrieve(owner, { query: "exact_identifier", token_budget: 4096 })
      ).items.some((i) => i.id === memory.entity_id),
    ).toBe(false);
    const historical = await retrieval.retrieve(owner, {
      query: "exact_identifier",
      include_history: true,
      token_budget: 4096,
    });
    const oldFact = historical.items.find((item) => item.id === memory.entity_id);
    expect(oldFact?.status).toContain("historical_evidence");
    expect(oldFact?.source_refs[0]?.source_version_id).toBe(captured.version_id);
    expect(historical.warnings.some((warning) => warning.startsWith("Historical evidence"))).toBe(
      true,
    );
  });
  it("restores exact originals and disables old credentials without touching the source vault", async () => {
    const s = services(),
      captured = await s.sources.capture(owner, {
        request_key: key(),
        title: "Recovery fixture",
        content: "Original fixture bytes.\r\n🧠",
      }),
      credential = await s.auth.create(owner, {
        request_key: key(),
        name: "Recovery agent",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });
    const container = join(root, "..", `atlas-domain-recovery-${key()}`);
    await mkdir(container);
    const exported = join(container, "backup"),
      restored = join(container, "Restored");
    try {
      const backup = await backupLocalVault(s.store, exported);
      expect(backup.complete).toBe(true);
      await restoreLocalVault(exported, restored);
      const restoredStore = createLocalStore(createLocalVault(restored, "restored")),
        original = versionData(await s.store.catalog(), String(captured.version_id)),
        copy = versionData(await restoredStore.catalog(), String(captured.version_id));
      expect(await restoredStore.read(copy.original_path)).toEqual(
        await s.store.read(original.original_path),
      );
      const restoredAuth = createAuthorization(restoredStore, { id: "not-enrolled" });
      await expect(restoredAuth.authenticate(String(credential.token))).rejects.toMatchObject({
        code: "AGENT_ACCESS_DENIED",
      });
      expect(
        head(await s.store.catalog(), "agent", String(credential.agent_id)).data.revoked_at,
      ).toBeNull();
      const manifest = JSON.parse(await readFile(join(exported, "manifest.json"), "utf8")) as {
        files: { path: string }[];
      };
      const damaged = manifest.files.find((f) => f.path.endsWith("original.txt"));
      if (!damaged) throw Error("Missing fixture original");
      await writeFile(join(exported, damaged.path), "Corrupted");
      await expect(
        restoreLocalVault(exported, join(container, "MustNotExist")),
      ).rejects.toMatchObject({ code: "BACKUP_INTEGRITY" });
    } finally {
      if (container.startsWith(join(tmpdir(), "atlas-domain-recovery-")))
        await rm(container, { recursive: true, force: true });
    }
  });
  it("rejects SSRF address classes and extracts HTML without scripts or network execution", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "169.254.169.254",
      "192.0.2.1",
      "::1",
      "::ffff:127.0.0.1",
      "fe80::1",
      "2001:db8::1",
      "2002:7f00:1::",
    ])
      expect(isPublicAddress(ip)).toBe(false);
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    for (const url of [
      "http://example.com",
      "https://127.0.0.1/",
      "https://localhost/",
      "https://example.com:8443/",
      "https://user:secret@example.com/",
      "https://metadata.local/",
      "https://example.com/#token",
    ])
      expect(() => validateImportUrl(url)).toThrow();
    expect(
      htmlToText(
        "<html><head><script>steal()</script></head><body><nav>Menu</nav><main><h1>Decision</h1><p>Keep exact_identifier.</p><script>run()</script></main></body></html>",
      ),
    ).toContain("# Decision");
    expect(
      htmlToText("<main><p>Useful</p><script>run()</script><form>Password</form></main>"),
    ).toBe("Useful");
  });
  it("does not acknowledge read-only/full-disk publication failures and resumes the exact pending operation", async () => {
    const s = services();
    for (const code of ["EACCES", "ENOSPC"]) {
      const before = [...(await s.store.catalog()).heads.values()].filter(
        (r) => r.kind === "source",
      ).length;
      const input = {
        request_key: key(),
        title: `Fictional ${code} failure`,
        content: `Recoverable exact original for ${code}. 🧠\r\n`,
      };
      const write = s.vault.writeExclusive;
      s.vault.writeExclusive = async (path, bytes) => {
        if (path.endsWith("/COMMITTED.json"))
          throw Object.assign(Error("Controlled filesystem publication fault"), { code });
        return write(path, bytes);
      };
      try {
        await expect(s.sources.capture(owner, input)).rejects.toMatchObject({ code });
      } finally {
        s.vault.writeExclusive = write;
      }
      expect(
        [...(await s.store.catalog()).heads.values()].filter((r) => r.kind === "source"),
      ).toHaveLength(before);
      expect((await s.vault.snapshot()).notes).toHaveLength(0);
      const recovered = await s.sources.capture(owner, input);
      expect(await s.sources.capture(owner, input)).toEqual(recovered);
      expect(
        [...(await s.store.catalog()).heads.values()].filter((r) => r.kind === "source"),
      ).toHaveLength(before + 1);
      const version = versionData(await s.store.catalog(), String(recovered.version_id));
      expect((await s.store.read(version.original_path)).toString()).toBe(input.content);
    }
  }, 30000);
  it("rejects oversized records and operation admission before writing any output", async () => {
    const s = services();
    let writes = 0;
    const write = s.vault.writeExclusive;
    s.vault.writeExclusive = async (path, bytes) => {
      writes++;
      return write(path, bytes);
    };
    try {
      await expect(
        s.store.transaction(owner, key(), { fixture: "output-limit" }, () => ({
          mutations: Array.from({ length: 1001 }, (_, i) => ({
            kind: "settings" as const,
            entity_id: `admission-${i}`,
            expected_revision: 0,
            data: { value: i },
            body: "Controlled admission fixture.",
          })),
          result: {},
        })),
      ).rejects.toMatchObject({ code: "OPERATION_TOO_LARGE" });
      await expect(
        s.store.transaction(owner, key(), { fixture: "record-limit" }, () => ({
          mutations: [
            {
              kind: "settings",
              entity_id: "oversized",
              expected_revision: 0,
              data: {},
              body: "x".repeat(2097152),
            },
          ],
          result: {},
        })),
      ).rejects.toMatchObject({ code: "RECORD_TOO_LARGE" });
      expect(writes).toBe(0);
      expect((await s.store.catalog()).heads.size).toBe(0);
    } finally {
      s.vault.writeExclusive = write;
      s.store.close();
    }
  }, 30000);
  it("resumes the exact staged operation after lost commit publication", async () => {
    const s = services(),
      request_key = key(),
      input = { request_key, title: "Crash fixture", content: "Exact crash recovery original." },
      saved = await s.sources.capture(owner, input);
    const folder = join(root, ".atlas", "transactions"),
      entries = await readdir(folder);
    let transaction = "";
    for (const entry of entries) {
      const m = JSON.parse(await readFile(join(folder, entry, "manifest.json"), "utf8"));
      if (m.request_key === request_key) transaction = entry;
    }
    if (!transaction) throw Error("Missing fixture transaction");
    await unlink(join(folder, transaction, "COMMITTED.json"));
    expect((await s.store.catalog()).heads.size).toBe(0);
    expect(await services().sources.capture(owner, input)).toEqual(saved);
    expect(head(await services().store.catalog(), "source", String(saved.source_id)).revision).toBe(
      1,
    );
  });
  it("fences concurrent workers and recovers an expired deterministic worker lease", async () => {
    const s = services(),
      captured = await s.sources.capture(owner, {
        request_key: key(),
        title: "Worker fixture",
        content: "Stable chunks.",
      });
    let finish: () => void = () => {};
    const blocked = new Promise<void>((r) => {
        finish = r;
      }),
      slow = createSourceService(
        s.store,
        () => {},
        async (a, b, text) => {
          await blocked;
          return chunkText(a, b, text);
        },
      ),
      running = slow.processJob(String(captured.job_id));
    let c = await s.store.catalog();
    for (
      let i = 0;
      i < 50 && head(c, "job", String(captured.job_id)).data.state !== "running";
      i++
    ) {
      await new Promise((r) => setTimeout(r, 10));
      c = await s.store.catalog();
    }
    await expect(s.sources.processJob(String(captured.job_id))).rejects.toMatchObject({
      code: "JOB_LEASE_BUSY",
    });
    const job = head(c, "job", String(captured.job_id));
    await s.store.transaction(owner, key(), { fixture: "expire" }, () => ({
      mutations: [
        {
          kind: "job",
          entity_id: job.entity_id,
          expected_revision: job.revision,
          data: { ...job.data, lease_expires_at: "2000-01-01T00:00:00.000Z" },
          body: "Controlled stale lease fixture.",
        },
      ],
      result: {},
    }));
    await s.sources.processJob(String(captured.job_id));
    finish();
    await expect(running).rejects.toMatchObject({ code: "JOB_LEASE_LOST" });
    expect(head(await s.store.catalog(), "job", String(captured.job_id)).data.state).toBe(
      "completed",
    );
  });
  it("intersects all five API audiences and immediately restricts source-derived access", async () => {
    const s = services(),
      project = await s.vault.ensure({
        repository_digest: sha256("audience-project"),
        name: "Audience fixture",
      }),
      a = await s.auth.create(owner, {
        request_key: key(),
        name: "Agent A",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        capabilities: ["read"],
        project_ids: [project.id],
        scopes: ["global_development", "agent_private", "shared_agents"],
      }),
      b = await s.auth.create(owner, {
        request_key: key(),
        name: "Agent B",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        capabilities: ["read"],
        scopes: ["global_development", "agent_private", "shared_agents"],
      });
    const actorA: LocalActor = { kind: "agent", id: String(a.agent_id) },
      actorB: LocalActor = { kind: "agent", id: String(b.agent_id) },
      saved = await s.sources.capture(owner, {
        request_key: key(),
        title: "Audience canary",
        content: "Sensitive controlled audience fixture.",
      });
    for (const [scope, canA, canB] of [
      ["personal", false, false],
      ["project", true, false],
      ["global_development", true, true],
      ["agent_private", true, false],
      ["shared_agents", true, false],
    ] as const) {
      const r = head(await s.store.catalog(), "source", String(saved.source_id));
      await s.sources.access(owner, r.entity_id, {
        request_key: key(),
        expected_revision: r.revision,
        scope,
        project_id: scope === "project" ? project.id : null,
        owner_agent_id: scope === "agent_private" ? actorA.id : null,
        audience: scope === "shared_agents" ? [actorA.id] : [],
      });
      const c = await s.store.catalog(),
        source = sourceData(c, r.entity_id);
      for (const [actor, allowed] of [
        [actorA, canA],
        [actorB, canB],
      ] as const) {
        if (allowed) expect(() => assertRead(c, actor, source)).not.toThrow();
        else expect(() => assertRead(c, actor, source)).toThrow();
      }
    }
  });
  it("preserves manual exclusions and explicit collection merge conflicts atomically", async () => {
    const s = services(),
      org = createLocalOrganization(s.store),
      a = await org.collection(owner, { request_key: key(), name: "Original" }),
      b = await org.collection(owner, { request_key: key(), name: "Target" }),
      source = await s.sources.capture(owner, {
        request_key: key(),
        title: "Membership",
        content: "Controlled membership.",
      });
    let r = head(await s.store.catalog(), "source", String(source.source_id));
    await org.organize(owner, r.entity_id, {
      request_key: key(),
      expected_revision: r.revision,
      include: [a.collection_id],
      exclude: [b.collection_id],
    });
    const input = {
      request_key: key(),
      expected_revision: 1,
      target_id: b.collection_id,
      expected_target_revision: 1,
    };
    await expect(org.merge(owner, String(a.collection_id), input)).rejects.toMatchObject({
      code: "EXPLICIT_MEMBERSHIP_MAPPING_REQUIRED",
    });
    expect(head(await s.store.catalog(), "collection", String(a.collection_id)).data.archived).toBe(
      false,
    );
    await org.merge(owner, String(a.collection_id), {
      ...input,
      request_key: key(),
      membership_conflicts: { [String(source.source_id)]: "exclude" },
    });
    r = head(await s.store.catalog(), "source", String(source.source_id));
    expect(r.data.manual_exclude_ids).toEqual([b.collection_id]);
    expect(r.data.collection_ids).toEqual([]);
  });
  it("denies old secret-bearing source versions after redaction while preserving owner history", async () => {
    const s = services(),
      project = await s.vault.ensure({
        repository_digest: sha256("history-permissions"),
        name: "History permissions",
      }),
      credential = await s.auth.create(owner, {
        request_key: key(),
        name: "History reader",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        capabilities: ["read"],
        project_ids: [project.id],
      }),
      actor: LocalActor = { kind: "agent", id: String(credential.agent_id) },
      saved = await s.sources.capture(owner, {
        request_key: key(),
        title: "Fictional historical source",
        scope: "project",
        project_id: project.id,
        content: "password = fictional_sensitive_canary_123456",
      });
    const r = head(await s.store.catalog(), "source", String(saved.source_id));
    await s.sources.edit(owner, r.entity_id, {
      request_key: key(),
      expected_revision: r.revision,
      expected_file_digest: r.file_digest,
      content: "A redacted fictional source.",
    });
    const retrieval = createRetrieval(s.store);
    expect(
      JSON.stringify(await retrieval.readSource(actor, r.entity_id, { token_budget: 8192 })),
    ).not.toContain("fictional_sensitive_canary_123456");
    await expect(
      retrieval.readSource(actor, r.entity_id, {
        version_id: saved.version_id,
        token_budget: 8192,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      JSON.stringify(
        await retrieval.readSource(owner, r.entity_id, {
          version_id: saved.version_id,
          token_budget: 8192,
        }),
      ),
    ).toContain("fictional_sensitive_canary_123456");
  });
  it("continues beyond one hundred matching records without duplicates and fences index changes", async () => {
    const s = services();
    try {
      const saved = await s.sources.capture(owner, {
        request_key: key(),
        title: "Pagination evidence",
        content: "Fictional pagination fixture evidence.",
      });
      const v = versionData(await s.store.catalog(), String(saved.version_id));
      const chunk = chunkText(String(saved.source_id), v.id, v.text)[0]!;
      const evidence = [
        {
          source_version_id: v.id,
          chunk_id: chunk.id,
          start_offset: chunk.start_offset,
          end_offset: chunk.end_offset,
          quote_sha256: chunk.text_sha256,
        },
      ];
      const ids = Array.from({ length: 121 }, () => randomUUID());
      await s.store.transaction(owner, key(), { fixture: "pagination" }, () => ({
        mutations: ids.map((id, i) => ({
          kind: "memory" as const,
          entity_id: id,
          expected_revision: 0,
          data: localMemorySchema.parse({
            id,
            subject_key: `pagination.${i}`,
            type: "project",
            title: `Pagination ${i}`,
            summary: "Controlled pagination candidate.",
            structured_content: {},
            claim_kind: "explicit_fact",
            status: "active",
            evidence,
            critical: i === 0,
            retrieval_level: "detail",
            valid_from: new Date().toISOString(),
            valid_to: null,
            superseded_by_id: null,
            requires_revalidation: false,
            agent_id: null,
            approved_at: new Date().toISOString(),
            approved_by: owner.id,
          }),
          body: "Controlled pagination fixture.",
        })),
        result: {},
      }));
      const retrieval = createRetrieval(s.store);
      let packet = await retrieval.retrieve(
        owner,
        { query: "Pagination", token_budget: 8192 },
        { kind: "memory" },
      );
      const firstCursor = packet.continuation;
      expect(packet.items[0]?.id).toBe(ids[0]);
      const seen: string[] = [];
      for (let page = 0; page < 30; page++) {
        seen.push(...packet.items.map((i) => i.id));
        expect(packet.budget.used).toBeLessThanOrEqual(8192);
        if (!packet.has_more) break;
        expect(packet.items.length).toBeGreaterThan(0);
        packet = await retrieval.retrieve(
          owner,
          { query: "Pagination", token_budget: 8192, continuation: packet.continuation! },
          { kind: "memory" },
        );
      }
      expect(seen).toHaveLength(121);
      expect(new Set(seen)).toEqual(new Set(ids));
      await s.sources.capture(owner, {
        request_key: key(),
        title: "Unrelated new source",
        content: "A corpus revision without another matching memory.",
      });
      await expect(
        retrieval.retrieve(
          owner,
          { query: "Pagination", token_budget: 8192, continuation: firstCursor! },
          { kind: "memory" },
        ),
      ).rejects.toMatchObject({ code: "CONTINUATION_EXPIRED_OR_CHANGED" });
    } finally {
      s.store.close();
    }
  }, 30000);
  it("invalidates the large-catalog projection on direct edits and independent commits", async () => {
    const s = services();
    try {
      await s.store.transaction(owner, key(), { fixture: "indexed-catalog" }, () => ({
        mutations: Array.from({ length: 200 }, (_, i) => ({
          kind: "settings" as const,
          entity_id: `fixture-${i}`,
          expected_revision: 0,
          data: { value: i },
          body: `Controlled setting ${i}.`,
        })),
        result: {},
      }));
      const indexed = await s.store.catalog();
      expect(indexed.records).toHaveLength(200);
      const target = head(indexed, "settings", "fixture-1");
      const other = createLocalStore(s.vault);
      try {
        await other.transaction(owner, key(), { fixture: "independent-commit" }, () => ({
          mutations: [
            {
              kind: "settings",
              entity_id: target.entity_id,
              expected_revision: target.revision,
              data: { value: 999 },
              body: "Independent controlled replacement.",
            },
          ],
          result: {},
        }));
      } finally {
        other.close();
      }
      expect(head(await s.store.catalog(), "settings", target.entity_id).data.value).toBe(999);
      const captured = await s.sources.capture(owner, {
        request_key: key(),
        title: "Original integrity under the large projection",
        content: "Exact original must still be checked freshly.",
      });
      const reader = createLocalStore(s.vault);
      try {
        const version = versionData(await reader.catalog(), String(captured.version_id));
        await createRetrieval(reader).readSource(owner, String(captured.source_id), {});
        await writeFile(await s.vault.safePath(version.original_path), "Changed original canary");
        await expect(
          createRetrieval(reader).readSource(owner, String(captured.source_id), {}),
        ).rejects.toMatchObject({ code: "ORIGINAL_INTEGRITY" });
      } finally {
        reader.close();
      }
      const latest = head(await s.store.catalog(), "settings", target.entity_id);
      await writeFile(await s.vault.safePath(latest.path), "Direct external canary edit");
      expect((await s.store.catalog()).incomplete).toBe(true);
      await expect(
        s.store.transaction(owner, key(), {}, () => ({ mutations: [], result: {} })),
      ).rejects.toMatchObject({ code: "CATALOG_INTEGRITY" });
    } finally {
      s.store.close();
    }
  }, 30000);
});
