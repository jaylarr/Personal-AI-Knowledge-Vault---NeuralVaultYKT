import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  LineSegments,
  Mesh,
  Points,
  PointsMaterial,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import type { Pulse, Zap } from "./effects.js";
import { categoryColor, GRAPH_THEME } from "./graph-theme.js";
import { curveFrame, curvePoint, type Layout } from "./layout.js";
import { type GraphIndex, hash, type NeuralGraph, random, type Vec3 } from "./model.js";
import { QUALITY_PROFILES } from "./render-quality.js";
import {
  edgeFragment,
  edgeVertex,
  nodeFragment,
  nodeVertex,
  ribbonFragment,
  ribbonVertex,
} from "./shaders.js";

function attribute(g: BufferGeometry, name: string, array: Float32Array, size = 1) {
  g.setAttribute(name, new BufferAttribute(array, size));
}
function material(vertexShader: string, fragmentShader: string) {
  const uniforms = {
    uTime: { value: 0 },
    uMotion: { value: 1 },
    uDpr: { value: 1 },
    uBrightness: { value: 1 },
    uConnections: { value: 1 },
    uResolution: { value: new Vector2(1, 1) },
    uZap: { value: 0 },
    uPulseIntensity: { value: 1 },
  };
  return new ShaderMaterial({
    vertexShader,
    fragmentShader: fragmentShader.replace(
      /}\s*$/,
      `
#ifdef DIRECT_OUTPUT
#include <tonemapping_fragment>
#include <colorspace_fragment>
#endif
}`,
    ),
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms,
  }) as ShaderMaterial & { uniforms: typeof uniforms };
}
export function edgeNormal(a: Vec3, b: Vec3, seed = "edge"): Vec3 {
  return curveFrame(a, b, seed).normal;
}
export function createScene(
  graph: NeuralGraph,
  index: GraphIndex,
  positions: Layout,
  quality: "high" | "medium" | "low",
) {
  const group = new Group(),
    nodeGeo = new BufferGeometry(),
    edgeGeo = new BufferGeometry();
  const n = graph.nodes.length,
    xyz = new Float32Array(n * 3),
    colors = new Float32Array(n * 3),
    size = new Float32Array(n),
    importance = new Float32Array(n),
    types = new Float32Array(n);
  const nodeIndex = new Map<string, number>(),
    edgeRanges = new Map<string, [number, number]>();
  const colorFor = (id: string) => {
    const node = index.nodes.get(id);
    return new Color(categoryColor(node?.categoryId ?? ""));
  };
  graph.nodes.forEach((node, i) => {
    nodeIndex.set(node.id, i);
    xyz.set(positions[node.id] ?? [0, 0, 0], i * 3);
    const c = colorFor(node.id);
    colors.set([c.r, c.g, c.b], i * 3);
    importance[i] = node.importance;
    types[i] = node.type === "project" ? 1 : 0;
    size[i] = 5 + node.importance * 7;
  });
  attribute(nodeGeo, "position", xyz, 3);
  attribute(nodeGeo, "aColor", colors, 3);
  attribute(nodeGeo, "aSize", size);
  attribute(nodeGeo, "aImportance", importance);
  attribute(nodeGeo, "aNodeType", types);
  attribute(nodeGeo, "aSelectionState", new Float32Array(n));
  attribute(nodeGeo, "aActivity", new Float32Array(n).fill(-100));
  attribute(nodeGeo, "aVisible", new Float32Array(n).fill(1));
  const nodeMat = material(nodeVertex, nodeFragment),
    nodePoints = new Points(nodeGeo, nodeMat);
  nodePoints.frustumCulled = false;
  nodePoints.renderOrder = 3;
  group.add(nodePoints);
  const segments = QUALITY_PROFILES[quality].edgeSegments,
    vertices = graph.edges.length * segments * 2;
  const ep = new Float32Array(vertices * 3),
    ec = new Float32Array(vertices * 3),
    en = new Float32Array(vertices * 3),
    et = new Float32Array(vertices),
    es = new Float32Array(vertices),
    el = new Float32Array(vertices);
  let at = 0;
  for (const edge of graph.edges) {
    const a = positions[edge.source],
      b = positions[edge.target];
    if (!a || !b) continue;
    const normal = edgeNormal(a, b, edge.id),
      c = colorFor(edge.source),
      length = new Vector3(...a).distanceTo(new Vector3(...b));
    const start = at;
    for (let s = 0; s < segments; s++)
      for (const t of [s / segments, (s + 1) / segments]) {
        ep.set(curvePoint(a, b, edge.id, t), at * 3);
        ec.set([c.r, c.g, c.b], at * 3);
        en.set(normal, at * 3);
        et[at] = t;
        es[at] = hash(edge.id) % 1000;
        el[at] = length;
        at++;
      }
    edgeRanges.set(edge.id, [start, at]);
  }
  attribute(edgeGeo, "position", ep, 3);
  attribute(edgeGeo, "aColor", ec, 3);
  attribute(edgeGeo, "aNormal", en, 3);
  attribute(edgeGeo, "aT", et);
  attribute(edgeGeo, "aSeed", es);
  attribute(edgeGeo, "aLength", el);
  attribute(edgeGeo, "aState", new Float32Array(vertices));
  attribute(edgeGeo, "aVisible", new Float32Array(vertices).fill(1));
  const edgeMat = material(edgeVertex, edgeFragment),
    lines = new LineSegments(edgeGeo, edgeMat);
  lines.frustumCulled = false;
  lines.renderOrder = 1;
  group.add(lines);
  const stars = new Float32Array((quality === "low" ? 60 : quality === "medium" ? 150 : 300) * 3);
  for (let i = 0; i < stars.length; i += 3) {
    const theta = random(`star${i}`) * Math.PI * 2,
      z = random(`starZ${i}`) * 2 - 1,
      r = 65 + random(`starR${i}`) * 45;
    stars.set(
      [
        Math.cos(theta) * Math.sqrt(1 - z * z) * r,
        z * r,
        Math.sin(theta) * Math.sqrt(1 - z * z) * r,
      ],
      i,
    );
  }
  const starGeo = new BufferGeometry();
  attribute(starGeo, "position", stars, 3);
  const starMat = new PointsMaterial({
    color: GRAPH_THEME.particle,
    size: 0.055,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const background = new Points(starGeo, starMat);
  background.renderOrder = 0;
  group.add(background);
  const pulse = createRibbon(80, 24, false),
    zap = createRibbon(10, 8, true);
  group.add(pulse.object, zap.object);
  const materials = [nodeMat, edgeMat, pulse.material, zap.material];
  if (quality === "low") for (const m of materials) m.defines.DIRECT_OUTPUT = 1;
  return {
    group,
    nodeGeo,
    edgeGeo,
    nodeIndex,
    edgeRanges,
    materials,
    pulse,
    zap,
    colorFor,
    dispose: () => {
      for (const g of [nodeGeo, edgeGeo, starGeo, pulse.geometry, zap.geometry]) g.dispose();
      for (const m of [...materials, starMat]) m.dispose();
      group.clear();
    },
  };
}

function createRibbon(capacity: number, segments: number, zap: boolean) {
  const geometry = new BufferGeometry(),
    count = capacity * (segments + (zap ? 2 : 0)) * 6;
  for (const name of ["position", "aNext", "aColor", "aNormal"])
    attribute(geometry, name, new Float32Array(count * 3), 3);
  for (const name of [
    "aSide",
    "aT",
    "aStart",
    "aDuration",
    "aReverse",
    "aIntensity",
    "aSeed",
    "aLength",
  ])
    attribute(geometry, name, new Float32Array(count));
  geometry.setDrawRange(0, 0);
  const shader = material(ribbonVertex, ribbonFragment);
  shader.uniforms.uZap.value = zap ? 1 : 0;
  // Raw triangles form thin screen-space ribbons; glLineWidth is never relied on.
  const object = new Mesh(geometry, shader);
  object.frustumCulled = false;
  object.renderOrder = zap ? 5 : 4;
  return { geometry, material: shader, object, capacity, segments };
}

export function fillRibbons(
  batch: ReturnType<typeof createRibbon>,
  events: (Pulse | Zap)[],
  index: GraphIndex,
  positions: Layout,
  colorFor: (id: string) => Color,
  zap: boolean,
  branches: boolean,
) {
  let cursor = 0;
  for (const event of events.slice(0, batch.capacity)) {
    const edge = index.edges.get(event.edgeId);
    if (!edge) continue;
    const a = positions[edge.source],
      b = positions[edge.target];
    if (!a || !b) continue;
    const normal = edgeNormal(a, b, edge.id),
      length = new Vector3(...a).distanceTo(new Vector3(...b)),
      color = colorFor("sourceId" in event ? event.sourceId : edge.source);
    const pulse = "duration" in event ? event : null;
    for (let s = 0; s < batch.segments + (zap && branches ? 2 : 0); s++) {
      const branch = s >= batch.segments;
      const t0 = branch ? 0.58 : s / batch.segments,
        t1 = branch ? 0.64 : (s + 1) / batch.segments;
      const point = (t: number) => {
        const p = curvePoint(a, b, edge.id, t);
        if (zap) {
          const jitter =
            Math.sin(t * Math.PI) *
            (random(`${edge.id}:${event.eventId}:${t}`) - 0.5) *
            Math.min(length * 0.08, 0.65);
          p[0] += normal[0] * jitter;
          p[1] += normal[1] * jitter;
          p[2] += normal[2] * jitter;
        }
        return p;
      };
      const p0 = point(t0),
        p1 = point(t1);
      if (branch) {
        const step = s - batch.segments;
        const amplitude = Math.min(length * 0.05, 0.7);
        for (let axis = 0; axis < 3; axis++) {
          p0[axis] = (p0[axis] ?? 0) + (normal[axis] ?? 0) * amplitude * step * 0.5;
          p1[axis] = (p1[axis] ?? 0) + (normal[axis] ?? 0) * amplitude * (step + 1) * 0.5;
        }
      }
      for (const [t, side] of [
        [t0, -1],
        [t0, 1],
        [t1, 1],
        [t0, -1],
        [t1, 1],
        [t1, -1],
      ] as const) {
        const start = t === t0;
        const p = start ? p0 : p1;
        const next = start
          ? p1
          : [p1[0] + p1[0] - p0[0], p1[1] + p1[1] - p0[1], p1[2] + p1[2] - p0[2]];
        for (const [name, v] of [
          ["position", p],
          ["aNext", next],
          ["aColor", [color.r, color.g, color.b]],
          ["aNormal", normal],
        ] as const)
          (batch.geometry.getAttribute(name).array as Float32Array).set(v, cursor * 3);
        for (const [name, value] of Object.entries({
          aT: t,
          aSide: side,
          aStart: event.startTime,
          aDuration: pulse?.duration ?? 0.16,
          aReverse: pulse?.reverse ? 1 : 0,
          aIntensity: pulse?.intensity ?? (branches ? 1 : 0.8),
          aSeed: hash(edge.id) % 1000,
          aLength: length,
        }))
          (batch.geometry.getAttribute(name).array as Float32Array)[cursor] = value ?? 0;
        cursor++;
      }
    }
  }
  batch.geometry.setDrawRange(0, cursor);
  for (const attr of Object.values(batch.geometry.attributes)) attr.needsUpdate = true;
}
