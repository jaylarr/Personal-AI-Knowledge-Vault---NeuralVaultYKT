import { spawn } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

// Start only this project's loopback API. Node's explicit stdio handle list
// prevents a Windows child from retaining the requesting MCP transport pipes.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
let stdout: number | undefined, stderr: number | undefined;
try {
  if (process.env.ATLAS_STORAGE_MODE !== "local" || !process.env.ATLAS_AGENT_TOKEN)
    throw Error("Protected local launch configuration is required");
  stdout = openSync(join(root, ".local/api.stdout.log"), "w", 0o600);
  stderr = openSync(join(root, ".local/api.stderr.log"), "w", 0o600);
  const child = spawn(process.execPath, [join(root, "apps/api/dist/index.js")], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", stdout, stderr],
  });
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("spawn", resolve);
  });
  child.unref();
} catch {
  process.stderr.write("ATLAS local API launch failed; configuration redacted.\n");
  process.exitCode = 1;
} finally {
  if (stdout !== undefined) closeSync(stdout);
  if (stderr !== undefined) closeSync(stderr);
}
