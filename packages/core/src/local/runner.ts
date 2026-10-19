import { Worker } from "node:worker_threads";
import { z, localChunkSchema, type LocalChunk } from "@atlas/contracts";
import type { LocalStore } from "./transactions.js";

export function workerChunks(
  sourceId: string,
  versionId: string,
  text: string,
  pipeline?: string,
): Promise<LocalChunk[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./chunk-worker.js", import.meta.url), {
      workerData: { sourceId, versionId, text, pipeline },
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error("PARSER_TIMEOUT"));
    }, 30000);
    worker.once("message", (v: unknown) => {
      clearTimeout(timer);
      void worker.terminate();
      try {
        resolve(z.array(localChunkSchema).parse(v));
      } catch (e) {
        reject(e);
      }
    });
    worker.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    worker.once("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error("PARSER_EXIT"));
    });
  });
}
export function createRunner(store: LocalStore, run: (id: string) => Promise<unknown>) {
  let running = false,
    closed = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  const errors: string[] = [];
  async function drain() {
    if (running || closed) return;
    running = true;
    try {
      for (let i = 0; i < 100 && !closed; i++) {
        const c = await store.catalog();
        if (c.incomplete) break;
        const job = [...c.heads.values()].find(
          (r) =>
            r.kind === "job" &&
            ((r.data.state === "queued" && Date.parse(String(r.data.available_at)) <= Date.now()) ||
              (r.data.state === "running" &&
                Date.parse(String(r.data.lease_expires_at)) <= Date.now())),
        );
        if (!job) break;
        try {
          await run(job.entity_id);
        } catch {
          errors.push("Deterministic job failed; original retained");
          if (errors.length > 20) errors.shift();
        }
      }
    } catch {
      errors.push("Local queue unavailable; pending work preserved");
    } finally {
      if (!closed) {
        const c = await store.catalog().catch(() => null);
        const pending =
          c &&
          [...c.heads.values()].filter(
            (r) => r.kind === "job" && ["queued", "running"].includes(String(r.data.state)),
          );
        if (!closed && pending?.length) {
          const next = Math.max(
            50,
            Math.min(
              ...pending.map(
                (r) =>
                  Date.parse(
                    String(
                      r.data.state === "running" ? r.data.lease_expires_at : r.data.available_at,
                    ),
                  ) - Date.now(),
              ),
            ),
          );
          timer = setTimeout(() => void drain(), next);
          timer.unref();
        }
      }
      running = false;
    }
  }
  function wake() {
    if (timer) clearTimeout(timer);
    void drain();
  }
  return {
    wake,
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
    },
    status: () => ({ running, errors: [...errors] }),
  };
}
