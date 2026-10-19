import { randomUUID } from "node:crypto";
import { LIMITS } from "@atlas/contracts";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { timeout } from "hono/timeout";
import { HTTPException } from "hono/http-exception";
import { setupCodes, type ApiConfig } from "./config.js";
import type { NeonServices } from "./neon-services.js";
import { vaultRoutes, type VaultServices } from "./vault.js";
import { agentWorkflowRoutes } from "./agent-workflow.js";
import { localRoutes, type LocalServices } from "./local-vault.js";

export type ApiEnv = { Variables: { requestId: string } };
export function createApp(
  config: ApiConfig,
  neon?: NeonServices,
  vault?: VaultServices,
  local?: LocalServices,
) {
  if (config.NODE_ENV === "production" && vault?.mode === "fixture")
    throw new Error("Fixture authentication is forbidden in production");
  const app = new Hono<ApiEnv>();
  const hosts = new Set([`localhost:${config.API_PORT}`, `127.0.0.1:${config.API_PORT}`]);
  const origins = new Set([
    `http://localhost:${config.API_PORT}`,
    `http://127.0.0.1:${config.API_PORT}`,
    "http://localhost:5173",
  ]);
  app.use("*", async (context, next) => {
    const requestId = randomUUID();
    context.set("requestId", requestId);
    context.header("X-Request-Id", requestId);
    context.header("Cache-Control", "no-store");
    const url = new URL(context.req.url);
    const host = context.req.header("Host") ?? url.host;
    const origin = context.req.header("Origin");
    if (
      url.protocol !== "http:" ||
      !hosts.has(url.host) ||
      !hosts.has(host) ||
      (origin && !origins.has(origin))
    ) {
      return context.json(
        {
          error: {
            code: "FORBIDDEN_ORIGIN",
            message: "Request origin is not allowed.",
            request_id: requestId,
          },
        },
        403,
      );
    }
    if (context.req.header("Sec-Fetch-Site") === "cross-site") {
      return context.json(
        {
          error: {
            code: "FORBIDDEN_ORIGIN",
            message: "Cross-site request denied.",
            request_id: requestId,
          },
        },
        403,
      );
    }
    await next();
  });
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: [
          "'self'",
          ...(config.NEON_AUTH_BASE_URL ? [new URL(config.NEON_AUTH_BASE_URL).origin] : []),
        ],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
      },
    }),
  );
  app.use("/api/*", async (c, next) =>
    bodyLimit({
      maxSize:
        c.req.path === "/api/v1/local/domain/uploads" ? 20 * 1024 * 1024 : LIMITS.sourceBytes,
      onError: (c) =>
        c.json(
          {
            error: {
              code: "PAYLOAD_TOO_LARGE",
              message: "Payload exceeds the allowed size.",
              request_id: c.get("requestId"),
            },
          },
          413,
        ),
    })(c, next),
  );
  app.use("/api/*", async (c, next) =>
    timeout(
      c.req.path === "/api/v1/local/domain/import-url"
        ? 20000
        : c.req.path === "/api/v1/local/domain/uploads"
          ? 30000
          : 10000,
    )(c, next),
  );
  app.get("/health", (c) =>
    c.json({
      status: "alive",
      service: "atlas-api",
      storage: local ? "local" : "cloud",
      agent_ready: local?.agentReady ?? false,
    }),
  );
  if (local) {
    app.route("/", localRoutes(local));
    return app;
  }
  app.get("/api/v1/runtime", (c) => c.json({ mode: "cloud" }));
  app.get("/ready", (c) => c.json({ status: "setup_required", codes: setupCodes(config) }, 503));
  app.get("/api/v1/setup/services", async (c) =>
    c.json(
      neon
        ? await neon.status()
        : {
            database: "not_configured",
            auth: "not_configured",
            storage: "not_configured",
            vault: "setup_required",
          },
    ),
  );
  app.on(["GET", "POST"], "/api/v1/auth/check", async (c) => {
    const authorization = c.req.header("Authorization");
    if (!authorization?.startsWith("Bearer ") || authorization.length > 16384)
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Sign in to verify the connection.",
            request_id: c.get("requestId"),
          },
        },
        401,
      );
    if (!neon?.verify)
      return c.json(
        {
          error: {
            code: "AUTH_NOT_CONFIGURED",
            message: "Authentication is not configured.",
            request_id: c.get("requestId"),
          },
        },
        503,
      );
    let identity: { issuer: string; subject: string };
    try {
      identity = await neon.verify(authorization.slice(7));
    } catch {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired session.",
            request_id: c.get("requestId"),
          },
        },
        401,
      );
    }
    try {
      const receipt = await neon.check(identity, c.req.method === "POST");
      return c.json({ authenticated: true, receipt, vault_access: "setup_required" });
    } catch {
      return c.json(
        {
          error: {
            code: "DATABASE_UNAVAILABLE",
            message: "Database verification failed.",
            request_id: c.get("requestId"),
          },
        },
        503,
      );
    }
  });
  app.route("/api/v1/agent", agentWorkflowRoutes(vault));
  app.route("/api/v1", vaultRoutes(vault));
  app.all("/api/*", (c) =>
    c.json(
      {
        error: {
          code: "SETUP_REQUIRED",
          message: "Complete vault setup before accessing knowledge.",
          request_id: c.get("requestId"),
        },
      },
      503,
    ),
  );
  app.notFound((c) =>
    c.json(
      { error: { code: "NOT_FOUND", message: "Route not found.", request_id: c.get("requestId") } },
      404,
    ),
  );
  app.onError((error, c) => {
    const timedOut = error instanceof HTTPException && error.status === 504;
    return c.json(
      {
        error: {
          code: timedOut ? "REQUEST_TIMEOUT" : "INTERNAL_ERROR",
          message: timedOut ? "Request timed out." : "Request failed.",
          request_id: c.get("requestId"),
        },
      },
      timedOut ? 504 : 500,
    );
  });
  return app;
}
