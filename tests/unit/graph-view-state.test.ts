import { expect, it } from "vitest";
import { parseGraphView } from "../../apps/web/src/app/neural/view-state.js";
import { LAYOUT_REVISION } from "../../apps/web/src/app/neural/layout.js";
it("accepts bounded camera and filter metadata without source bodies", () => {
  const saved = {
    revision: LAYOUT_REVISION,
    hidden: ["Controlled Alpha"],
    type: "memory",
    review: "active",
    evidence: true,
    camera: { position: [10, 12, 30], target: [1, 2, 3] },
  };
  expect(parseGraphView(JSON.stringify(saved))).toEqual(saved);
});
it("falls back safely for corrupt, obsolete, oversized or invalid camera state", () => {
  const fallback = parseGraphView(null);
  const base = { ...fallback, camera: { position: [10, 12, 30], target: [1, 2, 3] } };
  for (const raw of [
    "not JSON",
    "x".repeat(262145),
    JSON.stringify({ ...base, revision: "obsolete" }),
    JSON.stringify({ ...base, camera: { position: [null, 0, 1], target: [0, 0, 0] } }),
    JSON.stringify({ ...base, camera: { position: [0, 0, 0], target: [0, 0, 0] } }),
    JSON.stringify({ ...base, camera: { position: [100001, 0, 0], target: [0, 0, 0] } }),
    JSON.stringify({ ...base, source_body: "Never persist this" }),
  ])
    expect(parseGraphView(raw)).toEqual(fallback);
});
