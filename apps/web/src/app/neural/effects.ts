import type { Layout } from "./layout.js";
import type { GraphIndex, NeuralEdge } from "./model.js";

export type Pulse = {
  edgeId: string;
  sourceId: string;
  targetId: string;
  startTime: number;
  duration: number;
  intensity: number;
  eventId: number;
  reverse: boolean;
};
export type Zap = { edgeId: string; startTime: number; eventId: number };
export const durationFor = (edge: NeuralEdge, positions: Layout) => {
  const a = positions[edge.source],
    b = positions[edge.target];
  return Math.max(
    0.2,
    Math.min(0.9, a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 0.035 : 0.4),
  );
};

export function propagation(
  index: GraphIndex,
  positions: Layout,
  source: string,
  start: number,
  eventId: number,
  depth = 2,
): Pulse[] {
  if (!index.nodes.has(source)) return [];
  const queue = [{ id: source, depth: 0, time: start }],
    seen = new Set([source]),
    edges = new Set<string>(),
    pulses: Pulse[] = [];
  for (let i = 0; i < queue.length && pulses.length < 80; i++) {
    const current = queue[i];
    if (!current || current.depth >= Math.min(3, Math.max(0, depth))) continue;
    for (const link of index.adjacency.get(current.id) ?? []) {
      if (edges.has(link.edge.id) || seen.has(link.target)) continue;
      edges.add(link.edge.id);
      seen.add(link.target);
      const duration = durationFor(link.edge, positions);
      const pulse = {
        edgeId: link.edge.id,
        sourceId: current.id,
        targetId: link.target,
        startTime: current.time,
        duration,
        intensity: 1 - current.depth * 0.22,
        eventId,
        reverse: link.edge.source !== current.id,
      };
      pulses.push(pulse);
      queue.push({
        id: link.target,
        depth: current.depth + 1,
        time: current.time + duration + 0.06,
      });
      if (pulses.length === 80) break;
    }
  }
  return pulses.sort((a, b) => a.startTime - b.startTime || a.edgeId.localeCompare(b.edgeId));
}

// One pause-aware clock and bounded queue. Replacement cancels the entire prior trace.
export class PulseScheduler {
  time = 0;
  eventId = 0;
  pulses: Pulse[] = [];
  zaps: Zap[] = [];
  arrivals = new Map<string, number>();
  private cursor = 0;
  private cooldown = new Map<string, number>();
  trigger(
    index: GraphIndex,
    positions: Layout,
    source: string,
    depth = 2,
    requestId = this.eventId + 1,
  ) {
    this.eventId = Math.max(this.eventId + 1, requestId);
    this.pulses = propagation(index, positions, source, this.time, this.eventId, depth);
    this.zaps = [];
    this.arrivals.clear();
    this.arrivals.set(source, this.time);
    this.cursor = 0;
    return this.pulses;
  }
  clear() {
    this.pulses = [];
    this.zaps = [];
    this.arrivals.clear();
    this.cursor = 0;
  }
  advance(delta: number, paused: boolean, zapsEnabled: boolean, maxZaps = 10) {
    if (paused) return;
    this.time += Math.max(0, Math.min(delta, 0.1));
    this.zaps = this.zaps.filter((z) => this.time - z.startTime < 0.16);
    while (this.cursor < this.pulses.length) {
      const p = this.pulses[this.cursor];
      if (!p || p.startTime > this.time) break;
      this.cursor++;
      if (
        zapsEnabled &&
        this.zaps.length < maxZaps &&
        this.time - (this.cooldown.get(p.edgeId) ?? -100) > 0.5
      ) {
        this.zaps.push({ edgeId: p.edgeId, startTime: p.startTime, eventId: p.eventId });
        this.cooldown.set(p.edgeId, this.time);
      }
    }
    for (const p of this.pulses)
      if (this.time >= p.startTime + p.duration)
        this.arrivals.set(p.targetId, p.startTime + p.duration);
    // Keep cooldown history bounded even when unrelated nodes are selected repeatedly.
    if (this.cooldown.size > 160)
      for (const [id, t] of this.cooldown) if (this.time - t > 1) this.cooldown.delete(id);
  }
  get active() {
    return this.pulses.some((p) => this.time < p.startTime + p.duration + 0.4);
  }
}

export function zapEnvelope(age: number) {
  return age < 0 || age > 0.16 ? 0 : age < 0.02 ? age / 0.02 : age < 0.08 ? 1 : (0.16 - age) / 0.08;
}
