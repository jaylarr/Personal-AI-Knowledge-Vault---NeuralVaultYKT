import { useMutation, useQueryClient } from "@tanstack/react-query";
export const personalPrefix = "/api/v1/local/personal";
export async function personalRequest(path: string, body?: unknown) {
  const response = await fetch(personalPrefix + path, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const code =
      typeof value === "object" && value && "error" in value
        ? JSON.stringify(value.error)
        : "Personal context could not be loaded.";
    throw Error(code);
  }
  return value;
}
export function usePersonalAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) => personalRequest(path, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["personal"] });
      await client.invalidateQueries({ queryKey: ["local-vault"] });
    },
  });
}
export const requestKey = () => crypto.randomUUID();
