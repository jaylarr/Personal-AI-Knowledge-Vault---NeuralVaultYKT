export function loadMcpConfig(env: Record<string, string | undefined>) {
  let url: URL;
  try {
    url = new URL(env.ATLAS_API_URL ?? "http://127.0.0.1:4317");
  } catch {
    throw new Error("Invalid MCP API URL");
  }
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error("MCP requires a loopback HTTP API origin");
  }
  const token = env.ATLAS_AGENT_TOKEN;
  if (!token || !/^atlas_[A-Za-z0-9_-]{43}$/.test(token))
    throw new Error("A scoped agent credential is required");
  return { apiUrl: url.origin, token };
}
