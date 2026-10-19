import { Hono } from "hono";
import {
  z,
  projectInputSchema,
  projectPatchSchema,
  collectionInputSchema,
  collectionPatchSchema,
  collectionMergeSchema,
  ownerSessionSchema,
  organizationSnapshotSchema,
} from "@atlas/contracts";
import {
  AccessDenied,
  DomainError,
  resolveOwner,
  withPrincipal,
  readWorkspace,
  listProjects,
  listCollections,
  organizationMutation,
  createProject,
  patchProject,
  createCollection,
  patchCollection,
  mergeCollections,
  readProjectContext,
} from "@atlas/core";
import type { createPool, OwnerContext, VerifiedIdentity } from "@atlas/core";
import type { ApiEnv } from "./app.js";

export function createVaultServices(
  pool: ReturnType<typeof createPool>,
  verify: (token: string) => Promise<VerifiedIdentity>,
  binding: VerifiedIdentity,
  mode: "live" | "fixture" = "live",
) {
  return { pool, verify, binding, mode };
}
export type VaultServices = ReturnType<typeof createVaultServices>;
type VaultEnv = { Variables: ApiEnv["Variables"] & { owner: OwnerContext } };
export function vaultRoutes(vault?: VaultServices) {
  const routes = new Hono<VaultEnv>();
  routes.use("*", async (c, next) => {
    const error = (code: string, message: string, status: 401 | 403 | 503) =>
      c.json({ error: { code, message, request_id: c.get("requestId") } }, status);
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ") || header.length > 16384)
      return error("UNAUTHORIZED", "Sign in to access your workspace.", 401);
    if (!vault) return error("SETUP_REQUIRED", "Owner setup is still required.", 503);
    let identity: VerifiedIdentity;
    try {
      identity = await vault.verify(header.slice(7));
    } catch {
      return error("UNAUTHORIZED", "Invalid or expired session.", 401);
    }
    try {
      c.set("owner", await resolveOwner(vault.pool, identity, vault.binding));
    } catch (e) {
      return e instanceof AccessDenied
        ? error("FORBIDDEN", "Workspace access denied.", 403)
        : error("DATABASE_UNAVAILABLE", "Workspace is unavailable.", 503);
    }
    await next();
  });
  const run = <T>(owner: OwnerContext, work: Parameters<typeof withPrincipal<T>>[3]) => {
    if (!vault) throw new AccessDenied();
    return withPrincipal(vault.pool, owner.principal, owner.workspaceId, work);
  };
  routes.get("/me", async (c) =>
    c.json(
      ownerSessionSchema.parse({
        workspace: await run(c.get("owner"), (q) => readWorkspace(q, c.get("owner").workspaceId)),
      }),
    ),
  );
  routes.get("/projects/:id/checkpoints", async (c) => {
    const owner = c.get("owner"),
      id = z.uuid().parse(c.req.param("id"));
    return c.json(
      await run(owner, (q) =>
        readProjectContext(q, owner.workspaceId, id, { limit: 20, character_budget: 24000 }),
      ),
    );
  });
  routes.get("/workspaces/:workspace/organization", async (c) => {
    const o = c.get("owner");
    if (c.req.param("workspace") !== o.workspaceId) throw new DomainError("NOT_FOUND", 404);
    return c.json(
      organizationSnapshotSchema.parse(
        await run(o, async (q) => ({
          workspace: await readWorkspace(q, o.workspaceId),
          projects: await listProjects(q, o.workspaceId),
          collections: await listCollections(q, o.workspaceId),
        })),
      ),
    );
  });
  for (const kind of ["projects", "collections"] as const) {
    routes.get(`/workspaces/:workspace/${kind}`, async (c) => {
      const o = c.get("owner");
      if (c.req.param("workspace") !== o.workspaceId) throw new DomainError("NOT_FOUND", 404);
      return c.json(
        await run(o, async (q) =>
          kind === "projects"
            ? await listProjects(q, o.workspaceId)
            : await listCollections(q, o.workspaceId),
        ),
      );
    });
    routes.post(`/workspaces/:workspace/${kind}`, async (c) => {
      const o = c.get("owner");
      if (c.req.param("workspace") !== o.workspaceId) throw new DomainError("NOT_FOUND", 404);
      const body: unknown = await c.req.json();
      const value =
        kind === "projects" ? projectInputSchema.parse(body) : collectionInputSchema.parse(body);
      const result = await run(o, (q) =>
        organizationMutation(
          q,
          o,
          c.req.path,
          c.req.header("Idempotency-Key") ?? "",
          value,
          async () =>
            kind === "projects"
              ? await createProject(q, o, projectInputSchema.parse(value))
              : await createCollection(q, o, collectionInputSchema.parse(value)),
        ),
      );
      return c.json(result, 201);
    });
    routes.patch(`/${kind}/:id`, async (c) => {
      const o = c.get("owner"),
        id = z.uuid().parse(c.req.param("id")),
        body: unknown = await c.req.json();
      const value =
        kind === "projects" ? projectPatchSchema.parse(body) : collectionPatchSchema.parse(body);
      return c.json(
        await run(o, (q) =>
          organizationMutation(
            q,
            o,
            c.req.path,
            c.req.header("Idempotency-Key") ?? "",
            value,
            async () =>
              kind === "projects"
                ? await patchProject(q, o, id, projectPatchSchema.parse(value))
                : await patchCollection(q, o, id, collectionPatchSchema.parse(value)),
          ),
        ),
      );
    });
  }
  routes.post("/collections/:id/merge", async (c) => {
    const o = c.get("owner"),
      id = z.uuid().parse(c.req.param("id")),
      value = collectionMergeSchema.parse(await c.req.json());
    return c.json(
      await run(o, (q) =>
        organizationMutation(
          q,
          o,
          c.req.path,
          c.req.header("Idempotency-Key") ?? "",
          value,
          async () => mergeCollections(q, o, id, value),
        ),
      ),
    );
  });
  routes.onError((e, c) => {
    const sqlCode = (e as { code?: string }).code;
    const status =
      e instanceof DomainError
        ? e.status
        : e instanceof z.ZodError || e instanceof SyntaxError
          ? 400
          : sqlCode === "23505" || sqlCode === "23514"
            ? 409
            : 503;
    const code =
      e instanceof DomainError
        ? e.code
        : status === 400
          ? "INVALID_INPUT"
          : status === 409
            ? "CONFLICT"
            : "DATABASE_UNAVAILABLE";
    return c.json(
      {
        error: {
          code,
          message:
            status === 400
              ? "Check the submitted fields."
              : status === 409
                ? "The organization changed or has a conflict. Reload and retry."
                : "Workspace is unavailable.",
          request_id: c.get("requestId"),
        },
      },
      status,
    );
  });
  return routes;
}
