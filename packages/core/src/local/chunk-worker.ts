import { parentPort, workerData } from "node:worker_threads";
import { z } from "@atlas/contracts";
import { chunkText } from "./sources.js";
const v = z
  .object({
    sourceId: z.string(),
    versionId: z.string(),
    text: z.string().max(2097152),
    pipeline: z.string().optional(),
  })
  .strict()
  .parse(workerData);
parentPort?.postMessage(chunkText(v.sourceId, v.versionId, v.text, v.pipeline));
