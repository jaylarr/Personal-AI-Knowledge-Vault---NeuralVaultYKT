import { resolve } from "node:path";
import { applyMigrations, createPool, readMigrations } from "@atlas/core";
import { requireMigrationTarget } from "./check-target.js";

try {
  const connection = requireMigrationTarget(process.argv[2], process.env);
  const pool = createPool(connection, "atlas-migrations");
  try {
    const completed = await applyMigrations(
      pool,
      await readMigrations(resolve("database/migrations")),
    );
    process.stdout.write(
      completed.length
        ? `Applied ${completed.length} migration(s): ${completed.join(", ")}\n`
        : "Migration history verified; no changes.\n",
    );
  } finally {
    await pool.end();
  }
} catch (error) {
  const safeGate =
    error instanceof Error &&
    /^(Neon migration gate closed|Choose an explicit migration mode|Local test configuration missing|Unexpected local migration role|Test database target rejected|Invalid test database URL|Migration history mismatch|Out-of-order migration|Duplicate migration names)/.test(
      error.message,
    );
  process.stderr.write(
    safeGate
      ? `${(error as Error).message}\n`
      : "Migration failed; transaction rolled back. Credentials and SQL details redacted.\n",
  );
  process.exitCode = 1;
}
