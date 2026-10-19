import { describe, it, expect } from "vitest";
import { assertNeonMigrationTarget, authorizedNeon } from "../../scripts/neon-target.js";
describe("authorized production migration target", () => {
  const env = {
    DATABASE_TARGET_ID: `${authorizedNeon.projectId}:${authorizedNeon.branchId}:neondb`,
    DATABASE_URL_UNPOOLED: `postgres://neondb_owner:synthetic@${authorizedNeon.endpointHost}/neondb?sslmode=require`,
  };
  it("accepts only the explicit direct ATLAS target and requires verified TLS", () => {
    expect(new URL(assertNeonMigrationTarget(env)).searchParams.get("sslmode")).toBe("verify-full");
  });
  it.each([
    { DATABASE_TARGET_ID: "different-project:production:neondb" },
    {
      DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED.replace(
        "ep-still-lake",
        "ep-still-lake-pooler",
      ),
    },
    { DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED.replace("/neondb", "/other") },
    { DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED.replace("neondb_owner:", "atlas_api:") },
    { DATABASE_URL_UNPOOLED: `${env.DATABASE_URL_UNPOOLED}&host=evil.test` },
    { DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED.replace("/neondb", ":6543/neondb") },
    { DATABASE_URL_UNPOOLED: `${env.DATABASE_URL_UNPOOLED}#fragment` },
    { DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED.replace(":synthetic@", ":@") },
  ])("rejects target/login/parameter drift without printing credentials", (change) => {
    expect(() => assertNeonMigrationTarget({ ...env, ...change })).toThrow("target mismatch");
  });
});
