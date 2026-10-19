import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { Hono } from "hono";
import type { ApiEnv } from "./app.js";

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
export function attachStatic(app: Hono<ApiEnv>, root: string) {
  const directory = resolve(root);
  app.get("*", async (c, next) => {
    if (c.req.path.startsWith("/api/") || ["/health", "/ready"].includes(c.req.path)) return next();
    let path: string;
    try {
      path = decodeURIComponent(c.req.path);
    } catch {
      return next();
    }
    if (
      path.includes("\\") ||
      path.includes("\0") ||
      path.split("/").some((segment) => segment.startsWith("."))
    )
      return next();
    const target = resolve(directory, `.${path}`);
    if (target !== directory && !target.startsWith(`${directory}${sep}`)) return next();
    const extension = extname(target);
    if (extension && !mime[extension]) return next();
    try {
      const file = await readFile(extension ? target : resolve(directory, "index.html"));
      c.header("Content-Type", mime[extension || ".html"] ?? "application/octet-stream");
      return c.body(new Uint8Array(file));
    } catch {
      return next();
    }
  });
}
