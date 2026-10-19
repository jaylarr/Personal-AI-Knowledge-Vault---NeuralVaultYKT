import type { localSnapshotSchema, z } from "@atlas/contracts";

export type Snapshot = z.infer<typeof localSnapshotSchema>;
export type Point3 = { x: number; y: number; z: number };
export type Camera = { yaw: number; pitch: number; zoom: number; x: number; y: number };
export const homeCamera: Camera = { yaw: -0.24, pitch: 0.14, zoom: 1, x: 0, y: 0 };
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// A deterministic volume: project hubs, with notes distributed on spherical shells.
// Coordinates represent layout only. Connections always come from the vault snapshot.
export function graphLayout(notes: Snapshot["notes"]) {
  const points = new Map<string, Point3>();
  const projects = notes
    .filter((n) => n.kind === "project")
    .sort((a, b) => a.id.localeCompare(b.id));
  const sphere = (index: number, count: number, radius: number): Point3 => {
    const y = 1 - (2 * (index + 0.5)) / count;
    const ring = Math.sqrt(1 - y * y);
    const angle = index * Math.PI * (3 - Math.sqrt(5)) + 0.6;
    return {
      x: Math.cos(angle) * ring * radius,
      y: y * radius * 0.8,
      z: Math.sin(angle) * ring * radius,
    };
  };
  for (const [i, project] of projects.entries()) {
    points.set(
      project.id,
      projects.length === 1 ? { x: 0, y: 0, z: 0 } : sphere(i, projects.length, 190),
    );
  }
  const groups = new Map<string, Snapshot["notes"]>();
  for (const n of notes.filter((n) => n.kind !== "project")) {
    const key = n.project_id ?? "unassigned";
    const group = groups.get(key) ?? [];
    group.push(n);
    groups.set(key, group);
  }
  for (const [key, group] of groups) {
    const center = points.get(key) ?? { x: 0, y: 0, z: 0 };
    group.sort((a, b) => a.id.localeCompare(b.id));
    const radius = points.has(key) ? 85 + Math.min(55, group.length * 3) : 230;
    for (const [i, n] of group.entries()) {
      const p = sphere(i, group.length, radius);
      points.set(n.id, { x: center.x + p.x, y: center.y + p.y, z: center.z + p.z });
    }
  }
  // Center the actual bounds and normalize so every dataset fits the reset view.
  const all = [...points.values()];
  if (!all.length) return points;
  const bounds = (axis: keyof Point3) =>
    [Math.min(...all.map((p) => p[axis])), Math.max(...all.map((p) => p[axis]))] as const;
  const [xmin, xmax] = bounds("x"),
    [ymin, ymax] = bounds("y"),
    [zmin, zmax] = bounds("z");
  const center = { x: (xmin + xmax) / 2, y: (ymin + ymax) / 2, z: (zmin + zmax) / 2 };
  const extent = Math.max(
    1,
    ...all.map((p) => Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z)),
  );
  for (const [id, p] of points)
    points.set(id, {
      x: ((p.x - center.x) * 235) / extent,
      y: ((p.y - center.y) * 235) / extent,
      z: ((p.z - center.z) * 235) / extent,
    });
  return points;
}

export function rotate(p: Point3, camera: Camera): Point3 {
  const x = p.x * Math.cos(camera.yaw) + p.z * Math.sin(camera.yaw);
  const z = -p.x * Math.sin(camera.yaw) + p.z * Math.cos(camera.yaw);
  return {
    x,
    y: p.y * Math.cos(camera.pitch) - z * Math.sin(camera.pitch),
    z: p.y * Math.sin(camera.pitch) + z * Math.cos(camera.pitch),
  };
}

export function frameScale(
  points: Iterable<Point3>,
  _camera: Camera,
  width: number,
  height: number,
) {
  let radius = 40;
  for (const p of points) {
    radius = Math.max(radius, Math.hypot(p.x, p.y, p.z));
  }
  // The projected bound of a sphere is invariant under rotation. Fitting once
  // keeps the camera scale steady and includes every node at any orbit angle.
  const extent = radius / Math.sqrt(1 - (radius / 900) ** 2);
  return Math.min(
    Math.max(60, width - 100) / (2 * extent),
    Math.max(120, height - 130) / (2 * extent),
    1.8,
  );
}

export function project(
  p: Point3,
  camera: Camera,
  width: number,
  height: number,
  sceneFit?: number,
) {
  const r = rotate(p, camera);
  const depth = 900 / (900 - r.z);
  const fit = sceneFit ?? Math.min(Math.max(100, width - 100), height - 150) / 440;
  return {
    x: width / 2 + camera.x + r.x * depth * fit * camera.zoom,
    y: height / 2 + camera.y + r.y * depth * fit * camera.zoom,
    z: r.z,
    scale: depth * camera.zoom,
  };
}
