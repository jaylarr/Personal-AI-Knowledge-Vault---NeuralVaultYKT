import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import {
  z,
  ensureRepositorySchema,
  localContextInputSchema,
  localContextSchema,
  type LocalContextInput,
} from "@atlas/contracts";
import { createLocalVault, LocalVaultError } from "@atlas/core/local-vault";
import { createDomainService, DomainError, domainGraph } from "@atlas/core/local-domain";
import { ownerDomainRoutes, agentDomainRoutes } from "./local-domain.js";
import type { ApiEnv } from "./app.js";
export function createLocalServices(
  root: string,
  options: { token?: string; agentId: string; expiresAt?: string },
) {
  const vault = createLocalVault(root, options.agentId),
    cookie = randomBytes(32).toString("base64url");
  const hash = (s: string) => createHash("sha256").update(s).digest();
  const valid = (value: string | undefined) =>
    Boolean(
      options.token &&
        value &&
        /^atlas_[A-Za-z0-9_-]{43}$/.test(value) &&
        timingSafeEqual(hash(value), hash(options.token)) &&
        (!options.expiresAt || Date.parse(options.expiresAt) > Date.now()),
    );
  const domain = createDomainService(vault, {
    id: options.agentId,
    ...(options.token ? { token: options.token } : {}),
    ...(options.expiresAt ? { expires_at: options.expiresAt } : {}),
  });
  const currentValid = async (value: string | undefined) => {
    if (!valid(value)) return false;
    try {
      const actor = await domain.auth.authenticate(value),
        catalog = await domain.store.catalog();
      const record = catalog.heads.get(`agent:${actor.id}`);
      return (
        record?.data.compatibility === true &&
        Array.isArray(record.data.capabilities) &&
        record.data.capabilities.includes("capture_project_knowledge")
      );
    } catch {
      return false;
    }
  };
  return { vault, cookie, valid: currentValid, domain, agentReady: Boolean(options.token) };
}
export type LocalServices = ReturnType<typeof createLocalServices>;
export function localRoutes(local: LocalServices) {
  const app = new Hono<ApiEnv>();
  app.use("*", async (c, next) => {
    if (!c.req.path.startsWith("/api/") && !["/health", "/ready"].includes(c.req.path))
      c.header("Set-Cookie", `atlas_local=${local.cookie}; HttpOnly; SameSite=Strict; Path=/`);
    await next();
  });
  app.get("/ready", async (c) => {
    await local.vault.initialize();
    return c.json({
      status: "local_ready",
      storage: "local",
      cloud_sync: false,
      full_product_complete: false,
    });
  });
  app.get("/api/v1/runtime", (c) => c.json({ mode: "local", vault_root: local.vault.root }));
  app.use("/api/v1/local/*", async (c, next) => {
    const authenticated =
      c.req
        .header("Cookie")
        ?.split(";")
        .some((part) => part.trim() === `atlas_local=${local.cookie}`) ||
      (await local.valid(c.req.header("Authorization")?.replace(/^Bearer /, "")));
    if (!authenticated)
      return c.json(
        {
          error: {
            code: "LOCAL_SESSION_REQUIRED",
            message: "Open the local app first.",
            request_id: c.get("requestId"),
          },
        },
        401,
      );
    await next();
  });
  app.get("/api/v1/local/vault", async (c) => {
    const data = await local.vault.snapshot();
    if (c.req.header("Authorization")) return c.json(data);
    const catalog = await local.domain.store.catalog(),
      graph = domainGraph(catalog, data, {
        limit: c.req.query("limit")
          ? z.coerce.number().int().min(1).max(1000).parse(c.req.query("limit"))
          : 500,
        ...(c.req.query("focus") ? { focus: z.uuid().parse(c.req.query("focus")) } : {}),
        include_proposed: c.req.query("proposals") === "1",
        depth: z.union([z.literal(1), z.literal(2)]).parse(Number(c.req.query("depth") ?? 1)),
      });
    const notes = data.notes.map((n) => {
      const r = catalog.heads.get(`project_metadata:${n.id}`);
      return r
        ? { ...n, title: String(r.data.name ?? n.title), archived: r.data.archived === true }
        : n;
    });
    return c.json({
      ...data,
      notes: [...notes, ...graph.notes],
      edges: [...data.edges, ...graph.edges],
      warnings: [...data.warnings, ...catalog.warnings, ...graph.warnings],
      truncated: data.truncated || catalog.incomplete || graph.truncated,
    });
  });
  app.route("/api/v1/local/domain", ownerDomainRoutes(local.domain, local.cookie));
  app.route("/api/v1/agent/domain", agentDomainRoutes(local.domain));
  app.use("/api/v1/agent/*", async (c, next) => {
    if (!(await local.valid(c.req.header("Authorization")?.replace(/^Bearer /, ""))))
      return c.json(
        {
          error: {
            code: "AGENT_ACCESS_DENIED",
            message: "Local agent credential required.",
            request_id: c.get("requestId"),
          },
        },
        403,
      );
    await next();
  });
  app.post("/api/v1/agent/projects/ensure", async (c) =>
    c.json(
      await activeProject(
        await local.vault.ensure(ensureRepositorySchema.parse(await c.req.json())),
      ),
    ),
  );
  async function supplement(
    value: z.infer<typeof localContextSchema>,
    input: LocalContextInput,
    token: string | undefined,
  ) {
    if (input.context_mode !== "knowledge") return value;
    const actor = await local.domain.auth.authenticate(token);
    const catalog = await local.domain.store.catalog();
    const agent = catalog.heads.get(`agent:${actor.id}`);
    if (!Array.isArray(agent?.data.capabilities) || !agent.data.capabilities.includes("read"))
      return value;
    const remaining = input.character_budget - JSON.stringify(value.notes).length;
    if (remaining < 512)
      return {
        ...value,
        truncated: true,
        warnings: [...value.warnings, "Reviewed context omitted: character budget insufficient."],
      };
    const packet = await local.domain.retrieval.retrieve(
      actor,
      {
        query: input.query ?? "",
        project_id: value.project.id,
        token_budget: Math.min(8192, remaining),
        detail: input.detail === "full" ? "detailed" : "balanced",
      },
      { kind: "memory" },
    );
    if (JSON.stringify(packet).length > remaining)
      return {
        ...value,
        truncated: true,
        warnings: [...value.warnings, "Reviewed context omitted: character budget insufficient."],
      };
    return localContextSchema.parse({
      ...value,
      reviewed_context: packet,
      truncated: value.truncated || packet.has_more,
    });
  }
  async function activeProject<T extends { id: string }>(value: T) {
    const catalog = await local.domain.store.catalog();
    if (catalog.incomplete) throw new DomainError("CATALOG_INTEGRITY", 503);
    if (catalog.heads.get(`project_metadata:${value.id}`)?.data.archived === true)
      throw new DomainError("NOT_FOUND", 404);
    return value;
  }
  app.use("/api/v1/agent/projects/:id/*", async (c, next) => {
    await activeProject({ id: c.req.param("id") ?? "" });
    await next();
  });
  app.post("/api/v1/agent/projects/:id/context", async (c) => {
    const input = localContextInputSchema.parse(await c.req.json());
    return c.json(
      await supplement(
        await local.vault.context(c.req.param("id"), input),
        input,
        c.req.header("Authorization")?.replace(/^Bearer /, ""),
      ),
    );
  });
  app.post("/api/v1/agent/projects/:id/checkpoints", async (c) =>
    c.json(await local.vault.capture(c.req.param("id"), await c.req.json()), 201),
  );
  app.all("/api/*", (c) =>
    c.json(
      {
        error: {
          code: "LOCAL_MODE",
          message: "This installation uses local Markdown files.",
          request_id: c.get("requestId"),
        },
      },
      404,
    ),
  );
  app.onError((e, c) => {
    const status =
      e instanceof DomainError
        ? (e.status as 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 503)
        : e instanceof LocalVaultError
          ? e.code === "NOT_FOUND"
            ? 404
            : e.code === "INVALID_INPUT"
              ? 400
              : 409
          : e instanceof z.ZodError || e instanceof SyntaxError
            ? 400
            : 503;
    return c.json(
      {
        error: {
          code:
            e instanceof DomainError
              ? e.code
              : e instanceof LocalVaultError
                ? e.code
                : status === 400
                  ? "INVALID_INPUT"
                  : "LOCAL_VAULT_UNAVAILABLE",
          message: "Local vault request could not be completed. Existing files were preserved.",
          request_id: c.get("requestId"),
        },
      },
      status,
    );
  });
  return app;
}
