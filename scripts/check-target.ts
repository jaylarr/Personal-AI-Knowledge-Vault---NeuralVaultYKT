import { assertLocalTestTarget } from "@atlas/core";

export function localAdminTarget(env: NodeJS.ProcessEnv) {
  const url = env.ATLAS_TEST_ADMIN_URL;
  if (!url) throw new Error("Local test configuration missing; run pnpm db:test:prepare");
  const target = assertLocalTestTarget(url, env.DATABASE_TARGET_ID);
  if (target.username !== "atlas_test_admin") throw new Error("Unexpected local migration role");
  return url;
}

export function requireMigrationTarget(mode: string | undefined, env: NodeJS.ProcessEnv) {
  if (mode === "local") return localAdminTarget(env);
  if (mode === "neon")
    throw new Error(
      "Neon migration gate closed for generic runner; use the checked neon:setup:domain production command",
    );
  throw new Error("Choose an explicit migration mode: local or neon");
}
