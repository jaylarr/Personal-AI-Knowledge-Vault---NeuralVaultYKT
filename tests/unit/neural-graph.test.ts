import { describe, expect, it } from "vitest";
import { createScene, fillRibbons } from "../../apps/web/src/app/neural/geometry.js";
import { PulseScheduler, propagation, zapEnvelope } from "../../apps/web/src/app/neural/effects.js";
import { bounds, curvePoint, layoutGraph } from "../../apps/web/src/app/neural/layout.js";
import { sampleGraph, searchNodes, validateGraph } from "../../apps/web/src/app/neural/model.js";

describe("neural graph model and stable geometry", () => {
  it("validates duplicate IDs, missing endpoints, invalid strength and directed indexes", () => {
    const g = sampleGraph(30, 45);
    const e = g.edges[0];
    if (!e) throw Error("fixture");
    g.nodes.push(required(g.nodes[0]));
    g.edges.push(
      { ...e, id: "missing", target: "absent" },
      { ...e, id: "invalid", strength: 2 },
      e,
    );
    const { graph, index } = validateGraph(g);
    expect(graph.nodes).toHaveLength(30);
    expect(index.warnings).toHaveLength(4);
    expect(index.isolated).toBeGreaterThanOrEqual(2);
    expect(index.components).toBeGreaterThan(1);
    const directed = { ...e, id: "directed", directed: true };
    const v = validateGraph({ ...g, edges: [directed] });
    expect(v.index.adjacency.get(e.target)).toEqual([]);
    expect(v.index.adjacency.get(e.source)).toHaveLength(1);
  });
  it("deduplicates only matching semantics, retaining opposite directed relationships", () => {
    const g = sampleGraph(20, 25);
    const e = required(g.edges[0]);
    g.edges = [
      { ...e, directed: true },
      { ...e, id: "duplicate", directed: true },
      { ...e, id: "opposite", directed: true, source: e.target, target: e.source },
      { ...e, id: "different", type: "supports", directed: true },
    ];
    expect(validateGraph(g).graph.edges).toHaveLength(3);
  });
  it("keeps seeded positions stable through order, selection and incremental additions", () => {
    const g = sampleGraph(100, 200),
      p = layoutGraph(g),
      reversed = layoutGraph({ ...g, nodes: [...g.nodes].reverse() });
    expect(p).toEqual(reversed);
    expect(new Set(Object.values(p).map((p) => p[2].toFixed(2))).size).toBeGreaterThan(80);
    const bigger = sampleGraph(105, 210),
      next = layoutGraph(bigger, p);
    for (const id of Object.keys(p)) expect(next[id]).toEqual(p[id]);
    expect(bounds(p).radius).toBeGreaterThan(4);
  });
  it("has exact curve anchors and finite empty/single layouts", () => {
    const a: [number, number, number] = [1, 2, 3],
      b: [number, number, number] = [8, 2, -4];
    expect(curvePoint(a, b, "edge", 0)).toEqual(a);
    expect(curvePoint(a, b, "edge", 1)).toEqual(b);
    expect(layoutGraph({ nodes: [], edges: [] })).toEqual({});
    expect(Number.isFinite(bounds(layoutGraph(sampleGraph(1, 0))).radius)).toBe(true);
  });
  it("searches titles, summaries and tags without altering graph", () => {
    const g = sampleGraph();
    expect(searchNodes(g.nodes, "engineering 1").length).toBeGreaterThan(0);
    expect(searchNodes(g.nodes, "synthetic sample")).toHaveLength(300);
    expect(searchNodes(g.nodes, "absent")).toEqual([]);
    expect(g.nodes).toHaveLength(300);
  });
});
describe("bounded real relationship effects", () => {
  const make = () => {
    const g = sampleGraph(10, 0);
    g.edges = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      source: `sample-${i}`,
      target: `sample-${(i + 1) % 10}`,
      type: "references" as const,
      directed: true,
      strength: 1,
      confidence: null,
      provenance: "imported" as const,
      review: "unknown" as const,
      origin: "test",
    }));
    return validateGraph(g);
  };
  it("respects direction/depth/cycles and schedules child after parent arrival", () => {
    const { graph, index } = make(),
      p = layoutGraph(graph);
    const events = propagation(index, p, "sample-0", 0, 1, 2);
    expect(events.map((e) => e.targetId)).toEqual(["sample-1", "sample-2"]);
    expect(required(events[1]).startTime).toBeGreaterThan(required(events[0]).duration);
    expect(propagation(index, p, "sample-0", 0, 1, 20)).toHaveLength(3);
    expect(new Set(events.map((e) => e.edgeId)).size).toBe(events.length);
  });
  it("replaces prior events, pauses clock/arrivals and bounds rapid zaps", () => {
    const { graph, index } = make(),
      p = layoutGraph(graph),
      s = new PulseScheduler();
    s.trigger(index, p, "sample-0");
    s.advance(0.1, true, true);
    expect(s.time).toBe(0);
    s.advance(0.1, false, true);
    expect(s.zaps).toHaveLength(1);
    s.trigger(index, p, "sample-4");
    expect(required(s.pulses[0]).sourceId).toBe("sample-4");
    expect(s.arrivals.has("sample-0")).toBe(false);
    for (let i = 0; i < 200; i++) {
      s.trigger(index, p, `sample-${i % 10}`, 3);
      s.advance(0.02, false, true, 3);
      expect(s.pulses.length).toBeLessThanOrEqual(80);
      expect(s.zaps.length).toBeLessThanOrEqual(3);
    }
    s.clear();
    expect(s.active).toBe(false);
  });
  it("provides short attack, sustain and fade without random flicker", () => {
    expect(zapEnvelope(0)).toBe(0);
    expect(zapEnvelope(0.01)).toBeCloseTo(0.5);
    expect(zapEnvelope(0.06)).toBe(1);
    expect(zapEnvelope(0.12)).toBeCloseTo(0.5);
    expect(zapEnvelope(0.2)).toBe(0);
  });
});

