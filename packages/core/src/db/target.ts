export const LOCAL_TARGET = "local:atlas-tests:atlas_test";

export function assertLocalTestTarget(connectionString: string, target: string | undefined) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Invalid test database URL");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.port !== "55432" ||
    url.pathname !== "/atlas_test" ||
    url.search !== "" ||
    url.hash !== "" ||
    target !== LOCAL_TARGET
  ) {
    throw new Error("Test database target rejected; expected isolated loopback atlas_test:55432");
  }
  return url;
}
