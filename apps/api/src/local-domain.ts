import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Hono, type Context } from "hono";
import { z, localSourceInputSchema, type LocalActor } from "@atlas/contracts";
import {
  DomainError,
  head,
  sourceData,
  versionData,
  chunkText,
  codePoints,
  normalized,
  sha256,
  canonical,
  fetchPublicUrl,
  backupLocalVault,
  restoreLocalVault,
  type createDomainService,
} from "@atlas/core/local-domain";
import type { ApiEnv } from "./app.js";

type Domain = ReturnType<typeof createDomainService>;
const owner: LocalActor = { kind: "owner", id: "local-owner" };
const requestBody = (c: Context<ApiEnv>) => c.req.json() as Promise<unknown>;
const bearer = (c: Context<ApiEnv>) => c.req.header("Authorization")?.replace(/^Bearer /, "");
export function ownerDomainRoutes(domain: Domain, cookie: string) {
  const app = new Hono<ApiEnv>();
  let uploading = false;
  const artifactRoot = resolve(domain.store.vault.root, "..", ".artifacts");
  app.use("*", async (c, next) => {
    if (
      c.req.header("Authorization") ||
      !c.req
        .header("Cookie")
        ?.split(";")
        .some((part) => part.trim() === `atlas_local=${cookie}`)
    )
      throw new DomainError("OWNER_SESSION_REQUIRED", 401);
    if (
      c.req.method !== "GET" &&
      !c.req.path.endsWith("/uploads") &&
      !c.req.header("Content-Type")?.startsWith("application/json")
    )
      throw new DomainError("JSON_REQUIRED", 415);
    await next();
  });
  app.get("/", async (c) => c.json(await domain.snapshot(owner)));
  app.get("/sources/:id", async (c) => {
    const catalog = await domain.store.catalog(),
      record = head(catalog, "source", c.req.param("id")),
      source = sourceData(catalog, record.entity_id),
      version = versionData(
        catalog,
        c.req.query("version") ? z.uuid().parse(c.req.query("version")) : source.current_version_id,
      );
    if (version.source_id !== source.id) throw new DomainError("NOT_FOUND", 404);
    return c.json({
      record,
      version,
      chunks: chunkText(source.id, version.id, version.text, version.pipeline_version),
      grants: [...catalog.heads.values()].filter(
        (r) => r.kind === "grant" && r.data.source_version_id === version.id,
      ),
      versions: [...catalog.heads.values()]
        .filter((r) => r.kind === "version" && r.data.source_id === source.id)
        .map((r) => ({
          id: r.entity_id,
          version: Number(r.data.version),
          captured_at: String(r.data.captured_at),
          extraction_status: String(r.data.extraction_status),
        }))
        .sort((a, b) => b.version - a.version),
    });
  });
  app.post("/sources", async (c) => {
    const v = localSourceInputSchema.parse(await requestBody(c));
    if (!v.upload_id) return c.json(await domain.sources.capture(owner, v), 201);
    const catalog = await domain.store.catalog(),
      receipt = catalog.heads.get(`upload_receipt:${v.upload_id}`);
    if (receipt) {
      if (receipt.data.request_key !== v.request_key)
        throw new DomainError("UPLOAD_ALREADY_CONSUMED");
      const version = versionData(catalog, String(receipt.data.version_id));
      return c.json(
        await domain.sources.capture(owner, v, {
          bytes: await domain.store.read(version.original_path),
          media_type: version.media_type,
          extension: version.original_path.split(".").at(-1) ?? "bin",
          text: version.text,
          extraction_status: version.extraction_status,
          page_ranges: version.page_ranges,
        }),
        201,
      );
    }
    const metadata = z
      .object({
        media_type: z.string(),
        extension: z.string(),
        sha256: z.string(),
        bytes: z.number(),
      })
      .strict()
      .parse(
        JSON.parse(
          (await domain.store.read(`.atlas/pending/uploads/${v.upload_id}.json`)).toString(),
        ),
      );
    const bytes = await domain.store.read(`.atlas/pending/uploads/${v.upload_id}.bin`);
    if (sha256(bytes) !== metadata.sha256) throw new DomainError("UPLOAD_INTEGRITY", 409);
    const text = ["text/plain", "text/markdown"].includes(metadata.media_type)
      ? normalized(bytes)
      : "";
    const result = await domain.sources.capture(owner, v, {
      bytes,
      media_type: metadata.media_type,
      extension: metadata.extension,
      extraction_status: text ? "text" : "stored_attachment",
      text,
    });
    for (const ext of ["bin", "json"])
      await unlink(
        await domain.store.vault.safePath(`.atlas/pending/uploads/${v.upload_id}.${ext}`),
      ).catch(() => {});
    return c.json(result, 201);
  });
  app.post("/uploads", async (c) => {
    if (uploading) throw new DomainError("UPLOAD_BUSY", 429);
    uploading = true;
    try {
      const folder = await domain.store.vault.safePath(".atlas/pending/uploads", true);
      await mkdir(folder, { recursive: true });
      if ((await readdir(folder)).filter((n) => n.endsWith(".json")).length >= 20)
        throw new DomainError("PENDING_UPLOAD_LIMIT", 413);
      const type = c.req.header("X-Atlas-Media-Type") ?? "",
        ext: Record<string, string> = {
          "application/pdf": "pdf",
          "image/png": "png",
          "image/jpeg": "jpg",
          "image/webp": "webp",
          "application/json": "json",
          "text/csv": "csv",
          "text/plain": "txt",
          "text/markdown": "md",
        };
      if (!ext[type]) throw new DomainError("ATTACHMENT_TYPE_UNSUPPORTED", 415);
      const reader = c.req.raw.body?.getReader();
      if (!reader) throw new DomainError("EMPTY_UPLOAD", 400);
      const chunks: Uint8Array[] = [];
      let length = 0;
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        length += next.value.length;
        if (length > 20971520) {
          await reader.cancel();
          throw new DomainError("UPLOAD_TOO_LARGE", 413);
        }
        chunks.push(next.value);
      }
      const bytes = Buffer.concat(chunks),
        prefix = bytes.subarray(0, 16);
      const valid =
        type === "application/pdf"
          ? prefix.toString().startsWith("%PDF-")
          : type === "image/png"
            ? prefix.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : type === "image/jpeg"
              ? prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255
              : type === "image/webp"
                ? prefix.toString("ascii", 0, 4) === "RIFF" &&
                  prefix.toString("ascii", 8, 12) === "WEBP"
                : !bytes.includes(0);
      if (!valid) throw new DomainError("ATTACHMENT_SIGNATURE_MISMATCH", 415);
      const id = randomUUID();
      await domain.store.vault.writeExclusive(`.atlas/pending/uploads/${id}.bin`, bytes);
      await domain.store.vault.writeExclusive(
        `.atlas/pending/uploads/${id}.json`,
        canonical({ media_type: type, extension: ext[type], sha256: sha256(bytes), bytes: length }),
      );
      return c.json({ upload_id: id, bytes: length, media_type: type }, 201);
    } finally {
      uploading = false;
    }
  });
  app.post("/sources/:id/versions", async (c) =>
    c.json(await domain.sources.edit(owner, c.req.param("id"), await requestBody(c)), 201),
  );
  app.post("/sources/:id/access", async (c) =>
    c.json(await domain.sources.access(owner, c.req.param("id"), await requestBody(c))),
  );
  app.post("/sources/:id/retry", async (c) =>
    c.json(await domain.sources.retry(owner, c.req.param("id"), await requestBody(c))),
  );
  app.post("/sources/:id/archive", async (c) =>
    c.json(await domain.sources.archive(owner, c.req.param("id"), await requestBody(c), true)),
  );
  app.post("/sources/:id/restore", async (c) =>
    c.json(await domain.sources.archive(owner, c.req.param("id"), await requestBody(c), false)),
  );
  app.get("/sources/:id/original", async (c) => {
    const catalog = await domain.store.catalog(),
      source = sourceData(catalog, c.req.param("id")),
      version = versionData(
        catalog,
        c.req.query("version") ? z.uuid().parse(c.req.query("version")) : source.current_version_id,
      ),
      bytes = await domain.store.read(version.original_path);
    if (version.source_id !== source.id) throw new DomainError("NOT_FOUND", 404);
    if (sha256(bytes) !== version.raw_sha256) throw new DomainError("ORIGINAL_INTEGRITY", 503);
    return new Response(Uint8Array.from(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment; filename=original.bin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
  app.post("/import-url", async (c) => {
    const v = z
      .object({
        request_key: z.string(),
        title: z.string().min(1).max(160),
        url: z.string().max(4000),
        project_id: z.uuid().nullable().default(null),
      })
      .strict()
      .parse(await requestBody(c));
    const fetched = await fetchPublicUrl(v.url);
    return c.json(
      await domain.sources.capture(
        owner,
        {
          request_key: v.request_key,
          title: v.title,
          origin_url: fetched.final_url,
          project_id: v.project_id,
          scope: "personal",
          input_type: "url",
          content: "",
        },
        fetched,
      ),
      201,
    );
  });
  app.get("/agents", async (c) => c.json({ agents: await domain.agents(owner) }));
  app.post("/agents", async (c) =>
    c.json(await domain.auth.create(owner, await requestBody(c)), 201),
  );
  app.post("/agents/:id", async (c) =>
    c.json(await domain.auth.update(owner, c.req.param("id"), await requestBody(c))),
  );
  app.post("/sources/:id/grants", async (c) =>
    c.json(await domain.tasks.grant(owner, c.req.param("id"), await requestBody(c)), 201),
  );
  app.post("/sources/:id/organize", async (c) =>
    c.json(await domain.organization.organize(owner, c.req.param("id"), await requestBody(c))),
  );
  app.post("/grants/:id/revoke", async (c) =>
    c.json(await domain.tasks.revokeGrant(owner, c.req.param("id"), await requestBody(c))),
  );
  app.post("/proposals/memory", async (c) =>
    c.json(await domain.tasks.propose(owner, await requestBody(c)), 201),
  );
  app.post("/memories/:id/retrieval-settings", async (c) =>
    c.json(await domain.tasks.retrievalSettings(owner, c.req.param("id"), await requestBody(c))),
  );
  app.post("/reviews/:kind/:id", async (c) => {
    const kind = z
      .enum(["memory", "entity", "relationship", "suggestion"])
      .parse(c.req.param("kind"));
    return c.json(
      kind === "suggestion"
        ? await domain.tasks.reviewSuggestion(owner, c.req.param("id"), await requestBody(c))
        : await domain.tasks.review(owner, kind, c.req.param("id"), await requestBody(c)),
    );
  });
  app.post("/retrieval", async (c) =>
    c.json(await domain.retrieval.retrieve(owner, await requestBody(c))),
  );
  app.get("/changes", async (c) => c.json({ events: await domain.changes(owner) }));
  app.get("/organization", async (c) => c.json(await domain.organization.snapshot()));
  app.post("/projects", async (c) =>
    c.json(await domain.organization.createProject(owner, await requestBody(c)), 201),
  );
  app.post("/projects/:id", async (c) =>
    c.json(await domain.organization.updateProject(owner, c.req.param("id"), await requestBody(c))),
  );
  app.post("/collections", async (c) =>
    c.json(await domain.organization.collection(owner, await requestBody(c)), 201),
  );
  app.post("/collections/:id", async (c) =>
    c.json(await domain.organization.collection(owner, await requestBody(c), c.req.param("id"))),
  );
  app.post("/collections/:id/merge", async (c) =>
    c.json(await domain.organization.merge(owner, c.req.param("id"), await requestBody(c))),
  );
  app.get("/collections/:id/merge-preview", async (c) =>
    c.json(
      await domain.organization.mergePreview(
        c.req.param("id"),
        z.uuid().parse(c.req.query("target")),
      ),
    ),
  );
  app.get("/settings", async (c) => {
    const catalog = await domain.store.catalog(),
      r = catalog.heads.get("settings:workspace");
    return c.json({
      revision: r?.revision ?? 0,
      auto_classify: r?.data.auto_classify === true,
      default_agent_processing: false,
    });
  });
  app.post("/settings", async (c) =>
    c.json(await domain.organization.settings(owner, await requestBody(c))),
  );
  app.get("/evidence/:id", async (c) => {
    const catalog = await domain.store.catalog(),
      version = versionData(catalog, c.req.param("id")),
      source = sourceData(catalog, version.source_id);
    const start = z.coerce.number().int().nonnegative().parse(c.req.query("start")),
      end = z.coerce.number().int().positive().parse(c.req.query("end"));
    if (end <= start || end > Array.from(version.text).length || end - start > 10000)
      throw new DomainError("INVALID_EVIDENCE_RANGE", 400);
    const quote = codePoints(version.text, start, end);
    if (c.req.query("sha") && c.req.query("sha") !== sha256(quote))
      throw new DomainError("EVIDENCE_HASH_MISMATCH", 409);
    return c.json({
      source_id: source.id,
      title: source.title,
      version_id: version.id,
      version: version.version,
      start,
      end,
      quote,
      quote_sha256: sha256(quote),
      is_current: source.current_version_id === version.id && !source.archived,
      original_integrity:
        sha256(await domain.store.read(version.original_path)) === version.raw_sha256,
      context_before: codePoints(version.text, Math.max(0, start - 100), start),
      context_after: codePoints(version.text, end, end + 100),
      pages: version.page_ranges.filter((p) => p.end > start && p.start < end).map((p) => p.page),
    });
  });
  app.get("/traces/:id", async (c) => {
    const catalog = await domain.store.catalog();
    return c.json(head(catalog, "trace", c.req.param("id")));
  });
  let operationRunning = false;
  const liveOperations = new Set<string>();
  async function launchOperation(
    kind: "backup" | "restore",
    work: (id: string) => Promise<unknown>,
  ) {
    if (operationRunning) throw new DomainError("BACKUP_OPERATION_BUSY", 409);
    const id = randomUUID(),
      folder = join(artifactRoot, "backup-operations");
    await mkdir(folder, { recursive: true });
    await writeFile(
      join(folder, id + ".json"),
      canonical({ id, kind, state: "running", started_at: new Date().toISOString() }),
      { flag: "wx" },
    );
    operationRunning = true;
    liveOperations.add(id);
    void (async () => {
      let result: unknown;
      try {
        result = { id, kind, state: "completed", result: await work(id) };
      } catch (e) {
        result = {
          id,
          kind,
          state: "failed",
          error: e instanceof DomainError ? e.code : "LOCAL_BACKUP_FAILED",
          message: "Original vault and incomplete output were preserved.",
        };
      } finally {
        operationRunning = false;
        liveOperations.delete(id);
      }
      await writeFile(join(folder, id + ".result.json"), canonical(result), { flag: "wx" });
    })().catch(() => {});
    return { operation_id: id, state: "running" };
  }
  app.get("/operations/:id", async (c) => {
    const id = z.uuid().parse(c.req.param("id")),
      folder = join(artifactRoot, "backup-operations");
    try {
      return c.json(
        JSON.parse(await readFile(join(folder, id + ".result.json"), "utf8")) as Record<
          string,
          unknown
        >,
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const initial = JSON.parse(await readFile(join(folder, id + ".json"), "utf8")) as Record<
      string,
      unknown
    >;
    return c.json({
      ...initial,
      state: liveOperations.has(id) ? "running" : "interrupted",
      message: "Incomplete outputs are preserved; a completed manifest is required for restore.",
    });
  });
  app.post("/backup", async (c) => {
    z.object({ request_key: z.string() })
      .strict()
      .parse(await requestBody(c));
    return c.json(
      await launchOperation("backup", async (id) => {
        const parent = join(artifactRoot, "exports");
        await mkdir(parent, { recursive: true });
        return backupLocalVault(domain.store, join(parent, id));
      }),
      202,
    );
  });
  app.post("/restore-rehearsal", async (c) => {
    const v = z
      .object({ backup_folder: z.uuid() })
      .strict()
      .parse(await requestBody(c));
    return c.json(
      await launchOperation("restore", async (id) => {
        const parent = join(artifactRoot, "restore-rehearsal", id);
        await mkdir(parent, { recursive: true });
        return restoreLocalVault(
          join(artifactRoot, "exports", v.backup_folder),
          join(parent, "Vault"),
        );
      }),
      202,
    );
  });
  return app;
}
export function agentDomainRoutes(domain: Domain) {
  const app = new Hono<ApiEnv>();
  const actor = (c: Context<ApiEnv>) => domain.auth.authenticate(bearer(c));
  app.get("/session", async (c) => {
    const a = await actor(c);
    return c.json({ actor: a, mode: "local" });
  });
  app.post("/retrieval/search", async (c) =>
    c.json(await domain.retrieval.retrieve(await actor(c), await requestBody(c))),
  );
  app.post("/retrieval/project-context", async (c) => {
    const who = await actor(c),
      v = z
        .object({
          project: z.string().min(1),
          detail: z.enum(["minimal", "balanced", "detailed"]).optional(),
          token_budget: z.number().optional(),
          observed_repository_commit: z.string().optional(),
        })
        .strict()
        .parse(await requestBody(c));
    const snap = await domain.store.vault.snapshot(),
      projects = snap.notes.filter(
        (n) =>
          n.kind === "project" &&
          (n.id === v.project ||
            n.path.split("/")[1] === v.project ||
            n.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") === v.project),
      );
    if (projects.length !== 1) throw new DomainError("NOT_FOUND", 404);
    const catalog = await domain.store.catalog(),
      record = catalog.heads.get(`agent:${who.id}`),
      data = record?.data;
    if (
      !data ||
      !Array.isArray(data.capabilities) ||
      !data.capabilities.includes("read") ||
      !Array.isArray(data.project_ids) ||
      !data.project_ids.includes(projects[0]!.id)
    )
      throw new DomainError("NOT_FOUND", 404);
    return c.json(
      await domain.retrieval.retrieve(who, {
        query: "",
        project_id: projects[0]!.id,
        ...(v.detail ? { detail: v.detail } : {}),
        ...(v.token_budget ? { token_budget: v.token_budget } : {}),
      }),
    );
  });
  app.post("/retrieval/memory", async (c) => {
    const v = z
      .object({
        memory_id: z.uuid(),
        include_history: z.boolean().default(false),
        token_budget: z.number().default(2048),
      })
      .strict()
      .parse(await requestBody(c));
    return c.json(
      await domain.retrieval.retrieve(
        await actor(c),
        { query: "", include_history: v.include_history, token_budget: v.token_budget },
        { item_id: v.memory_id, kind: "memory" },
      ),
    );
  });
  app.post("/retrieval/related", async (c) => {
    const v = z
      .object({
        item_id: z.uuid(),
        depth: z.number().int().min(1).max(2).default(1),
        relationship_types: z.array(z.string()).optional(),
        token_budget: z.number().default(2048),
      })
      .strict()
      .parse(await requestBody(c));
    return c.json(
      await domain.retrieval.retrieve(
        await actor(c),
        { query: "", depth: v.depth, token_budget: v.token_budget },
        {
          related_to: v.item_id,
          ...(v.relationship_types ? { relationship_types: v.relationship_types } : {}),
        },
      ),
    );
  });
  app.post("/retrieval/source", async (c) => {
    const v = z
      .object({
        source_id: z.uuid(),
        version_id: z.uuid().optional(),
        chunk_ids: z.array(z.uuid()).optional(),
        range: z.object({ start: z.number(), end: z.number() }).optional(),
        token_budget: z.number().default(2048),
        continuation: z.string().optional(),
      })
      .strict()
      .parse(await requestBody(c));
    const { source_id, ...rest } = v;
    return c.json(await domain.retrieval.readSource(await actor(c), source_id, rest));
  });
  app.post("/retrieval/recent", async (c) => {
    const v = z
      .object({
        project_id: z.uuid().optional(),
        since: z.string().datetime().optional(),
        until: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(100).default(25),
        token_budget: z.number().default(2048),
      })
      .strict()
      .parse(await requestBody(c));
    if (v.since && v.until && v.since > v.until) throw new DomainError("INVALID_DATE_RANGE", 400);
    return c.json(
      await domain.retrieval.retrieve(
        await actor(c),
        {
          query: "",
          ...(v.project_id ? { project_id: v.project_id } : {}),
          token_budget: v.token_budget,
        },
        {
          ...(v.since ? { recent_since: v.since } : {}),
          recent: true,
          ...(v.until ? { recent_until: v.until } : {}),
          limit: v.limit,
        },
      ),
    );
  });
  app.post("/proposals/memory", async (c) => {
    const raw = z.record(z.string(), z.unknown()).parse(await requestBody(c));
    const { idempotency_key, ...rest } = raw;
    return c.json(
      await domain.tasks.propose(await actor(c), {
        ...rest,
        request_key: idempotency_key,
        subject_key:
          rest.subject_key ??
          String(rest.title)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "."),
      }),
      201,
    );
  });
  app.post("/proposals/relationship", async (c) => {
    const raw = z.record(z.string(), z.unknown()).parse(await requestBody(c));
    const { idempotency_key, ...rest } = raw;
    return c.json(
      await domain.tasks.proposeRelationship(await actor(c), {
        ...rest,
        request_key: idempotency_key,
      }),
      201,
    );
  });
  app.post("/proposals/decision", async (c) => {
    const v = z
      .object({
        idempotency_key: z.string(),
        title: z.string(),
        summary: z.string(),
        project_id: z.uuid(),
        decision: z
          .object({
            problem: z.string().min(1).max(2000),
            choice: z.string().min(1).max(2000),
            rationale: z.string().min(1).max(2000),
            consequences: z.array(z.string().max(600)).max(10),
          })
          .strict(),
        evidence: z.array(z.unknown()),
        replaces_memory_id: z.uuid().optional(),
      })
      .strict()
      .parse(await requestBody(c));
    return c.json(
      await domain.tasks.propose(await actor(c), {
        request_key: v.idempotency_key,
        title: v.title,
        type: "project",
        subject_key: v.title.toLowerCase().replace(/[^a-z0-9]+/g, "."),
        summary: v.summary,
        project_id: v.project_id,
        scope: "project",
        structured_content: {
          decision: v.decision,
          ...(v.replaces_memory_id ? { proposed_replacement_for: v.replaces_memory_id } : {}),
        },
        evidence: v.evidence,
        claim_kind: "decision",
      }),
      201,
    );
  });
  app.post("/tasks/list", async (c) =>
    c.json(await domain.tasks.list(await actor(c), await requestBody(c))),
  );
  app.post("/tasks/:id/claim", async (c) => {
    const v = z
      .object({ token_budget: z.number().int().min(256).max(8192).default(2048) })
      .strict()
      .parse(await requestBody(c));
    return c.json(await domain.tasks.claim(await actor(c), c.req.param("id"), v.token_budget));
  });
  app.post("/tasks/:id/source", async (c) => {
    const v = z.record(z.string(), z.unknown()).parse(await requestBody(c)),
      { lease_token, ...rest } = v;
    return c.json(
      await domain.tasks.read(
        await actor(c),
        c.req.param("id"),
        z.string().parse(lease_token),
        rest,
      ),
    );
  });
  for (const action of ["renew", "release"] as const)
    app.post(`/tasks/:id/${action}`, async (c) => {
      const v = z
        .object({
          lease_token: z.string(),
          reason: z.enum(["interrupted", "context_limit", "unable_to_process"]).optional(),
        })
        .strict()
        .parse(await requestBody(c));
      return c.json(
        await domain.tasks.leaseAction(await actor(c), c.req.param("id"), v.lease_token, action),
      );
    });
  app.post("/tasks/:id/submit", async (c) => {
    const v = z
      .object({ lease_token: z.string(), idempotency_key: z.string(), organization: z.unknown() })
      .strict()
      .parse(await requestBody(c));
    return c.json(
      await domain.tasks.submit(
        await actor(c),
        c.req.param("id"),
        v.lease_token,
        v.idempotency_key,
        v.organization,
      ),
      201,
    );
  });
  return app;
}