describe("GPU geometry contracts", () => {
  it("batches points and emits explicit segment pairs with anchored ends", () => {
    const { graph, index } = validateGraph(sampleGraph(100, 200)),
      positions = layoutGraph(graph),
      scene = createScene(graph, index, positions, "high");
    expect(scene.nodeGeo.getAttribute("position").count).toBe(100);
    expect(scene.edgeGeo.getAttribute("position").count).toBe(graph.edges.length * 24 * 2);
    for (const e of graph.edges) {
      const range = scene.edgeRanges.get(e.id);
      if (!range) throw Error("Missing edge");
      const t = scene.edgeGeo.getAttribute("aT"),
        p = scene.edgeGeo.getAttribute("position");
      expect(t.getX(range[0])).toBe(0);
      expect(t.getX(range[1] - 1)).toBe(1);
      for (let i = range[0]; i < range[1]; i += 2) expect(t.getX(i + 1)).toBeGreaterThan(t.getX(i));
      const a = positions[e.source],
        b = positions[e.target];
      if (!a || !b) throw Error("position");
      expect(p.getX(range[0])).toBeCloseTo(a[0], 5);
      expect(p.getZ(range[1] - 1)).toBeCloseTo(b[2], 5);
    }
    scene.dispose();
    expect(scene.group.children).toHaveLength(0);
  });
  it("reuses bounded pulse/zap buffers, including optional branches", () => {
    const { graph, index } = validateGraph(sampleGraph(100, 200)),
      positions = layoutGraph(graph),
      scene = createScene(graph, index, positions, "high"),
      scheduler = new PulseScheduler();
    scheduler.trigger(index, positions, "sample-15", 3);
    const pulseArray = scene.pulse.geometry.getAttribute("position").array,
      zapArray = scene.zap.geometry.getAttribute("position").array;
    fillRibbons(scene.pulse, scheduler.pulses, index, positions, scene.colorFor, false, false);
    const zaps = graph.edges.slice(0, 20).map((e) => ({ edgeId: e.id, startTime: 0, eventId: 1 }));
    fillRibbons(scene.zap, zaps, index, positions, scene.colorFor, true, true);
    expect(scene.pulse.geometry.drawRange.count).toBeLessThanOrEqual(80 * 24 * 6);
    expect(scene.zap.geometry.drawRange.count).toBe(10 * 10 * 6);
    fillRibbons(scene.zap, [], index, positions, scene.colorFor, true, false);
    expect(scene.zap.geometry.drawRange.count).toBe(0);
    expect(scene.pulse.geometry.getAttribute("position").array).toBe(pulseArray);
    expect(scene.zap.geometry.getAttribute("position").array).toBe(zapArray);
    scene.dispose();
  });
});

function required<T>(value: T | undefined): T {
  if (value === undefined) throw Error("Missing fixture value");
  return value;
}
