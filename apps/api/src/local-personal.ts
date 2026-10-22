import { Hono } from "hono";
import { z, type LocalActor } from "@atlas/contracts";
import { DomainError, type createPersonalService } from "@atlas/core/local-domain";
import type { ApiEnv } from "./app.js";
type Personal = ReturnType<typeof createPersonalService>;
const owner: LocalActor = { kind: "owner", id: "local-owner" };
export function ownerPersonalRoutes(personal: Personal, cookie: string) {
  const app = new Hono<ApiEnv>();
  app.use("*", async (c, next) => {
    if (
      c.req.header("Authorization") ||
      !c.req
        .header("Cookie")
        ?.split(";")
        .some((p) => p.trim() === `atlas_local=${cookie}`)
    )
      throw new DomainError("OWNER_SESSION_REQUIRED", 401);
    if (c.req.method !== "GET" && !c.req.header("Content-Type")?.startsWith("application/json"))
      throw new DomainError("JSON_REQUIRED", 415);
    await next();
  });
  app.get("/profile", async (c) => c.json(await personal.context(owner, {})));
  app.get("/policy", async (c) => c.json(await personal.policy.read()));
  app.get("/skills", async (c) =>
    c.json(await personal.skills.list(owner, { query: c.req.query("query") ?? "" })),
  );
  app.get("/candidates", async (c) => c.json({ items: await personal.candidates.list(owner) }));
  app.get("/coverage", async (c) =>
    c.json(
      await personal.sessions.coverage(owner, {
        ...(c.req.query("host_id") ? { host_id: c.req.query("host_id") } : {}),
        cursor: Number(c.req.query("cursor") ?? 0),
      }),
    ),
  );
  app.post("/context", async (c) => c.json(await personal.context(owner, await c.req.json())));
  app.post("/policy", async (c) => c.json(await personal.policy.update(owner, await c.req.json())));
  app.post("/grants", async (c) => c.json(await personal.policy.grant(owner, await c.req.json())));
  app.post("/candidates/:id/decision", async (c) =>
    c.json(await personal.candidates.decide(owner, c.req.param("id"), await c.req.json())),
  );
  app.post("/subjects/:id/stop-using", async (c) =>
    c.json(await personal.profile.stopUsing(owner, c.req.param("id"), await c.req.json())),
  );
  app.post("/subjects/:id/confirmation", async (c) =>
    c.json(await personal.policy.confirmation(owner, await c.req.json())),
  );
  app.post("/capture", async (c) => c.json(await personal.capture(owner, await c.req.json()), 201));
  app.post("/skills/query", async (c) =>
    c.json(await personal.skills.list(owner, await c.req.json())),
  );
  app.post("/skills/scan", async (c) =>
    c.json(await personal.skills.scan(owner, await c.req.json())),
  );
  app.post("/skills/:id/curate", async (c) =>
    c.json(await personal.skills.curate(owner, c.req.param("id"), await c.req.json())),
  );
  app.post("/skills/:id/backup", async (c) =>
    c.json(await personal.skills.backup(owner, c.req.param("id"), await c.req.json())),
  );
  app.post("/skills/:id/restore-preview", async (c) =>
    c.json(await personal.skills.restore(owner, c.req.param("id"), await c.req.json())),
  );
  app.post("/sessions/scan", async (c) =>
    c.json(await personal.sessions.scan(owner, await c.req.json())),
  );
  app.post("/sessions/exclude", async (c) =>
    c.json(await personal.sessions.action(owner, await c.req.json(), "exclude")),
  );
  app.post("/sessions/retry", async (c) =>
    c.json(await personal.sessions.action(owner, await c.req.json(), "retry")),
  );
  app.post("/profile/refresh", async (c) => {
    z.object({})
      .strict()
      .parse(await c.req.json());
    return c.json(await personal.profile.refresh(owner));
  });
  app.post("/erasure-preview", async (c) =>
    c.json(await personal.profile.erasurePreview(owner, await c.req.json())),
  );
  return app;
}
export function agentPersonalRoutes(
  personal: Personal,
  authenticate: (token: string | undefined) => Promise<LocalActor>,
) {
  const app = new Hono<ApiEnv>();
  app.post("/:operation{.+}", async (c) => {
    if (!c.req.header("Content-Type")?.startsWith("application/json"))
      throw new DomainError("JSON_REQUIRED", 415);
    const actor = await authenticate(c.req.header("Authorization")?.replace(/^Bearer /, "")),
      body = await c.req.json();
    const op = c.req.param("operation");
    const value =
      op === "context"
        ? await personal.context(actor, body)
        : op === "capture"
          ? await personal.capture(actor, body)
          : op === "sessions/scan"
            ? await personal.sessions.scan(actor, body)
            : op === "sessions/next"
              ? await personal.sessions.claim(actor, body)
              : op === "sessions/page"
                ? await personal.sessions.page(actor, body)
                : op === "sessions/complete"
                  ? await personal.sessions.complete(actor, body)
                  : op === "skills"
                    ? await personal.skills.list(actor, body)
                    : undefined;
    if (value === undefined) throw new DomainError("NOT_FOUND", 404);
    return c.json(value);
  });
  return app;
}
