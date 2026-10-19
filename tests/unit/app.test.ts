import { describe, expect, it } from "vitest";
import { errorSchema, healthSchema, readinessSchema } from "@atlas/contracts";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";

const app = createApp(loadConfig({}));
const base = "http://localhost:4317";
describe("loopback API", () => {
  it("distinguishes liveness from setup readiness", async () => {
    const response = await app.request(`${base}/health`);
    expect(response.status).toBe(200);
    expect(healthSchema.parse(await response.json()).status).toBe("alive");
    const ready = await app.request(`${base}/ready`);
    expect(ready.status).toBe(503);
    expect(readinessSchema.parse(await ready.json()).codes).toContain("AUTH_NOT_CONFIGURED");
  });
  it("protects domain access even when route is requested directly", async () => {
    const response = await app.request(`${base}/api/v1/projects`);
    expect(response.status).toBe(401);
    expect(errorSchema.parse(await response.json()).error.code).toBe("UNAUTHORIZED");
  });
  it.each(["http://evil.test", "null", "https://localhost:4317", "http://localhost:5174"])(
    "rejects origin %s",
    async (Origin) => {
      expect((await app.request(`${base}/ready`, { headers: { Origin } })).status).toBe(403);
    },
  );
  it("rejects DNS rebinding Host", async () => {
    expect(
      (await app.request(`${base}/health`, { headers: { Host: "evil.test:4317" } })).status,
    ).toBe(403);
  });
  it("rejects cross-site browser requests without Origin", async () => {
    expect(
      (await app.request(`${base}/health`, { headers: { "Sec-Fetch-Site": "cross-site" } })).status,
    ).toBe(403);
  });
  it("accepts the Vite browser origin", async () => {
    expect(
      (await app.request(`${base}/health`, { headers: { Origin: "http://localhost:5173" } }))
        .status,
    ).toBe(200);
  });
  it("rejects oversized request bodies", async () => {
    const response = await app.request(`${base}/api/v1/sources`, {
      method: "POST",
      body: "x".repeat(2 * 1024 * 1024 + 1),
    });
    expect(response.status).toBe(413);
  });
  it("issues safe unique request IDs and security headers", async () => {
    const a = await app.request(`${base}/health`, { headers: { "X-Request-Id": "injected" } });
    const b = await app.request(`${base}/health`);
    expect(a.headers.get("x-request-id")).toMatch(/^[a-f0-9-]{36}$/);
    expect(a.headers.get("x-request-id")).not.toBe(b.headers.get("x-request-id"));
    expect(a.headers.get("cache-control")).toBe("no-store");
    expect(a.headers.get("x-content-type-options")).toBe("nosniff");
    expect(a.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
  it("does not echo request values in errors", async () => {
    const response = await app.request(`${base}/api/v1/sources`, {
      method: "POST",
      body: "secret-source",
    });
    expect(await response.text()).not.toContain("secret-source");
  });
});
