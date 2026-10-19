import { describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { createNeonServices } from "../../apps/api/src/neon-services.js";
import { createNeonVerifier } from "@atlas/core";

describe("Neon integration boundaries", () => {
  it("never falls back to the CLI administrative database connection", async () => {
    const services = createNeonServices(
      loadConfig({ DATABASE_URL: "postgres://admin:synthetic@db.example/neondb" }),
    );
    expect((await services.status()).database).toBe("not_configured");
    await services.close();
  });
  it("rejects elevated runtime login configuration", () => {
    expect(() =>
      loadConfig({ ATLAS_DATABASE_URL: "postgres://neondb_owner:synthetic@db.example/neondb" }),
    ).toThrow("ATLAS_DATABASE_URL");
  });
  it("requires the JWKS endpoint from the exact configured Auth branch", () => {
    expect(() =>
      createNeonVerifier("https://auth.example/neondb/auth", "https://other.example/jwks"),
    ).toThrow();
    expect(() =>
      loadConfig({
        NEON_AUTH_BASE_URL: "https://auth.example/neondb/auth",
        NEON_AUTH_JWKS_URL: "https://auth.example/other/.well-known/jwks.json",
      }),
    ).toThrow("NEON_AUTH_JWKS_URL");
  });
  it("rejects missing and malformed tokens on direct requests", async () => {
    const app = createApp(loadConfig({}));
    for (const method of ["GET", "POST"]) {
      expect(
        (await app.request("http://localhost:4317/api/v1/auth/check", { method })).status,
      ).toBe(401);
    }
    expect(
      (
        await app.request("http://localhost:4317/api/v1/auth/check", {
          headers: { Authorization: "Basic synthetic" },
        })
      ).status,
    ).toBe(401);
  });
  it("exposes redacted dependency status without connecting vault routes", async () => {
    const app = createApp(loadConfig({}));
    const response = await app.request("http://localhost:4317/api/v1/setup/services");
    expect(await response.json()).toEqual({
      database: "not_configured",
      auth: "not_configured",
      storage: "not_configured",
      vault: "setup_required",
    });
    expect((await app.request("http://localhost:4317/api/v1/projects")).status).toBe(401);
  });
});
