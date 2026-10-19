import { z } from "@atlas/contracts";
import { LAYOUT_REVISION } from "./layout.js";
const vector = z
  .tuple([z.number().finite(), z.number().finite(), z.number().finite()])
  .refine((v) => v.every((n) => Math.abs(n) <= 100000));
export const graphViewSchema = z
  .object({
    revision: z.literal(LAYOUT_REVISION),
    hidden: z.array(z.string().max(200)).max(1000),
    type: z.string().max(100),
    review: z.enum(["all", "active", "proposed", "stale", "agent_recorded"]),
    evidence: z.boolean(),
    camera: z
      .object({ position: vector, target: vector })
      .refine((c) => Math.hypot(...c.position.map((n, i) => n - c.target[i]!)) >= 4)
      .optional(),
  })
  .strict();
export type GraphView = z.infer<typeof graphViewSchema>;
export function parseGraphView(raw: string | null): GraphView {
  try {
    if (!raw || raw.length > 262144) throw Error("View limit");
    return graphViewSchema.parse(JSON.parse(raw));
  } catch {
    return { revision: LAYOUT_REVISION, hidden: [], type: "all", review: "all", evidence: false };
  }
}
