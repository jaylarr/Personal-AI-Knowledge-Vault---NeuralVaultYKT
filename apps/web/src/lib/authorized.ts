export class RequestError extends Error {
  constructor(readonly status: number) {
    super(
      status === 409
        ? "This changed or conflicts with an existing name. Reload and retry."
        : status === 401
          ? "Your session expired. Sign in again."
          : status === 403
            ? "This account is not bound to the vault."
            : status === 503
              ? "Owner setup or the database is unavailable."
              : "Check your entries and try again.",
    );
  }
}
export async function authorizedRequest(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
) {
  const { authClient } = await import("../auth/client.js");
  const session = await authClient?.token();
  if (!session?.data?.token) throw new RequestError(401);
  const response = await fetch(`/api/v1${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${session.data.token}`,
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    signal: options.signal ?? AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) throw new RequestError(response.status);
  return response.json() as Promise<unknown>;
}
