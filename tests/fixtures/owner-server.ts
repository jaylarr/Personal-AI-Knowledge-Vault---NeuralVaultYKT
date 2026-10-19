// Test-only entry point, outside the production build. Never use a cloud URL.
import { generateKeyPairSync, sign, randomBytes, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { serve } from "@hono/node-server";
import {
  assertLocalTestTarget,
  createPool,
  applyMigrations,
  readMigrations,
  inTransaction,
  bindOwner,
  createIdentityVerifier,
  withPrincipal,
  authenticateAgent,
  ensureRepository,
  captureCheckpoint,
} from "@atlas/core";
import { collectionSeedSchema } from "@atlas/contracts";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { attachStatic } from "../../apps/api/src/static.js";
import { createVaultServices } from "../../apps/api/src/vault.js";
if (process.env.NODE_ENV !== "test") throw Error("Test fixture requires NODE_ENV=test");
for (const key of ["ATLAS_TEST_ADMIN_URL", "ATLAS_TEST_API_URL"])
  assertLocalTestTarget(process.env[key] ?? "", process.env.DATABASE_TARGET_ID);
const admin = createPool(process.env.ATLAS_TEST_ADMIN_URL ?? "", "atlas-browser-fixture");
const pool = createPool(process.env.ATLAS_TEST_API_URL ?? "", "atlas-browser-api");
const publicConfig = parseEnv(await readFile(".env.local", "utf8"));
const authUrl = publicConfig.NEON_AUTH_BASE_URL;
if (!authUrl) throw Error("Public Auth URL missing for browser fixture");
const identity = { issuer: new URL(authUrl).origin, subject: "browser-fixture-owner" };
const keys = generateKeyPairSync("ed25519");
await applyMigrations(admin, await readMigrations(resolve("database/migrations")));
await admin.query("TRUNCATE atlas.app_users CASCADE");
const seeds = collectionSeedSchema.parse(
  JSON.parse(await readFile("database/seeds/collections.json", "utf8")),
);
const fixtureToken = `atlas_${randomBytes(32).toString("base64url")}`;
await inTransaction(admin, async (c) => {
  await c.query("SET LOCAL ROLE atlas_owner");
  const owner = await bindOwner(c, identity, seeds);
  const agent = (
    await c.query(
      "INSERT INTO atlas.agents(workspace_id,name,type) VALUES($1,'Browser fixture agent','codex') RETURNING id",
      [owner.workspaceId],
    )
  ).rows[0];
  await c.query(
    "INSERT INTO atlas_private.agent_credentials(workspace_id,agent_id,token_digest,display_prefix,expires_at,operations) VALUES($1,$2,$3,$4,now()+interval '1 hour',ARRAY['read','manage_projects','capture_checkpoint'])",
    [
      owner.workspaceId,
      agent.id,
      createHash("sha256").update(fixtureToken).digest("hex"),
      fixtureToken.slice(0, 14),
    ],
  );
});
const fixtureAgent = await authenticateAgent(pool, fixtureToken);
await withPrincipal(pool, fixtureAgent, fixtureAgent.workspaceId, async (c) => {
  const p = await ensureRepository(c, {
    repository_digest: createHash("sha256").update("browser-fixture-repository").digest("hex"),
    name: "Agent-first browser project",
  });
  await captureCheckpoint(c, fixtureAgent.workspaceId, fixtureAgent.agentId, p.id, {
    title: "Automatic knowledge is visible",
    kind: "lesson",
    markdown:
      "Observed in this controlled local fixture: a connected agent registers a project and saves a checkpoint. No manual project form is needed for this flow.",
    provenance: {
      paths: ["AGENTS.md"],
      verification: "Controlled local fixture, not personal browser acceptance.",
    },
    request_key: "browser-checkpoint-12345",
  });
});
const app = createApp(
  loadConfig({ NODE_ENV: "test", API_PORT: "4319", NEON_AUTH_BASE_URL: authUrl }),
  undefined,
  createVaultServices(
    pool,
    createIdentityVerifier(identity.issuer, keys.publicKey),
    identity,
    "fixture",
  ),
);
app.get("/fixture/session", (c) => {
  const now = Math.floor(Date.now() / 1000),
    parts = [
      { alg: "EdDSA", typ: "JWT" },
      { iss: identity.issuer, sub: identity.subject, iat: now, exp: now + 3600 },
    ].map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"));
  const body = parts.join(".");
  return c.json({
    token: `${body}.${sign(null, Buffer.from(body), keys.privateKey).toString("base64url")}`,
    authOrigin: new URL(authUrl).origin,
  });
});
app.post("/fixture/owner/:state", async (c) => {
  await admin.query(
    "UPDATE atlas.app_users SET disabled_at=CASE WHEN $3 THEN now() ELSE NULL END WHERE issuer=$1 AND subject=$2",
    [identity.issuer, identity.subject, c.req.param("state") === "disable"],
  );
  return c.json({ ok: true });
});
attachStatic(app, resolve("apps/web/dist"));
const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 4319 }, () =>
  process.stdout.write("Local owner browser fixture listening on 4319\n"),
);
const close = () => {
  server.close();
  void Promise.all([pool.end(), admin.end()]);
};
process.once("SIGINT", close);
process.once("SIGTERM", close);
