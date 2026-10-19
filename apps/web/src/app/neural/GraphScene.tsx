import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Vector3 } from "three";
import { PulseScheduler } from "./effects.js";
import { GraphPostProcessing } from "./GraphPostProcessing.js";
import { createScene, fillRibbons } from "./geometry.js";
import type { Layout } from "./layout.js";
import type { GraphIndex, NeuralGraph } from "./model.js";

export type GraphSettings = {
  brightness: number;
  connections: number;
  bloom: number;
  speed: number;
  pulse: number;
  zaps: boolean;
  autoRotate: boolean;
  reduced: boolean;
  quality: "auto" | "high" | "medium" | "low";
  depth: number;
};
export const defaultSettings: GraphSettings = {
  brightness: 1,
  connections: 1,
  bloom: 0.65,
  speed: 1,
  pulse: 1,
  zaps: true,
  autoRotate: false,
  reduced: false,
  quality: "auto",
  depth: 2,
};
export type SceneStats = {
  fps: number;
  calls: number;
  geometries: number;
  textures: number;
  programs: number;
  activePulses: number;
  activeZaps: number;
  renderer: string;
};

export function GraphScene({
  graph,
  index,
  positions,
  selected,
  hovered,
  hidden,
  settings,
  quality,
  paused,
  reduced,
  trace,
  onSelect,
  onHover,
  onFocus,
  onStats,
  labels,
  host,
}: {
  graph: NeuralGraph;
  index: GraphIndex;
  positions: Layout;
  selected: string;
  hovered: string;
  hidden: Set<string>;
  settings: GraphSettings;
  quality: "high" | "medium" | "low";
  paused: boolean;
  reduced: boolean;
  trace: number;
  onSelect: (id: string) => void;
  onHover: (id: string) => void;
  onFocus: (id: string) => void;
  onStats: (s: SceneStats) => void;
  labels: HTMLDivElement | null;
  host: HTMLElement | null;
}) {
  const { camera, gl, size, invalidate, scene } = useThree();
  const objects = useMemo(
    () => createScene(graph, index, positions, quality),
    [graph, index, positions, quality],
  );
  const scheduler = useMemo(() => new PulseScheduler(), []);
  const lastZap = useRef(""),
    stats = useRef({ frames: 0, start: performance.now(), lastLabel: 0 });
  const lastClick = useRef({ id: "", time: 0, x: 0, y: 0 });
  // Own attachment and disposal together. Replacing a primitive's object while a
  // null-rendering composer sibling updates can defer R3F's reconstruction flush.
  useEffect(() => {
    scene.add(objects.group);
    invalidate();
    return () => {
      scene.remove(objects.group);
      objects.dispose();
    };
  }, [objects, scene, invalidate]);
  useEffect(() => {
    const active = hovered || selected,
      neighbors = index.neighbors.get(active) ?? new Set<string>();
    const states = objects.nodeGeo.getAttribute("aSelectionState"),
      visible = objects.nodeGeo.getAttribute("aVisible");
    for (const [id, i] of objects.nodeIndex) {
      states.setX(
        i,
        id === selected ? 3 : id === hovered ? 2 : neighbors.has(id) ? 1 : active ? -1 : 0,
      );
      visible.setX(
        i,
        (hidden.has(index.nodes.get(id)?.categoryId ?? "") || hidden.has(id)) && id !== selected
          ? 0
          : 1,
      );
    }
    states.needsUpdate = true;
    visible.needsUpdate = true;
    const edgeStates = objects.edgeGeo.getAttribute("aState"),
      edgeVisible = objects.edgeGeo.getAttribute("aVisible");
    for (const e of graph.edges) {
      const range = objects.edgeRanges.get(e.id);
      if (!range) continue;
      const emphasis = e.source === active || e.target === active;
      const show =
        ((!hidden.has(index.nodes.get(e.source)?.categoryId ?? "") && !hidden.has(e.source)) ||
          e.source === selected) &&
        ((!hidden.has(index.nodes.get(e.target)?.categoryId ?? "") && !hidden.has(e.target)) ||
          e.target === selected);
      for (let i = range[0]; i < range[1]; i++) {
        edgeStates.setX(i, emphasis ? 1 : active ? -1 : 0);
        edgeVisible.setX(i, show ? 1 : 0);
      }
    }
    edgeStates.needsUpdate = true;
    edgeVisible.needsUpdate = true;
    invalidate();
  }, [objects, graph, index, selected, hovered, hidden, invalidate]);
  useEffect(() => {
    scheduler.clear();
    lastZap.current = "";
    const activity = objects.nodeGeo.getAttribute("aActivity");
    (activity.array as Float32Array).fill(-100);
    activity.needsUpdate = true;
    if (selected && !reduced && settings.pulse > 0)
      scheduler.trigger(index, positions, selected, settings.depth, trace);
    fillRibbons(objects.pulse, scheduler.pulses, index, positions, objects.colorFor, false, false);
    fillRibbons(objects.zap, [], index, positions, objects.colorFor, true, false);
    invalidate();
  }, [
    trace,
    selected,
    reduced,
    settings.depth,
    settings.pulse,
    objects,
    scheduler,
    index,
    positions,
    invalidate,
  ]);
  useEffect(() => {
    const canvas = gl.domElement;
    const pointer = new Vector3();
    let down: { x: number; y: number; time: number } | null = null;
    let moved = false,
      hoverFrame = 0;
    const pick = (x: number, y: number) => {
      const rect = canvas.getBoundingClientRect();
      let best = "",
        distance = 18;
      for (const node of graph.nodes) {
        if ((hidden.has(node.categoryId) || hidden.has(node.id)) && node.id !== selected) continue;
        const p = positions[node.id];
        if (!p) continue;
        pointer.set(...p).project(camera);
        if (pointer.z < -1 || pointer.z > 1) continue;
        const px = ((pointer.x + 1) * rect.width) / 2 + rect.left,
          py = ((1 - pointer.y) * rect.height) / 2 + rect.top;
        const d = Math.hypot(px - x, py - y);
        if (d < distance) {
          distance = d;
          best = node.id;
        }
      }
      return best;
    };
    const start = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary) {
        down = null;
        return;
      }
      down = { x: e.clientX, y: e.clientY, time: performance.now() };
      moved = false;
    };
    const move = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) moved = true;
      if (e.buttons || hoverFrame) return;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = 0;
        onHover(pick(e.clientX, e.clientY));
      });
    };
    const up = (e: PointerEvent) => {
      if (!down || moved || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) {
        down = null;
        return;
      }
      down = null;
      const id = pick(e.clientX, e.clientY),
        now = performance.now();
      if (
        lastClick.current.id &&
        now - lastClick.current.time < 350 &&
        Math.hypot(e.clientX - lastClick.current.x, e.clientY - lastClick.current.y) < 8
      ) {
        onFocus(lastClick.current.id);
        lastClick.current = { id: "", time: 0, x: 0, y: 0 };
      } else {
        onSelect(id);
        lastClick.current = { id, time: now, x: e.clientX, y: e.clientY };
      }
    };
    const leave = () => onHover("");
    const cancel = () => {
      down = null;
    };
    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("pointercancel", cancel);
    return () => {
      cancelAnimationFrame(hoverFrame);
      canvas.removeEventListener("pointerdown", start);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("pointercancel", cancel);
    };
  }, [gl, camera, graph, positions, hidden, selected, onSelect, onHover, onFocus]);
  const v = useMemo(() => new Vector3(), []);
  const centerVector = useMemo(() => new Vector3(...boundsCenter(positions)), [positions]);
  useFrame((_, delta) => {
    scheduler.advance(
      delta * settings.speed,
      paused || reduced,
      settings.zaps,
      quality === "high" ? 10 : quality === "medium" ? 4 : 2,
    );
    for (const m of objects.materials) {
      m.uniforms.uTime.value = scheduler.time;
      m.uniforms.uMotion.value = reduced ? 0 : 1;
      m.uniforms.uDpr.value = gl.getPixelRatio();
      m.uniforms.uBrightness.value = settings.brightness;
      m.uniforms.uConnections.value = settings.connections;
      m.uniforms.uResolution.value.set(size.width, size.height);
      m.uniforms.uPulseIntensity.value = settings.pulse;
    }
    const key = scheduler.zaps.map((z) => `${z.edgeId}:${z.eventId}`).join("|");
    if (key !== lastZap.current || !settings.zaps) {
      lastZap.current = key;
      fillRibbons(
        objects.zap,
        settings.zaps ? scheduler.zaps : [],
        index,
        positions,
        objects.colorFor,
        true,
        quality === "high",
      );
    }
    const arrivals = objects.nodeGeo.getAttribute("aActivity");
    let changed = false;
    for (const [id, time] of scheduler.arrivals) {
      const i = objects.nodeIndex.get(id);
      if (i !== undefined && arrivals.getX(i) !== time) {
        arrivals.setX(i, time);
        changed = true;
      }
    }
    if (changed) arrivals.needsUpdate = true;
    if (labels) {
      const occupied: { x: number; y: number; w: number; h: number }[] = [];
      const near = camera.position.distanceTo(centerVector) < 22;
      for (const child of Array.from(labels.children)) {
        if (!(child instanceof HTMLElement)) continue;
        const id = child.dataset.labelId,
          p = id ? positions[id] : null;
        if (!p) continue;
        v.set(...p).project(camera);
        let show =
          v.z >= -1 &&
          v.z <= 1 &&
          Math.abs(v.x) < 0.95 &&
          Math.abs(v.y) < 0.92 &&
          ((!hidden.has(index.nodes.get(id ?? "")?.categoryId ?? "") && !hidden.has(id ?? "")) ||
            id === selected);
        const node = index.nodes.get(id ?? "");
        if (id !== selected && id !== hovered && !near && (node?.importance ?? 0) < 0.8)
          show = false;
        const rect = {
          x: ((v.x + 1) * size.width) / 2 + 6,
          y: ((1 - v.y) * size.height) / 2 + 10,
          w: child.offsetWidth,
          h: child.offsetHeight,
        };
        if (
          id !== selected &&
          id !== hovered &&
          occupied.some(
            (r) =>
              rect.x < r.x + r.w + 8 &&
              rect.x + rect.w + 8 > r.x &&
              rect.y < r.y + r.h + 5 &&
              rect.y + rect.h + 5 > r.y,
          )
        )
          show = false;
        if (show) occupied.push(rect);
        child.style.visibility = show ? "visible" : "hidden";
        child.style.transform = `translate(${((v.x + 1) * size.width) / 2}px,${((1 - v.y) * size.height) / 2}px)`;
      }
    }
    if (host) {
      host.dataset.camera = `${camera.position.x.toFixed(3)},${camera.position.y.toFixed(3)},${camera.position.z.toFixed(3)}`;
      host.dataset.graphTime = scheduler.time.toFixed(3);
      host.dataset.activePulses = String(
        scheduler.pulses.filter(
          (p) => p.startTime <= scheduler.time && p.startTime + p.duration >= scheduler.time,
        ).length,
      );
      host.dataset.activeZaps = String(scheduler.zaps.length);
      host.dataset.geometries = String(gl.info.memory.geometries);
      host.dataset.nodeCount = String(graph.nodes.length);
      host.dataset.edgeCount = String(graph.edges.length);
    }
    stats.current.frames++;
    const now = performance.now();
    if (now - stats.current.start >= 1000) {
      if (host) {
        host.dataset.fps = String(
          Math.round((stats.current.frames * 1000) / (now - stats.current.start)),
        );
        host.dataset.drawCalls = String(gl.info.render.calls);
        host.dataset.textures = String(gl.info.memory.textures);
        host.dataset.programs = String(gl.info.programs?.length ?? 0);
      }
      onStats({
        fps: Math.round((stats.current.frames * 1000) / (now - stats.current.start)),
        calls: gl.info.render.calls,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
        activePulses: scheduler.pulses.length,
        activeZaps: scheduler.zaps.length,
        renderer: gl.getContext().getParameter(gl.getContext().RENDERER) as string,
      });
      stats.current = { ...stats.current, frames: 0, start: now };
    }
  });
  return (
    <>
      <GraphPostProcessing quality={quality} intensity={settings.bloom} />
    </>
  );
}

function boundsCenter(positions: Layout): [number, number, number] {
  const points = Object.values(positions);
  if (!points.length) return [0, 0, 0];
  const sum = points.reduce(
    (s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]] as [number, number, number],
    [0, 0, 0],
  );
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
}
