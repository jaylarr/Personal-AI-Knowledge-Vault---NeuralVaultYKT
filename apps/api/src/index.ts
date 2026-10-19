import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { ConfigError, loadConfig } from "./config.js";
import { attachStatic } from "./static.js";
import { createNeonServices } from "./neon-services.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createLocalServices } from "./local-vault.js";

try {
  const config = loadConfig(process.env);
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const cloud = process.env.ATLAS_STORAGE_MODE === "cloud";
  const saved = cloud
    ? null
    : (JSON.parse(await readFile(resolve(root, ".local/vault.json"), "utf8")) as {
        root: string;
        agentId: string;
        expiresAt: string;
      });
  const neon = cloud ? createNeonServices(config) : undefined;
  const local = saved
    ? createLocalServices(saved.root, {
        agentId: saved.agentId,
        ...(process.env.ATLAS_AGENT_TOKEN ? { token: process.env.ATLAS_AGENT_TOKEN } : {}),
        expiresAt: saved.expiresAt,
      })
    : undefined;
  if (local) await local.vault.initialize();
  local?.domain.start();
  const app = createApp(config, neon, neon?.vault, local);
  attachStatic(app, fileURLToPath(new URL("../../web/dist/", import.meta.url)));
  const server = serve(
    { fetch: app.fetch, hostname: config.API_HOST, port: config.API_PORT },
    () => {
      process.stderr.write(`ATLAS listening on http://localhost:${config.API_PORT}\n`);
    },
  );
  server.on("error", (error: NodeJS.ErrnoException) => {
    process.stderr.write(
      error.code === "EADDRINUSE"
        ? "ATLAS port is occupied; no alternate port was opened.\n"
        : "ATLAS server failed to start.\n",
    );
    process.exitCode = 1;
  });
  const close = () => {
    local?.domain.close();
    server.close();
    void neon?.close();
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
} catch (error) {
  process.stderr.write(
    error instanceof ConfigError ? `${error.message}\n` : "ATLAS could not start.\n",
  );
  process.exitCode = 1;
}
