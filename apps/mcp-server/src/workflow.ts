import {
  z,
  checkpointInputSchema,
  checkpointSchema,
  contextInputSchema,
  projectContextSchema,
  localContextSchema,
  localNoteSchema,
  localCheckpointInputSchema,
  localContextInputSchema,
  type LocalCheckpointInput,
} from "@atlas/contracts";
import type { loadMcpConfig } from "./config.js";
import { identifyRepository } from "./repository.js";
export function createWorkflow(config: ReturnType<typeof loadMcpConfig>) {
  async function runtimeMode() {
    const response = await fetch(`${config.apiUrl}/api/v1/runtime`, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(12000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) throw Error("ATLAS runtime could not be identified");
    return z.object({ mode: z.enum(["local", "cloud"]) }).parse(await response.json()).mode;
  }
  async function post(path: string, body: unknown) {
    let response: Response;
    try {
      response = await fetch(`${config.apiUrl}/api/v1/agent${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12000),
        redirect: "error",
        cache: "no-store",
      });
    } catch {
      throw Error(
        "ATLAS is unavailable. Keep a secret-free local pending checkpoint and retry later; do not claim it was saved.",
      );
    }
    if (!response.ok)
      throw Error(
        `ATLAS HTTP ${response.status}: ${response.status === 403 ? "credential or project permission denied" : response.status === 409 ? "knowledge version or request conflict; reload current context" : response.status === 400 ? "invalid input or sensitive content detected" : "request failed"}.`,
      );
    return response.json() as Promise<unknown>;
  }
  async function project(repository_path: string) {
    const identity = await identifyRepository(repository_path);
    return projectContextSchema.shape.project.parse(
      await post("/projects/ensure", {
        repository_digest: identity.repository_digest,
        name: identity.name,
      }),
    );
  }
  return {
    async start(repository_path: string) {
      const p = await project(repository_path);
      return projectContextSchema
        .or(localContextSchema)
        .parse(await post(`/projects/${p.id}/context`, {}));
    },
    async context(repository_path: string, input: unknown) {
      const mode = await runtimeMode(),
        v = localContextInputSchema.parse(input),
        p = await project(repository_path);
      if (mode === "cloud" && v.context_mode === "activity")
        throw Error("Activity selection requires local mode");
      const payload =
        mode === "local"
          ? v
          : contextInputSchema.parse({
              query: v.query,
              limit: v.limit,
              character_budget: v.character_budget,
            });
      return projectContextSchema
        .or(localContextSchema)
        .parse(await post(`/projects/${p.id}/context`, payload));
    },
    async save(repository_path: string, input: LocalCheckpointInput) {
      const mode = await runtimeMode(),
        local = localCheckpointInputSchema.parse(input);
      if (mode === "cloud" && local.knowledge)
        throw Error("Durable knowledge capture requires local mode");
      const v = mode === "local" ? local : checkpointInputSchema.parse(input),
        p = await project(repository_path);
      return checkpointSchema
        .or(localNoteSchema)
        .parse(await post(`/projects/${p.id}/checkpoints`, v));
    },
  };
}
