import { type NeuralEdge, type NeuralNode, random, type Vec3 } from "./model.js";
export type Layout = Record<string, Vec3>;
export type LayoutNode = Pick<NeuralNode, "id" | "categoryId" | "importance" | "type"> & {
  position?: Vec3;
};
export type LayoutInput = {
  nodes: LayoutNode[];
  edges: Pick<NeuralEdge, "id" | "source" | "target" | "type" | "directed" | "strength">[];
};
export const LAYOUT_REVISION = "project-volume-v2";
export type LayoutCache = { revision: string; positions: Layout };
function required<T>(value: T | undefined): T {
  if (value === undefined) throw Error("Missing layout coordinate");
  return value;
}
const finite = (p: Vec3 | undefined): p is Vec3 =>
  Boolean(p && p.length === 3 && p.every(Number.isFinite));
function sphere(i: number, count: number, seed: string): Vec3 {
  const y = 1 - (2 * (i + 0.5)) / count,
    angle = i * 2.399963229728653 + random(`${seed}:yaw`) * Math.PI * 2;
  const x = Math.sqrt(1 - y * y) * Math.cos(angle),
    z = Math.sqrt(1 - y * y) * Math.sin(angle);
  const pitch = (random(`${seed}:pitch`) - 0.5) * Math.PI;
  return [x, y * Math.cos(pitch) - z * Math.sin(pitch), y * Math.sin(pitch) + z * Math.cos(pitch)];
}
// Bounded settling around stable volumetric anchors, never a live simulation.
export function layoutGraph(graph: LayoutInput, prior: Layout = {}): Layout {
  const nodes = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const edges = [...graph.edges].sort((a, b) => a.id.localeCompare(b.id));
  const categories = [...new Set(nodes.map((n) => n.categoryId))].sort();
  const groups = categories.map((id) => ({
    id,
    members: nodes.filter((n) => n.categoryId === id),
  }));
  const radii = new Map(
    groups.map((g) => [g.id, Math.max(7, 2.4 * Math.cbrt(Math.max(1, g.members.length - 1)))]),
  );
  const anchorRadius = (Math.max(7, ...radii.values()) + 4) * Math.cbrt(categories.length);
  const positions: Layout = {},
    preferred: Layout = {},
    centers = new Map<string, Vec3>(),
    hubs = new Map<string, string>(),
    fixed = new Set<string>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const neighborsById = new Map<string, string[]>();
  for (const e of edges) {
    for (const [a, b] of [
      [e.source, e.target],
      [e.target, e.source],
    ]) {
      if (!a || !b) continue;
      const neighbors = neighborsById.get(a) ?? [];
      neighbors.push(b);
      neighborsById.set(a, neighbors);
    }
  }
  for (const [i, g] of groups.entries()) {
    const direction = sphere(i, groups.length, "category-volume");
    const hub = g.members.find((n) => n.type === "project");
    const members = g.members.filter((n) => n !== hub),
      r = radii.get(g.id) ?? 7;
    const established = g.members.filter((n) => finite(prior[n.id]) || finite(n.position));
    const center: Vec3 =
      groups.length === 1 ? [0, 0, 0] : (direction.map((v) => v * anchorRadius) as Vec3);
    if (hub) {
      hubs.set(g.id, hub.id);
      const previous = finite(prior[hub.id]) ? prior[hub.id] : hub.position;
      if (finite(previous)) center.splice(0, 3, ...previous);
      positions[hub.id] = [...center];
      preferred[hub.id] = [...center];
      fixed.add(hub.id);
    } else if (established.length) {
      for (let axis = 0; axis < 3; axis++)
        center[axis] =
          established.reduce((sum, n) => sum + ((prior[n.id] ?? n.position)?.[axis] ?? 0), 0) /
          established.length;
    }
    centers.set(g.id, center);
    members.forEach((n, j) => {
      const d = sphere(j, members.length, g.id),
        distance = r * (0.65 + 0.35 * Math.cbrt(random(`${n.id}:radius`)));
      const anchor = d.map(
        (v, k) => (center[k] ?? 0) + v * distance + (random(`${n.id}:offset${k}`) - 0.5) * r * 0.08,
      ) as Vec3;
      preferred[n.id] = anchor;
      const previous = finite(prior[n.id]) ? prior[n.id] : n.position;
      if (finite(previous)) {
        positions[n.id] = [...previous];
        fixed.add(n.id);
      } else {
        const neighbors = (neighborsById.get(n.id) ?? []).filter(
          (id) => byId.get(id)?.categoryId === g.id && finite(prior[id]),
        );
        if (established.length && neighbors.length) {
          const p = anchor.map(
            (_, k) =>
              neighbors.reduce((s, id) => s + (prior[id]?.[k] ?? 0), 0) / neighbors.length +
              required(d[k]) * r * 0.35,
          ) as Vec3;
          const length = Math.hypot(...p.map((v, k) => v - required(center[k])));
          positions[n.id] = p.map(
            (v, k) =>
              required(center[k]) +
              (v - required(center[k])) * Math.min(1, r / Math.max(0.001, length)),
          ) as Vec3;
          preferred[n.id] = [...required(positions[n.id])];
        } else positions[n.id] = [...anchor];
      }
    });
  }
  const rests = new Map(
    edges.map((e) => {
      const a = positions[e.source],
        b = positions[e.target],
        source = byId.get(e.source),
        target = byId.get(e.target);
      const distance = a && b ? Math.hypot(...a.map((v, k) => v - required(b[k]))) : 0;
      const r = radii.get(source?.categoryId ?? "") ?? 7,
        same = source?.categoryId === target?.categoryId;
      return [
        e.id,
        {
          rest:
            e.type === "part_of" && same
              ? Math.max(0.6 * r, Math.min(1.1 * r, distance))
              : same
                ? Math.max(5, 0.8 * r)
                : Math.max(8, 0.85 * distance),
          coefficient: same ? 0.004 : 0.002,
        },
      ];
    }),
  );
  const steps = nodes.length > 1500 ? 18 : nodes.length > 400 ? 36 : 65;
  for (let step = 0; step < steps; step++) {
    const cells = new Map<string, string[]>(),
      delta: Layout = {};
    const cell = (p: Vec3) => p.map((v) => Math.floor(v / 2));
    for (const n of nodes) {
      const p = required(positions[n.id]);
      const key = cell(p).join(",");
      const bucket = cells.get(key) ?? [];
      bucket.push(n.id);
      cells.set(key, bucket);
      delta[n.id] = [0, 0, 0];
    }
    for (const n of nodes) {
      if (fixed.has(n.id)) continue;
      const p = required(positions[n.id]),
        d = required(delta[n.id]),
        anchor = required(preferred[n.id]);
      for (let k = 0; k < 3; k++) d[k] = (required(anchor[k]) - required(p[k])) * 0.025;
      const [x = 0, y = 0, z = 0] = cell(p);
      let examined = 0;
      neighborhood: for (const a of [0, -1, 1])
        for (const b of [0, -1, 1])
          for (const c of [0, -1, 1]) {
            const bucket = cells.get(`${x + a},${y + b},${z + c}`) ?? [];
            for (let j = 0; j < Math.min(12, bucket.length); j++) {
              if (examined++ >= 24) break neighborhood;
              const id = bucket[(j + step * 7) % bucket.length];
              if (!id || id === n.id) continue;
              const q = required(positions[id]),
                v = p.map((value, k) => value - required(q[k])) as Vec3,
                distance = Math.hypot(...v),
                minimum = n.importance > 0.8 ? 2.2 : 1.25;
              if (distance > 1e-5 && distance < minimum)
                for (let k = 0; k < 3; k++)
                  d[k] =
                    required(d[k]) + ((required(v[k]) * (minimum - distance)) / distance) * 0.12;
            }
          }
    }
    for (const e of edges) {
      const a = positions[e.source],
        b = positions[e.target],
        rest = rests.get(e.id);
      if (!a || !b || !rest) continue;
      const length = Math.hypot(...a.map((v, k) => v - required(b[k])));
      const f = Math.max(
        -0.015,
        Math.min(
          0.015,
          ((length - rest.rest) / Math.max(1, length)) * rest.coefficient * e.strength,
        ),
      );
      for (let k = 0; k < 3; k++) {
        const v = (required(b[k]) - required(a[k])) * f;
        if (!fixed.has(e.source))
          required(delta[e.source])[k] = required(required(delta[e.source])[k]) + v;
        if (!fixed.has(e.target))
          required(delta[e.target])[k] = required(required(delta[e.target])[k]) - v;
      }
    }
    for (const n of nodes) {
      if (fixed.has(n.id)) continue;
      const p = required(positions[n.id]),
        d = required(delta[n.id]),
        scale = Math.min(1, 0.25 / Math.max(0.001, Math.hypot(...d)));
      for (let k = 0; k < 3; k++) p[k] = required(p[k]) + required(d[k]) * scale;
      if (hubs.has(n.categoryId)) {
        const center = required(centers.get(n.categoryId)),
          r = required(radii.get(n.categoryId)),
          vector = p.map((v, k) => v - required(center[k])) as Vec3,
          length = Math.hypot(...vector);
        if (length < 0.45 * r) {
          const direction = length > 1e-6 ? vector.map((v) => v / length) : sphere(0, 1, n.id);
          for (let k = 0; k < 3; k++)
            p[k] = required(center[k]) + required(direction[k]) * 0.45 * r;
        }
      }
    }
  }
  return positions;
}
export function bounds(positions: Layout) {
  const points = Object.values(positions);
  if (!points.length) return { center: [0, 0, 0] as Vec3, radius: 10 };
  const center = points.reduce<Vec3>(
    (s, p) => s.map((v, k) => v + required(p[k]) / points.length) as Vec3,
    [0, 0, 0],
  );
  return {
    center,
    radius:
      Math.max(4, ...points.map((p) => Math.hypot(...p.map((v, k) => v - required(center[k]))))) +
      1.5,
  };
}
export function curveFrame(
  a: Vec3,
  b: Vec3,
  seed: string,
): { normal: Vec3; binormal: Vec3; length: number } {
  const d = b.map((v, k) => v - required(a[k])) as Vec3,
    length = Math.hypot(...d);
  if (length < 1e-6) return { normal: [1, 0, 0], binormal: [0, 1, 0], length: 0 };
  const direction = d.map((v) => v / length) as Vec3;
  const cross = (u: Vec3, v: Vec3): Vec3 => [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const raw = cross(direction, Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  const norm = Math.hypot(...raw),
    n = raw.map((v) => v / norm) as Vec3,
    bn = cross(direction, n),
    angle = random(`${seed}:bend`) * Math.PI * 2;
  return {
    normal: n.map((v, k) => v * Math.cos(angle) + required(bn[k]) * Math.sin(angle)) as Vec3,
    binormal: n.map((v, k) => -v * Math.sin(angle) + required(bn[k]) * Math.cos(angle)) as Vec3,
    length,
  };
}
export function curvePoint(a: Vec3, b: Vec3, seed: string, t: number): Vec3 {
  if (t === 0) return [...a];
  if (t === 1) return [...b];
  const { normal, binormal, length } = curveFrame(a, b, seed);
  const main = Math.sin(Math.PI * t) * length * (0.025 + 0.035 * random(seed));
  const secondary = Math.sin(2 * Math.PI * t + random(`${seed}:phase`) * Math.PI * 2) * 0.25 * main;
  return a.map(
    (v, k) =>
      v + (required(b[k]) - v) * t + required(normal[k]) * main + required(binormal[k]) * secondary,
  ) as Vec3;
}
