import { describe, expect, it } from "vitest";
import { loadConfig, setupCodes } from "../../apps/api/src/config.js";
import { loadMcpConfig } from "../../apps/mcp-server/src/config.js";
import { assertLocalTestTarget } from "@atlas/core";

describe("fail-closed configuration", () => {
  it("starts a setup-only process without secrets", () => {
    const config = loadConfig({});
    expect(config.API_HOST).toBe("127.0.0.1");
    expect(config.API_PORT).toBe(4317);
    expect(setupCodes(config)).toEqual([
      "DATABASE_NOT_CONFIGURED",
      "WORKER_DATABASE_NOT_CONFIGURED",
      "AUTH_NOT_CONFIGURED",
      "OWNER_NOT_BOUND",
      "STORAGE_NOT_CONFIGURED",
      "LIVE_SETUP_NOT_VERIFIED",
    ]);
  });
  it.each(["0.0.0.0", "localhost", "192.168.1.1"])(
    "rejects public/noncanonical bind %s",
    (API_HOST) => {
      expect(() => loadConfig({ API_HOST })).toThrow("API_HOST");
    },
  );
  it.each(["1", "65536", "bad", "4317.5"])("rejects invalid port %s", (API_PORT) => {
    expect(() => loadConfig({ API_PORT })).toThrow("API_PORT");
  });
  it("redacts a malformed secret-bearing URL", () => {
    try {
      loadConfig({ DATABASE_URL: "https://owner:private-value@db.example/vault" });
    } catch (error) {
      expect(String(error)).toContain("DATABASE_URL");
      expect(String(error)).not.toContain("private-value");
      return;
    }
    throw new Error("Expected rejection");
  });
  it.each(["http://auth.example", "https://user:secret@auth.example", "not-a-url"])(
    "rejects unsafe auth endpoints",
    (NEON_AUTH_BASE_URL) => {
      expect(() => loadConfig({ NEON_AUTH_BASE_URL })).toThrow("NEON_AUTH_BASE_URL");
    },
  );
  it("empty dotenv fields remain setup-needed", () => {
    expect(loadConfig({ DATABASE_URL: "" }).DATABASE_URL).toBeUndefined();
  });
});

describe("MCP credential transport", () => {
  const token = `atlas_${"A".repeat(43)}`;
  it("accepts only explicit scoped credential on loopback", () => {
    expect(loadMcpConfig({ ATLAS_AGENT_TOKEN: token }).apiUrl).toBe("http://127.0.0.1:4317");
  });
  it.each([
    "https://example.com",
    "http://example.com",
    "http://127.0.0.1@evil.test",
    "http://127.0.0.1/?token=secret",
    "http://127.0.0.1/path",
  ])("rejects unsafe destination %s", (ATLAS_API_URL) => {
    expect(() => loadMcpConfig({ ATLAS_API_URL, ATLAS_AGENT_TOKEN: token })).toThrow();
  });
  it("redacts malformed credentials", () => {
    expect(() => loadMcpConfig({ ATLAS_AGENT_TOKEN: "private-value" })).toThrow(
      "A scoped agent credential is required",
    );
  });
});

describe("isolated database target", () => {
  const id = "local:atlas-tests:atlas_test";
  it("accepts the exact disposable target", () => {
    expect(
      assertLocalTestTarget("postgres://test:secret@127.0.0.1:55432/atlas_test", id).pathname,
    ).toBe("/atlas_test");
  });
  it.each([
    "postgres://test:secret@neon.example:55432/atlas_test",
    "postgres://test:secret@127.0.0.1:5432/atlas_test",
    "postgres://test:secret@127.0.0.1:55432/neondb",
    "postgres://test:secret@127.0.0.1:55432/atlas_test?host=evil",
    "https://127.0.0.1:55432/atlas_test",
  ])("rejects unsafe target %s", (url) => {
    expect(() => assertLocalTestTarget(url, id)).toThrow();
  });
  it("requires explicit target identity", () => {
    expect(() =>
      assertLocalTestTarget("postgres://test:secret@127.0.0.1:55432/atlas_test", undefined),
    ).toThrow();
  });
});
