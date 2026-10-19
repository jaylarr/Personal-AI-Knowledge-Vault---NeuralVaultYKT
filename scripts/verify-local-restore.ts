import { spawn } from "node:child_process";
import { resolve } from "node:path";
const child = spawn(
  process.execPath,
  [
    resolve("node_modules/vitest/vitest.mjs"),
    "run",
    "--config",
    "tests/vitest.mcp.config.ts",
    "tests/mcp/local-recovery.test.ts",
  ],
  { cwd: resolve("."), stdio: "inherit", windowsHide: true },
);
child.once("error", () => {
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
