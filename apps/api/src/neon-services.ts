import { randomUUID } from "node:crypto";
import {
  createNeonVerifier,
  createPool,
  inTransaction,
  createNeonS3Client,
  checkNeonSourceBucket,
} from "@atlas/core";
import type { ApiConfig } from "./config.js";
import { createVaultServices } from "./vault.js";

export function createNeonServices(config: ApiConfig) {
  // Never fall back to the administrative URL pulled by the CLI.
  const pool = config.ATLAS_DATABASE_URL
    ? createPool(config.ATLAS_DATABASE_URL, "atlas-api")
    : undefined;
  const verify =
    config.NEON_AUTH_BASE_URL && config.NEON_AUTH_JWKS_URL
      ? createNeonVerifier(config.NEON_AUTH_BASE_URL, config.NEON_AUTH_JWKS_URL)
      : undefined;
  if (config.ATLAS_DATABASE_URL && new URL(config.ATLAS_DATABASE_URL).username !== "atlas_api") {
    throw new Error("Restricted application role required");
  }
  const sourceStorage =
    config.AWS_ACCESS_KEY_ID &&
    config.AWS_SECRET_ACCESS_KEY &&
    config.AWS_ENDPOINT_URL_S3 &&
    config.AWS_REGION
      ? createNeonS3Client({
          endpoint: config.AWS_ENDPOINT_URL_S3,
          region: config.AWS_REGION,
          accessKeyId: config.AWS_ACCESS_KEY_ID,
          secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
        })
      : undefined;
  const status = async () => {
    const [database, auth, storage] = await Promise.all([
      pool
        ? pool
            .query("SELECT current_user AS role,current_database() AS database")
            .then((r) =>
              r.rows[0]?.role === "atlas_api" && r.rows[0]?.database === "neondb"
                ? ("connected" as const)
                : ("unavailable" as const),
            )
            .catch(() => "unavailable" as const)
        : Promise.resolve("not_configured" as const),
      config.NEON_AUTH_JWKS_URL
        ? fetch(config.NEON_AUTH_JWKS_URL, { signal: AbortSignal.timeout(5000), redirect: "error" })
            .then(async (r) => {
              if (!r.ok) return "unavailable" as const;
              const body = (await r.json()) as { keys?: { kty?: string; crv?: string }[] };
              return body.keys?.some((key) => key.kty === "OKP" && key.crv === "Ed25519")
                ? ("connected" as const)
                : ("unavailable" as const);
            })
            .catch(() => "unavailable" as const)
        : Promise.resolve("not_configured" as const),
      sourceStorage
        ? checkNeonSourceBucket(sourceStorage).catch(() => "unavailable" as const)
        : Promise.resolve("not_configured" as const),
    ]);
    return { database, auth, storage, vault: "setup_required" as const };
  };
  const check = async (identity: { issuer: string; subject: string }, write: boolean) => {
    if (!pool) throw new Error("Database not configured");
    return inTransaction(pool, async (client) => {
      await client.query(
        "SELECT set_config('app.auth_issuer',$1,true),set_config('app.auth_subject',$2,true)",
        [identity.issuer, identity.subject],
      );
      if (write)
        await client.query(
          `INSERT INTO atlas_setup.auth_checks(issuer,subject,check_id) VALUES($1,$2,$3)
        ON CONFLICT(issuer,subject) DO UPDATE SET check_id=excluded.check_id,checked_at=now()`,
          [identity.issuer, identity.subject, randomUUID()],
        );
      const result = await client.query<{ check_id: string; checked_at: Date }>(
        "SELECT check_id,checked_at FROM atlas_setup.auth_checks WHERE issuer=$1 AND subject=$2",
        [identity.issuer, identity.subject],
      );
      const row = result.rows[0];
      return row ? { id: row.check_id, checked_at: row.checked_at.toISOString() } : null;
    });
  };
  return {
    vault:
      pool && verify && config.ATLAS_OWNER_ISSUER && config.ATLAS_OWNER_SUBJECT
        ? createVaultServices(pool, verify, {
            issuer: config.ATLAS_OWNER_ISSUER,
            subject: config.ATLAS_OWNER_SUBJECT,
          })
        : undefined,
    status,
    verify,
    check,
    close: async () => {
      sourceStorage?.destroy();
      await pool?.end();
    },
  };
}
export type NeonServices = ReturnType<typeof createNeonServices>;
