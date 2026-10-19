import { Hono } from "hono";
import { z, contextInputSchema } from "@atlas/contracts";
import type { Principal } from "@atlas/contracts";
import {
  authenticateAgent,
  withPrincipal,
  ensureRepository,
  captureCheckpoint,
  readProjectContext,
  AccessDenied,
  DomainError,
} from "@atlas/core";
import type { VaultServices } from "./vault.js";
import type { ApiEnv } from "./app.js";
type AgentEnv = {
  Variables: ApiEnv["Variables"] & { agent: Extract<Principal, { kind: "agent" }> };
};
export function agentWorkflowRoutes(vault?: VaultServices) {
  const app = new Hono<AgentEnv>();
  app.use("*", async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer atlas_") || header.length > 100) throw new AccessDenied();
    if (!vault)
      return c.json(
        {
          error: {
            code: "SETUP_REQUIRED",
            message: "ATLAS owner setup required.",
            request_id: c.get("requestId"),
          },
        },
        503,
      );
    c.set("agent", await authenticateAgent(vault.pool, header.slice(7)));
    await next();
  });
  const run = <T>(
    a: Extract<Principal, { kind: "agent" }>,
    work: Parameters<typeof withPrincipal<T>>[3],
  ) => {
    if (!vault) throw new AccessDenied();
    return withPrincipal(vault.pool, a, a.workspaceId, work);
  };
  app.post("/projects/ensure", async (c) =>
    c.json(await run(c.get("agent"), async (q) => ensureRepository(q, await c.req.json()))),
  );
  app.post("/projects/:id/context", async (c) => {
    const a = c.get("agent"),
      id = z.uuid().parse(c.req.param("id")),
      input = contextInputSchema.parse(await c.req.json());
    return c.json(await run(a, (q) => readProjectContext(q, a.workspaceId, id, input)));
  });
  app.post("/projects/:id/checkpoints", async (c) => {
    const a = c.get("agent"),
      id = z.uuid().parse(c.req.param("id")),
      input: unknown = await c.req.json();
    return c.json(
      await run(a, (q) => captureCheckpoint(q, a.workspaceId, a.agentId, id, input)),
      201,
    );
  });
  app.onError((e, c) => {
    const sql = (e as { code?: string }).code;
    const status =
      e instanceof AccessDenied || sql === "42501"
        ? 403
        : e instanceof DomainError
          ? e.status
          : e instanceof z.ZodError || e instanceof SyntaxError
            ? 400
            : sql === "23505"
              ? 409
              : 503;
    return c.json(
      {
        error: {
          code:
            status === 403
              ? "AGENT_ACCESS_DENIED"
              : e instanceof DomainError
                ? e.code
                : status === 400
                  ? "INVALID_INPUT"
                  : "UNAVAILABLE",
          message:
            status === 400
              ? "Invalid checkpoint or sensitive content detected."
              : "ATLAS request could not be completed.",
          request_id: c.get("requestId"),
        },
      },
      status,
    );
  });
  return app;
}
