import type { SetupCode } from "@atlas/contracts";
import { z } from "zod";

const optionalValue = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);
const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.literal("127.0.0.1").default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(4317),
  DATABASE_URL: optionalValue,
  ATLAS_DATABASE_URL: optionalValue,
  WORKER_DATABASE_URL: optionalValue,
  NEON_AUTH_BASE_URL: optionalValue,
  NEON_AUTH_JWKS_URL: optionalValue,
  ATLAS_OWNER_ISSUER: optionalValue,
  ATLAS_OWNER_SUBJECT: optionalValue,
  AWS_ACCESS_KEY_ID: optionalValue,
  AWS_SECRET_ACCESS_KEY: optionalValue,
  AWS_ENDPOINT_URL_S3: optionalValue,
  AWS_REGION: optionalValue,
});

export type ApiConfig = z.infer<typeof configSchema>;
export class ConfigError extends Error {
  constructor(readonly fields: readonly string[]) {
    super(`Invalid configuration fields: ${fields.join(", ")}`);
  }
}

export function loadConfig(env: Record<string, string | undefined>): ApiConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success)
    throw new ConfigError([...new Set(parsed.error.issues.map((i) => String(i.path[0])))]);
  const result = parsed.data;
  const invalid: string[] = [];
  for (const key of ["DATABASE_URL", "ATLAS_DATABASE_URL", "WORKER_DATABASE_URL"] as const) {
    if (!result[key]) continue;
    try {
      const url = new URL(result[key]);
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !url.hostname ||
        !url.username ||
        !url.password ||
        url.pathname.length < 2
      )
        invalid.push(key);
    } catch {
      invalid.push(key);
    }
  }
  for (const key of [
    "NEON_AUTH_BASE_URL",
    "NEON_AUTH_JWKS_URL",
    "ATLAS_OWNER_ISSUER",
    "AWS_ENDPOINT_URL_S3",
  ] as const) {
    if (!result[key]) continue;
    try {
      const url = new URL(result[key]);
      if (url.protocol !== "https:" || url.username || url.password || url.hash) invalid.push(key);
    } catch {
      invalid.push(key);
    }
  }
  if (invalid.length) throw new ConfigError(invalid);
  if (result.ATLAS_DATABASE_URL && new URL(result.ATLAS_DATABASE_URL).username !== "atlas_api") {
    throw new ConfigError(["ATLAS_DATABASE_URL"]);
  }
  if (result.NEON_AUTH_BASE_URL && result.NEON_AUTH_JWKS_URL) {
    const base = new URL(result.NEON_AUTH_BASE_URL);
    const jwks = new URL(result.NEON_AUTH_JWKS_URL);
    if (
      base.origin !== jwks.origin ||
      jwks.pathname !== `${base.pathname.replace(/\/$/, "")}/.well-known/jwks.json`
    )
      throw new ConfigError(["NEON_AUTH_JWKS_URL"]);
  }
  return result;
}

export function setupCodes(config: ApiConfig): SetupCode[] {
  const codes: SetupCode[] = [];
  if (!config.DATABASE_URL) codes.push("DATABASE_NOT_CONFIGURED");
  if (!config.WORKER_DATABASE_URL) codes.push("WORKER_DATABASE_NOT_CONFIGURED");
  if (!config.NEON_AUTH_BASE_URL || !config.NEON_AUTH_JWKS_URL) codes.push("AUTH_NOT_CONFIGURED");
  if (!config.ATLAS_OWNER_ISSUER || !config.ATLAS_OWNER_SUBJECT) codes.push("OWNER_NOT_BOUND");
  if (
    !config.AWS_ACCESS_KEY_ID ||
    !config.AWS_SECRET_ACCESS_KEY ||
    !config.AWS_ENDPOINT_URL_S3 ||
    !config.AWS_REGION
  )
    codes.push("STORAGE_NOT_CONFIGURED");
  // Configuration alone is not proof of live auth/database/storage readiness.
  codes.push("LIVE_SETUP_NOT_VERIFIED");
  return codes;
}
