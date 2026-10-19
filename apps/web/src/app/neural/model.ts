import type { LocalNote, localSnapshotSchema } from "@atlas/contracts";

export type Vec3 = [number, number, number];
export type Relation =
  | "related_to"
  | "depends_on"
  | "uses"
  | "part_of"
  | "supports"
  | "contradicts"
  | "references"
  | "derived_from"
  | "built_with";
export type StoredRelation = "implements" | "replaces" | "resolves";
export type NeuralNode = {
  id: string;
  title: string;
  summary: string;
  categoryId: string;
  type: string;
  tags: string[];
  importance: number;
  source: LocalNote | null;
  position?: Vec3;
};
export type NeuralEdge = {
  id: string;
  source: string;
  target: string;
  type: Relation | StoredRelation;
  directed: boolean;
  strength: number;
  confidence: number | null;
  provenance: "manual" | "imported" | "inferred";
  review: "proposed" | "verified" | "rejected" | "unknown";
  origin: string;
};
export type NeuralGraph = { nodes: NeuralNode[]; edges: NeuralEdge[]; sample: boolean };
export type GraphIndex = {
  nodes: Map<string, NeuralNode>;
  edges: Map<string, NeuralEdge>;
  adjacency: Map<string, { edge: NeuralEdge; target: string }[]>;
  neighbors: Map<string, Set<string>>;
  categories: string[];
  isolated: number;
  components: number;
  warnings: string[];
};
export type Snapshot = ReturnType<typeof localSnapshotSchema.parse>;
export const hash = (s: string) => {
  let n = 2166136261;
  for (let i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619);
  return n >>> 0;
};
export const random = (s: string) => hash(s) / 4294967295;

