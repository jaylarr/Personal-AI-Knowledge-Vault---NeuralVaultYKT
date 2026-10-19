import pg from "pg";

export function createPool(connectionString: string, applicationName: string) {
  return new pg.Pool({
    connectionString,
    application_name: applicationName,
    max: 8,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    query_timeout: 12000,
  });
}
