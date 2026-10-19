import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/app.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { attachStatic } from "../../apps/api/src/static.js";
import { requireMigrationTarget } from "../../scripts/check-target.js";

describe("runtime boundaries", () => {
  it("fails on an occupied loopback port without trying another port", async () => {
    const occupied = createServer();
    await new Promise<void>((resolve) => occupied.listen(0, "127.0.0.1", resolve));
    const address = occupied.address();
    if (!address || typeof address === "string") throw new Error("Port allocation failed");
    try {
      const result = await new Promise<{ code: number | null; stderr: string }>(
        (resolve, reject) => {
          const child = spawn(process.execPath, ["--import", "tsx", "apps/api/src/index.ts"], {
            cwd: process.cwd(),
            env: { ...process.env, API_HOST: "127.0.0.1", API_PORT: String(address.port) },
            stdio: ["ignore", "ignore", "pipe"],
            windowsHide: true,
          });
          let stderr = "";
          child.stderr.on("data", (data: Buffer) => {
            stderr += data.toString();
          });
          const timer = setTimeout(() => {
            child.kill();
            reject(new Error("Occupied-port startup hung"));
          }, 7000);
          child.once("error", (error) => {
            clearTimeout(timer);
            reject(error);
          });
          child.once("exit", (code) => {
            clearTimeout(timer);
            resolve({ code, stderr });
          });
        },
      );
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("port is occupied");
      expect(result.stderr).not.toContain("ATLAS listening");
    } finally {
      await new Promise<void>((resolve) => occupied.close(() => resolve()));
    }
  }, 10000);
  it("blocks Neon migration attempts before opening a connection", () => {
    expect(() =>
      requireMigrationTarget("neon", {
        DATABASE_URL_UNPOOLED: "postgres://secret:secret@unrelated.neon.tech/neondb",
      }),
    ).toThrow("Neon migration gate closed");
    expect(() => requireMigrationTarget(undefined, {})).toThrow("explicit migration mode");
  });
  it("redacts unexpected exceptions", async () => {
    const app = createApp(loadConfig({}));
    app.get("/failure-probe", () => {
      throw new Error("password=should-never-appear");
    });
    const response = await app.request("http://localhost:4317/failure-probe");
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("should-never-appear");
  });
  it("serves only safe SPA files and never falls back for API, missing assets or dotfiles", async () => {
    await mkdir(".artifacts", { recursive: true });
    const root = await mkdtemp(resolve(".artifacts/static-probe-"));
    const entries = ["index.html", "probe.js", ".env", "secret.sql"];
    try {
      await Promise.all(
        entries.map((name) =>
          writeFile(
            resolve(root, name),
            name === "index.html" ? "<h1>setup-shell</h1>" : "private-probe",
          ),
        ),
      );
      const app = createApp(loadConfig({}));
      attachStatic(app, root);
      expect(await (await app.request("http://localhost:4317/setup")).text()).toContain(
        "setup-shell",
      );
      expect(
        (await app.request("http://localhost:4317/probe.js")).headers.get("content-type"),
      ).toBe("text/javascript");
      for (const path of ["/.env", "/secret.sql", "/missing.js", "/%2Eenv", "/%2e%2e%5c.env"]) {
        const response = await app.request(`http://localhost:4317${path}`);
        expect(response.status).toBe(404);
        expect(await response.text()).not.toContain("private-probe");
      }
      const domain = await app.request("http://localhost:4317/api/v1/sources");
      expect(domain.status).toBe(401);
      expect(await domain.text()).not.toContain("setup-shell");
    } finally {
      await Promise.all(entries.map((name) => unlink(resolve(root, name))));
      await rmdir(root);
    }
  });
});
