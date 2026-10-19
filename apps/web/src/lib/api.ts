import { readinessSchema } from "@atlas/contracts";

export async function getReadiness(signal?: AbortSignal) {
  const response = await fetch("/ready", {
    signal: signal ?? null,
    cache: "no-store",
    credentials: "omit",
  });
  if (response.status !== 503) throw new Error("Unexpected setup response");
  return readinessSchema.parse(await response.json());
}
