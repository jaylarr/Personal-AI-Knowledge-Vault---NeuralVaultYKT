import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { assertLocalTestTarget } from "../packages/core/src/db/target.js";

try {
  await mkdir(".local", { recursive: true });
  let existing: string | undefined;
  try {
    existing = await readFile(".local/test.env", "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (existing !== undefined) {
    const config = parseEnv(existing);
    for (const key of ["ATLAS_TEST_ADMIN_URL", "ATLAS_TEST_API_URL", "ATLAS_TEST_WORKER_URL"]) {
      assertLocalTestTarget(config[key] ?? "", config.DATABASE_TARGET_ID);
    }
    for (const key of [
      "ATLAS_TEST_ADMIN_PASSWORD",
      "ATLAS_TEST_API_PASSWORD",
      "ATLAS_TEST_WORKER_PASSWORD",
    ]) {
      if (!/^[a-f0-9]{64}$/.test(config[key] ?? ""))
        throw new Error("Existing test configuration is invalid; it was preserved");
    }
    process.stdout.write("Existing isolated test configuration preserved.\n");
  } else {
    const admin = randomBytes(32).toString("hex");
    const api = randomBytes(32).toString("hex");
    const worker = randomBytes(32).toString("hex");
    const content = [
      "DATABASE_TARGET_ID=local:atlas-tests:atlas_test",
      `ATLAS_TEST_ADMIN_PASSWORD=${admin}`,
      `ATLAS_TEST_API_PASSWORD=${api}`,
      `ATLAS_TEST_WORKER_PASSWORD=${worker}`,
      `ATLAS_TEST_ADMIN_URL=postgresql://atlas_test_admin:${admin}@127.0.0.1:55432/atlas_test`,
      `ATLAS_TEST_API_URL=postgresql://atlas_api:${api}@127.0.0.1:55432/atlas_test`,
      `ATLAS_TEST_WORKER_URL=postgresql://atlas_worker:${worker}@127.0.0.1:55432/atlas_test`,
      "",
    ].join("\n");
    await writeFile(".local/test.env", content, { flag: "wx", mode: 0o600 });
    process.stdout.write("Generated ignored test-only credentials. No credentials printed.\n");
  }
} catch {
  process.stderr.write(
    "Could not prepare isolated database configuration; existing files were preserved.\n",
  );
  process.exitCode = 1;
}
