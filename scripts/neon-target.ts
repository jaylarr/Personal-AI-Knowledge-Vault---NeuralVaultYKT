import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { z } from "@atlas/contracts";

export const authorizedNeon = {
  organizationId: "org-floral-darkness-38230607",
  projectId: "misty-fire-28366774",
  branchId: "br-withered-recipe-azwll09c",
  branchName: "production",
  endpointHost: "ep-still-lake-azy9a8zj.c-3.ap-southeast-1.aws.neon.tech",
  databaseName: "neondb",
} as const;
export function assertNeonMigrationTarget(env: Record<string, string | undefined>) {
  const t = authorizedNeon,
    url = new URL(env.DATABASE_URL_UNPOOLED ?? "");
  if (
    env.DATABASE_TARGET_ID !== `${t.projectId}:${t.branchId}:${t.databaseName}` ||
    url.hostname !== t.endpointHost ||
    url.pathname !== `/${t.databaseName}` ||
    url.username !== "neondb_owner" ||
    !url.password ||
    (url.port !== "" && url.port !== "5432") ||
    url.hash !== "" ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    [...url.searchParams.keys()].some(
      (k) => !["sslmode", "channel_binding", "connect_timeout", "application_name"].includes(k),
    )
  )
    throw Error("Authorized Neon migration target mismatch");
  url.searchParams.set("sslmode", "verify-full");
  return url.href;
}
export async function readNeonSetup() {
  const target = z
    .object({
      organizationId: z.literal(authorizedNeon.organizationId),
      projectId: z.literal(authorizedNeon.projectId),
      branchId: z.literal(authorizedNeon.branchId),
      branchName: z.literal("production"),
      endpointHost: z.literal(authorizedNeon.endpointHost),
      databaseName: z.literal("neondb"),
      authBaseUrl: z.url(),
      domainSchemaAuthorized: z.literal(true),
      storageBucket: z.literal("atlas-sources"),
      rehearsal: z.object({
        branchId: z.literal("br-little-wave-az86ax08"),
        branchName: z.literal("atlas-setup-check-20261017"),
        endpointHost: z.literal("ep-dark-hill-az2iw7dc.c-3.ap-southeast-1.aws.neon.tech"),
        expiresAt: z.iso.datetime(),
      }),
    })
    .parse(JSON.parse(await readFile("docs/neon-target.json", "utf8")));
  const link = JSON.parse(await readFile(".neon", "utf8")) as {
    projectId: string;
    orgId: string;
    branch: string;
  };
  if (
    link.projectId !== target.projectId ||
    link.orgId !== target.organizationId ||
    link.branch !== target.branchName
  )
    throw Error("Neon link mismatch");
  const original = await readFile(".env.local", "utf8"),
    env = parseEnv(original);
  if (
    (env.NEON_BRANCH !== target.branchId && env.NEON_BRANCH !== target.branchName) ||
    env.NEON_AUTH_BASE_URL !== target.authBaseUrl
  )
    throw Error("Pulled Neon branch mismatch");
  assertNeonMigrationTarget(env);
  return { target, env, original };
}
export function updateEnv(original: string, values: Record<string, string>) {
  let result = original;
  for (const [key, value] of Object.entries(values)) {
    if (!/^[A-Z0-9_]+$/.test(key) || /[\r\n]/.test(value)) throw Error("Invalid environment field");
    const pattern = new RegExp(`^${key}=.*$`, "m");
    result = pattern.test(result)
      ? result.replace(pattern, `${key}=${value}`)
      : `${result.trimEnd()}\n${key}=${value}\n`;
  }
  return result;
}
