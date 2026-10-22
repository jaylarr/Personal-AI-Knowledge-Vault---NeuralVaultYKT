import {
  z,
  personalContextInputSchema,
  personalCaptureInputSchema,
  personalScanInputSchema,
  personalNextInputSchema,
  personalPageInputSchema,
  personalCompleteInputSchema,
  personalSkillQuerySchema,
} from "@atlas/contracts";
import type { loadMcpConfig } from "./config.js";
export const personalOperations = {
  context: personalContextInputSchema,
  capture: personalCaptureInputSchema,
  "sessions/scan": personalScanInputSchema,
  "sessions/next": personalNextInputSchema,
  "sessions/page": personalPageInputSchema,
  "sessions/complete": personalCompleteInputSchema,
  skills: personalSkillQuerySchema,
};
export type PersonalOperation = keyof typeof personalOperations;
export async function callPersonal(
  config: ReturnType<typeof loadMcpConfig>,
  operation: PersonalOperation,
  input: unknown,
) {
  const body = personalOperations[operation].parse(input),
    headers = { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" };
  const runtime = await fetch(`${config.apiUrl}/api/v1/runtime`, {
    headers,
    signal: AbortSignal.timeout(12000),
    redirect: "error",
    cache: "no-store",
  });
  if (!runtime.ok || z.object({ mode: z.string() }).parse(await runtime.json()).mode !== "local")
    throw Error("Personal memory requires local Markdown mode.");
  const response = await fetch(`${config.apiUrl}/api/v1/agent/personal/${operation}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok) {
    const error = z
      .object({ error: z.object({ code: z.string() }) })
      .safeParse(await response.json());
    throw Error(error.success ? error.data.error.code : "PERSONAL_REQUEST_FAILED");
  }
  return response.json() as Promise<unknown>;
}
