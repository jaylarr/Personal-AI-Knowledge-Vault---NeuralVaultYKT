import { describe, expect, it } from "vitest";
import { categoryColor } from "../../apps/web/src/app/neural/graph-theme.js";
import { curveFrame, type LayoutInput, layoutGraph } from "../../apps/web/src/app/neural/layout.js";
import { QUALITY_PROFILES, resolveDpr } from "../../apps/web/src/app/neural/render-quality.js";

function star(count: number, category: string): LayoutInput {
  const hub = { id: `${category}-hub`, categoryId: category, type: "project", importance: 1 };
  const members = Array.from({ length: count }, (_, i) => ({
    id: `${category}-${i}`,
    categoryId: category,
    type: "note",
    importance: 0.5,
  }));
  return {
    nodes: [hub, ...members],
    edges: members.map((n) => ({
      id: n.id,
      source: n.id,
      target: hub.id,
      type: "part_of",
      directed: true,
      strength: 1,
    })),
  };
}
describe("project volumes and rendering policy", () => {
  for (const count of [32, 200])
    for (const category of ["alpha", "beta", "gamma"]) {
      it(`spreads ${count} ${category} members around their hub`, () => {
        const graph = star(count, category),
          positions = layoutGraph(graph),
          hub = positions[`${category}-hub`];
        if (!hub) throw Error("hub");
        const points = graph.nodes.slice(1).map((n) => {
          const p = positions[n.id];
          if (!p) throw Error("position");
          return p.map((v, k) => v - (hub[k] ?? 0));
        });
        const octants = new Set(points.map((p) => p.map((v) => (v >= 0 ? 1 : 0)).join("")));
        const spans = [0, 1, 2].map(
          (k) =>
            Math.max(...points.map((p) => p[k] ?? 0)) - Math.min(...points.map((p) => p[k] ?? 0)),
        );
        const r = Math.max(7, 2.4 * Math.cbrt(count));
        const centroid = [0, 1, 2].map(
          (k) => points.reduce((s, p) => s + (p[k] ?? 0), 0) / points.length,
        );
        const distances = points.map((p) => Math.hypot(...p)).sort((a, b) => a - b);
        expect(octants.size).toBeGreaterThanOrEqual(5);
        expect(Math.min(...spans) / Math.max(...spans)).toBeGreaterThanOrEqual(0.35);
        expect(Math.hypot(...centroid)).toBeLessThan(0.4 * r);
        expect(distances[Math.floor(count / 2)]).toBeGreaterThanOrEqual(0.55 * r);
        expect(
          layoutGraph({
            ...graph,
            nodes: [...graph.nodes].reverse(),
            edges: [...graph.edges].reverse(),
          }),
        ).toEqual(positions);
      });
    }
  it("keeps both connected projects volumetric", () => {
    const a = star(32, "alpha"),
      b = star(32, "beta");
    const positions = layoutGraph({
      nodes: [...a.nodes, ...b.nodes],
      edges: [
        ...a.edges,
        ...b.edges,
        {
          id: "cross",
          source: "alpha-0",
          target: "beta-0",
          type: "references",
          directed: false,
          strength: 1,
        },
      ],
    });
    for (const graph of [a, b]) {
      const hub = positions[graph.nodes[0]?.id ?? ""];
      if (!hub) throw Error("hub");
      const points = graph.nodes.slice(1).map((n) => {
        const p = positions[n.id];
        if (!p) throw Error("point");
        return p.map((v, k) => v - (hub[k] ?? 0));
      });
      expect(
        new Set(points.map((p) => p.map((v) => (v >= 0 ? 1 : 0)).join(""))).size,
      ).toBeGreaterThanOrEqual(5);
      const spans = [0, 1, 2].map(
        (k) =>
          Math.max(...points.map((p) => p[k] ?? 0)) - Math.min(...points.map((p) => p[k] ?? 0)),
      );
      expect(Math.min(...spans) / Math.max(...spans)).toBeGreaterThanOrEqual(0.35);
      const r = Math.max(7, 2.4 * Math.cbrt(32));
      expect(
        Math.hypot(...[0, 1, 2].map((k) => points.reduce((s, p) => s + (p[k] ?? 0), 0) / 32)),
      ).toBeLessThan(0.4 * r);
      expect(points.map((p) => Math.hypot(...p)).sort((a, b) => a - b)[16]).toBeGreaterThanOrEqual(
        0.55 * r,
      );
    }
  });
  it("preserves existing positions when adding linked members and a category", () => {
    const a = star(32, "alpha"),
      b = star(32, "beta"),
      original = { nodes: [...a.nodes, ...b.nodes], edges: [...a.edges, ...b.edges] };
    const positions = layoutGraph(original),
      extra = star(33, "alpha");
    const next = layoutGraph(
      { nodes: [...extra.nodes, ...b.nodes], edges: [...extra.edges, ...b.edges] },
      positions,
    );
    for (const node of original.nodes) expect(next[node.id]).toEqual(positions[node.id]);
    expect(Object.values(next).flat().every(Number.isFinite)).toBe(true);
    expect(layoutGraph(star(32, "alpha"), positions)).toEqual(
      Object.fromEntries(a.nodes.map((n) => [n.id, positions[n.id]])),
    );
  });
  it("keeps curve basis perpendicular and finite including coincident endpoints", () => {
    for (const b of [
      [2, 3, 8],
      [0, 8, 0],
      [0, 0, 0],
    ] as [number, number, number][]) {
      const frame = curveFrame([0, 0, 0], b, "actual-edge");
      expect(Object.values(frame).flat().every(Number.isFinite)).toBe(true);
      expect(frame.normal.reduce((s, v, k) => s + v * (b[k] ?? 0), 0)).toBeCloseTo(0, 8);
      expect(frame.binormal.reduce((s, v, k) => s + v * (b[k] ?? 0), 0)).toBeCloseTo(0, 8);
    }
  });
  it("bounds DPR and keeps category colors independent of visible ordering", () => {
    expect(resolveDpr("high", 2)).toBe(2);
    expect(resolveDpr("medium", 2)).toBe(1.5);
    expect(resolveDpr("low", 2)).toBe(1);
    expect(resolveDpr("high", NaN)).toBe(1);
    expect(resolveDpr("high", 0.5)).toBe(1);
    expect(resolveDpr("high", 4)).toBe(2);
    expect(QUALITY_PROFILES.high.samples).toBe(4);
    expect(QUALITY_PROFILES.high.edgeSegments).toBe(24);
    expect(categoryColor("alpha")).toBe(categoryColor(["beta", "alpha"].sort()[0] ?? ""));
  });
});