export function adaptVault(data: Snapshot): NeuralGraph {
  const projects = new Map(
    data.notes.filter((n) => n.kind === "project").map((n) => [n.id, n.title]),
  );
  return {
    sample: false,
    nodes: data.notes.map((n) => ({
      id: n.id,
      title: n.title,
      summary:
        n.knowledge?.summary ??
        n.markdown
          .replace(/^---[\s\S]*?---/, "")
          .replace(/[#*`[\]]/g, "")
          .trim()
          .slice(0, 300),
      categoryId:
        projects.get(n.project_id ?? n.id) ??
        (n.knowledge?.scope === "owner" ? "Owner" : "Unassigned"),
      type: n.domain_kind ?? n.knowledge?.type ?? n.kind,
      tags: n.knowledge?.topics ?? [],
      importance: n.kind === "project" ? 1 : 0.35,
      source: n,
    })),
    edges: data.edges.map((e) => ({
      id: `${e.kind}:${e.source}:${e.target}`,
      source: e.source,
      target: e.target,
      type: (
        {
          project: "part_of",
          collection: "part_of",
          wikilink: "references",
          markdown: "references",
          evidence: "derived_from",
          USES: "uses",
          DEPENDS_ON: "depends_on",
          IMPLEMENTS: "implements",
          BELONGS_TO: "part_of",
          RELATED_TO: "related_to",
          REPLACES: "replaces",
          RESOLVES: "resolves",
          DOCUMENTS: "references",
          REFERENCES: "references",
        } as const
      )[e.kind],
      directed: true,
      strength: e.kind === "project" ? 0.8 : 0.65,
      confidence: e.confidence ?? null,
      provenance: "imported",
      review: e.review ?? "unknown",
      origin:
        e.kind === "project"
          ? "File project membership"
          : ["wikilink", "markdown"].includes(e.kind)
            ? `${e.kind} in Markdown`
            : `Stored ${e.kind} link`,
    })),
  };
}

export function validateGraph(input: NeuralGraph): { graph: NeuralGraph; index: GraphIndex } {
  const warnings: string[] = [],
    nodes = new Map<string, NeuralNode>(),
    edges = new Map<string, NeuralEdge>();
  for (const n of input.nodes) {
    if (!n.id || nodes.has(n.id)) {
      warnings.push(`Duplicate or empty node ID: ${n.id}`);
      continue;
    }
    nodes.set(n.id, {
      ...n,
      importance: Math.max(0, Math.min(1, Number.isFinite(n.importance) ? n.importance : 0.35)),
    });
  }
  const adjacency = new Map<string, { edge: NeuralEdge; target: string }[]>(),
    neighbors = new Map<string, Set<string>>();
  for (const id of nodes.keys()) {
    adjacency.set(id, []);
    neighbors.set(id, new Set());
  }
  const semantic = new Set<string>();
  for (const e of input.edges) {
    if (
      !e.id ||
      edges.has(e.id) ||
      !nodes.has(e.source) ||
      !nodes.has(e.target) ||
      !Number.isFinite(e.strength) ||
      e.strength < 0 ||
      e.strength > 1
    ) {
      warnings.push(`Invalid/duplicate edge: ${e.id}`);
      continue;
    }
    const ends = e.directed ? [e.source, e.target] : [e.source, e.target].sort();
    const key = JSON.stringify([ends, e.directed, e.type, e.origin, e.provenance, e.review]);
    if (semantic.has(key)) {
      warnings.push(`Duplicate relation: ${e.id}`);
      continue;
    }
    semantic.add(key);
    edges.set(e.id, e);
    adjacency.get(e.source)?.push({ edge: e, target: e.target });
    if (!e.directed) adjacency.get(e.target)?.push({ edge: e, target: e.source });
    neighbors.get(e.source)?.add(e.target);
    neighbors.get(e.target)?.add(e.source);
  }
  for (const a of adjacency.values()) a.sort((a, b) => a.edge.id.localeCompare(b.edge.id));
  let components = 0;
  const visited = new Set<string>();
  for (const id of nodes.keys()) {
    if (visited.has(id)) continue;
    components++;
    const queue = [id];
    visited.add(id);
    for (let i = 0; i < queue.length; i++)
      for (const next of neighbors.get(queue[i] ?? "") ?? [])
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
  }
  return {
    graph: { nodes: [...nodes.values()], edges: [...edges.values()], sample: input.sample },
    index: {
      nodes,
      edges,
      adjacency,
      neighbors,
      categories: [...new Set([...nodes.values()].map((n) => n.categoryId))].sort(),
      isolated: [...neighbors.values()].filter((n) => n.size === 0).length,
      components,
      warnings,
    },
  };
}

export function searchNodes(nodes: NeuralNode[], query: string): NeuralNode[] {
  const normalized = query.toLowerCase().trim();
  const score = (node: NeuralNode) => {
    const title = node.title.toLowerCase();
    return (
      (normalized && title === normalized
        ? 100
        : normalized && title.startsWith(normalized)
          ? 40
          : normalized && title.includes(normalized)
            ? 20
            : 0) + node.importance
    );
  };
  const terms = query.toLowerCase().trim().split(/\s+/);
  return nodes
    .filter((n) =>
      terms.every((t) => `${n.title} ${n.summary} ${n.tags.join(" ")}`.toLowerCase().includes(t)),
    )
    .sort((a, b) => score(b) - score(a) || a.title.localeCompare(b.title));
}

export function sampleGraph(count = 300, edgeCount = 600): NeuralGraph {
  const groups = [
    "Engineering",
    "Research",
    "Design",
    "Systems",
    "Writing",
    "Products",
    "Learning",
    "Methods",
    "Evidence",
    "Ideas",
  ];
  const nodes: NeuralNode[] = Array.from({ length: count }, (_, i) => ({
    id: `sample-${i}`,
    title: `${groups[i % 10]} ${Math.floor(i / 10) + 1}`,
    summary:
      "Synthetic graph fixture for visual and performance testing. This is not vault knowledge.",
    categoryId: groups[i % 10] ?? "Ideas",
    type: i < 10 ? "project" : "note",
    tags: ["sample"],
    importance: i < 10 ? 1 : 0.2 + random(`importance-${i}`) * 0.4,
    source: null,
  }));
  const edges: NeuralEdge[] = [];
  const seen = new Set<string>();
  for (let i = 10; i < count - 2; i++) {
    const target = i % 10;
    const source = i;
    seen.add([source, target].sort((a, b) => a - b).join(":"));
    edges.push({
      id: `sample-edge-${edges.length}`,
      source: `sample-${source}`,
      target: `sample-${target}`,
      type: "part_of",
      directed: false,
      strength: 0.7,
      confidence: null,
      provenance: "manual",
      review: "unknown",
      origin: "Synthetic sample membership",
    });
  }
  for (let i = 0; edges.length < edgeCount && i < edgeCount * 20; i++) {
    const source = hash(`source-${i}`) % Math.max(1, count - 2),
      target =
        i % 5 === 0
          ? hash(`target-${i}`) % Math.max(1, count - 2)
          : ((source % 10) +
              (hash(`neighbor-${i}`) % Math.max(1, Math.ceil((count - 2) / 10))) * 10) %
            Math.max(1, count - 2);
    const key = [source, target].sort((a, b) => a - b).join(":");
    if (source === target || seen.has(key)) continue;
    seen.add(key);
    edges.push({
      id: `sample-edge-${edges.length}`,
      source: `sample-${source}`,
      target: `sample-${target}`,
      type: i % 5 ? "related_to" : "supports",
      directed: i % 5 === 0,
      strength: 0.4 + random(key) * 0.5,
      confidence: null,
      provenance: "manual",
      review: "unknown",
      origin: "Synthetic sample relationship",
    });
  }
  return { nodes, edges, sample: true };
}
