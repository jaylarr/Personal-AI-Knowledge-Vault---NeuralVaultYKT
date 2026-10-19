import pg from "pg";
import { localAdminTarget } from "./check-target.js";

try {
  const client = new pg.Client({
    connectionString: localAdminTarget(process.env),
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(4317, 1801)");
    const owner = await client.query("SELECT 1 FROM pg_roles WHERE rolname='atlas_owner'");
    if (!owner.rowCount)
      await client.query(
        "CREATE ROLE atlas_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS",
      );
    const ownerFlags = await client.query(
      "SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolbypassrls FROM pg_roles WHERE rolname='atlas_owner'",
    );
    if (!ownerFlags.rows[0] || Object.values(ownerFlags.rows[0]).some(Boolean)) {
      throw new Error("Unexpected owner-role privileges; preserving existing configuration");
    }
    for (const [role, envKey] of [
      ["atlas_api", "ATLAS_TEST_API_PASSWORD"],
      ["atlas_worker", "ATLAS_TEST_WORKER_PASSWORD"],
    ] as const) {
      const password = process.env[envKey];
      if (!password || !/^[a-f0-9]{64}$/.test(password))
        throw new Error("Invalid test role configuration");
      const existing = await client.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role]);
      if (!existing.rowCount)
        await client.query(
          `CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD ${pg.escapeLiteral(password)}`,
        );
      const grants = await client.query(
        "SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=$1",
        [role],
      );
      if (grants.rowCount)
        throw new Error("Unexpected role memberships; preserving existing configuration");
      const flags = await client.query<{
        rolsuper: boolean;
        rolbypassrls: boolean;
        rolcreaterole: boolean;
        rolcreatedb: boolean;
        rolinherit: boolean;
      }>(
        "SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit FROM pg_roles WHERE rolname=$1",
        [role],
      );
      const row = flags.rows[0];
      if (!row || Object.values(row).some(Boolean))
        throw new Error("Unexpected privileged test role");
    }
    await client.query("COMMIT");
    process.stdout.write("Restricted local test roles verified.\n");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
} catch {
  process.stderr.write(
    "Local role bootstrap failed. Target/configuration preserved; credentials redacted.\n",
  );
  process.exitCode = 1;
}
