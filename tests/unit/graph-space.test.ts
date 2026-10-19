import { describe, expect, it } from "vitest";
import {
  graphLayout,
  frameScale,
  homeCamera,
  project,
  rotate,
  type Snapshot,
} from "../../apps/web/src/app/graph-space.js";

const note = (id: string, kind: string, project_id: string | null = null) =>
  ({ id, kind, project_id }) as Snapshot["notes"][number];

describe("3D graph geometry", () => {
  it("uses a deterministic bounded 3D volume regardless of file scan order", () => {
    const notes = [
      note("a", "project"),
      note("b", "project"),
      ...Array.from({ length: 298 }, (_, i) => note(`note-${i}`, "lesson", i % 2 ? "a" : "b")),
    ];
    const layout = graphLayout(notes),
      reversed = graphLayout([...notes].reverse());
    expect(layout.size).toBe(300);
    expect([...layout.keys()].sort()).toEqual([...reversed.keys()].sort());
    for (const [id, p] of layout) {
      expect(p).toEqual(reversed.get(id));
      expect(Math.hypot(p.x, p.y, p.z)).toBeLessThanOrEqual(235.00001);
    }
    expect(new Set([...layout.values()].map((p) => p.z.toFixed(2))).size).toBeGreaterThan(100);
  });
  it("handles empty, single-file and orphaned-note vaults without invalid coordinates", () => {
    expect(graphLayout([]).size).toBe(0);
    for (const notes of [[note("only", "project")], [note("orphan", "lesson", "absent")]]) {
      for (const p of graphLayout(notes).values()) {
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
      }
    }
  });
  it("preserves 3D distance when orbiting and applies perspective depth", () => {
    const p = { x: 90, y: 40, z: 180 };
    expect(Math.hypot(...Object.values(rotate(p, homeCamera)))).toBeCloseTo(
      Math.hypot(...Object.values(p)),
    );
    const front = project({ x: 50, y: 0, z: 180 }, { ...homeCamera, yaw: 0, pitch: 0 }, 1000, 500);
    const back = project({ x: 50, y: 0, z: -180 }, { ...homeCamera, yaw: 0, pitch: 0 }, 1000, 500);
    expect(front.scale).toBeGreaterThan(back.scale);
    expect(front.x - 500).toBeGreaterThan(back.x - 500);
  });
  it("keeps reset-view centers within narrow and wide canvases at every orbit angle", () => {
    const layout = graphLayout([
      note("a", "project"),
      ...Array.from({ length: 20 }, (_, i) => note(`n-${i}`, "progress", "a")),
    ]);
    for (const width of [250, 320, 900, 1400]) {
      for (const yaw of [-Math.PI, -1, 0, 1, Math.PI]) {
        for (const p of layout.values()) {
          const camera = { ...homeCamera, yaw };
          const fit = frameScale(layout.values(), camera, width, 490);
          const screen = project(p, camera, width, 490, fit);
          expect(screen.x).toBeGreaterThan(0);
          expect(screen.x).toBeLessThan(width);
          expect(screen.y).toBeGreaterThan(0);
          expect(screen.y).toBeLessThan(490);
        }
      }
    }
  });
  it("keeps framing constant during orbit, including views from beneath the graph", () => {
    const layout = graphLayout([
      note("hub", "project"),
      ...Array.from({ length: 12 }, (_, i) => note(`n${i}`, "lesson", "hub")),
    ]);
    const initialFit = frameScale(layout.values(), homeCamera, 900, 600);
    for (const yaw of [-6, -3, 0, 3, 6])
      for (const pitch of [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
        const camera = { ...homeCamera, yaw, pitch };
        expect(frameScale(layout.values(), camera, 900, 600)).toBe(initialFit);
        for (const point of layout.values()) {
          const projected = project(point, camera, 900, 600, initialFit);
          expect(projected.x).toBeGreaterThan(0);
          expect(projected.x).toBeLessThan(900);
          expect(projected.y).toBeGreaterThan(0);
          expect(projected.y).toBeLessThan(600);
        }
      }
  });
});
