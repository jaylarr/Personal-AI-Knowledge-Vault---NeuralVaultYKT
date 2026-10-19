// Separate process persistence probe. Test-only; never accepts a cloud target.
import { generateKeyPairSync, sign, randomUUID } from "node:crypto";
import { assertLocalTestTarget, createPool, createIdentityVerifier } from "@atlas/core";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { createVaultServices } from "../../apps/api/src/vault.js";
if (process.env.NODE_ENV !== "test") throw Error("Test-only persistence probe");
const url = process.env.ATLAS_TEST_API_URL ?? "";
assertLocalTestTarget(url, process.env.DATABASE_TARGET_ID);
const pool = createPool(url, "atlas-restart-probe"),
  identity = { issuer: "https://owner.fixture.example", subject: "bound-owner" },
  keys = generateKeyPairSync("ed25519");
try {
  const now = Math.floor(Date.now() / 1000),
    body = [
      { alg: "EdDSA" },
      { iss: identity.issuer, sub: identity.subject, iat: now, exp: now + 120 },
    ]
      .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
      .join(".");
  const token = `${body}.${sign(null, Buffer.from(body), keys.privateKey).toString("base64url")}`;
  const app = createApp(
    loadConfig({ NODE_ENV: "test" }),
    undefined,
    createVaultServices(
      pool,
      createIdentityVerifier(identity.issuer, keys.publicKey),
      identity,
      "fixture",
    ),
  );
  const response = await app.request(
    `http://localhost:4317/api/v1/workspaces/${process.argv[3]}/projects`,
    {
      method: process.argv[2] === "write" ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
      },
      ...(process.argv[2] === "write"
        ? { body: JSON.stringify({ name: "Across process restarts", slug: "restart-persistence" }) }
        : {}),
    },
  );
  process.stdout.write(
    JSON.stringify({ pid: process.pid, status: response.status, data: await response.json() }),
  );
} finally {
  await pool.end();
}
