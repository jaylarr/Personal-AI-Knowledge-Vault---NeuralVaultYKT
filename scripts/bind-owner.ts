import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { bindOwner, createNeonVerifier, createPool, inTransaction } from "@atlas/core";
import { collectionSeedSchema } from "@atlas/contracts";
import { localAdminTarget } from "./check-target.js";
import { readNeonSetup, assertNeonMigrationTarget, updateEnv } from "./neon-target.js";
import { identityFromVerifiedReceipt } from "./owner-receipt.js";
try {
  const mode = process.argv[2] ?? "local";
  if (!["local", "neon", "neon-receipt"].includes(mode))
    throw Error("Choose an owner setup target");
  const neon = mode.startsWith("neon") ? await readNeonSetup() : undefined;
  const config = { ...neon?.env, ...process.env };
  const url = neon ? assertNeonMigrationTarget(config) : localAdminTarget(process.env);
  const {
    NEON_AUTH_BASE_URL: base,
    NEON_AUTH_JWKS_URL: jwks,
    ATLAS_OWNER_TOKEN: token,
    ATLAS_OWNER_ISSUER: issuer,
    ATLAS_OWNER_SUBJECT: subject,
  } = config;
  if (!base || !jwks || (mode !== "neon-receipt" && (!token || !issuer || !subject)))
    throw Error("Owner setup incomplete");
  if (neon && base !== neon.target.authBaseUrl) throw Error("Owner Auth branch mismatch");
  const identity =
    mode === "neon-receipt" ? undefined : await createNeonVerifier(base, jwks)(token ?? "");
  if (identity && (identity.issuer !== issuer || identity.subject !== subject))
    throw Error("Owner identity mismatch");
  const seeds = collectionSeedSchema.parse(
    JSON.parse(await readFile(resolve("database/seeds/collections.json"), "utf8")),
  );
  const pool = createPool(url, "atlas-bind-owner");
  try {
    await inTransaction(pool, async (c) => {
      // Receipt access requires the setup administrator, not the table owner.
      await c.query("RESET ROLE");
      const selectedEmail = process.argv[3] ?? "";
      const receipt =
        mode === "neon-receipt"
          ? await c.query(
              'SELECT u.email,u.id::text AS auth_user_id,r.issuer,r.subject,r.check_id,r.checked_at FROM neon_auth."user" u JOIN atlas_setup.auth_checks r ON r.subject=u.id::text WHERE lower(u.email)=lower($1) AND r.issuer=$2',
              [selectedEmail, new URL(base).origin],
            )
          : undefined;
      const verified =
        identity ?? identityFromVerifiedReceipt(receipt?.rows, selectedEmail, new URL(base).origin);
      await c.query("SET LOCAL ROLE atlas_owner");
      await bindOwner(c, verified, seeds);
      if (neon)
        await writeFile(
          ".env.local",
          updateEnv(neon.original, {
            ATLAS_OWNER_ISSUER: verified.issuer,
            ATLAS_OWNER_SUBJECT: verified.subject,
          }),
          { mode: 0o600 },
        );
    });
    process.stdout.write(
      neon
        ? "Verified owner bound to the authorized ATLAS Neon installation; restart the local API.\n"
        : "Verified owner bound to local test installation. No cloud changes.\n",
    );
  } finally {
    await pool.end();
  }
} catch {
  process.stderr.write(
    "Owner binding refused or failed. Check the explicit target and verified owner configuration; details redacted.\n",
  );
  process.exitCode = 1;
}
