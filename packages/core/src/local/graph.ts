import {
  localNoteSchema,
  localEvidenceSchema,
  z,
  type localSnapshotSchema,
  type LocalNote,
} from "@atlas/contracts";
import { evidenceStale, sourceData, versionData } from "./sources.js";
import type { Catalog } from "./transactions.js";
type Snapshot = z.infer<typeof localSnapshotSchema>;
export function graphFocusDistances(
  focus: string | undefined,
  links: [string, string][],
  depth: 1 | 2,
) {
  const distance = new Map<string, number>();
  if (!focus) return distance;
  const adjacency = new Map<string, Set<string>>();
  for (const [from, to] of links) {
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from)?.add(to);
    adjacency.get(to)?.add(from);
  }
  distance.set(focus, 0);
  let frontier = [focus];
  for (let hop = 1; hop <= depth; hop++) {
    const next: string[] = [];
    for (const from of frontier)
      for (const to of adjacency.get(from) ?? [])
        if (!distance.has(to)) {
          distance.set(to, hop);
          next.push(to);
        }
    frontier = next;
  }
  return distance;
}
export function domainGraph(
  c: Catalog,
  legacy: Snapshot,
  options: { limit?: number; focus?: string; depth?: 1 | 2; include_proposed?: boolean } = {},
) {
  const limit = Math.max(1, Math.min(1000, options.limit ?? 500));
  const notes: LocalNote[] = [],
    edges: Snapshot["edges"] = [],
    warnings: string[] = [];
  const content = [...c.heads.values()].filter(
    (r) =>
      ["source", "memory", "entity"].includes(r.kind) &&
      r.data.archived !== true &&
      r.data.status !== "archived" &&
      r.data.status !== "rejected" &&
      (r.kind === "source" || options.include_proposed || r.data.status === "active"),
  );
  const referencedCollections = new Set(
    content.flatMap((r) =>
      Array.isArray(r.data.collection_ids) ? r.data.collection_ids.map(String) : [],
    ),
  );
  const collections = [...c.heads.values()].filter(
    (r) => r.kind === "collection" && referencedCollections.has(r.entity_id) && !r.data.archived,
  );
  const allowed = new Set([
    ...legacy.notes
      .filter((n) => !n.archived && c.heads.get(`project_metadata:${n.id}`)?.data.archived !== true)
      .map((n) => n.id),
    ...content.map((r) => r.entity_id),
    ...collections.map((r) => r.entity_id),
  ]);
  const links: [string, string][] = [];
  const link = (from: string, to: string) => {
    if (allowed.has(from) && allowed.has(to) && from !== to) links.push([from, to]);
  };
  for (const edge of legacy.edges) link(edge.source, edge.target);
  for (const r of [...content, ...collections]) {
    if (typeof r.data.project_id === "string") link(r.entity_id, r.data.project_id);
    for (const id of Array.isArray(r.data.collection_ids) ? r.data.collection_ids : [])
      if (typeof id === "string") link(r.entity_id, id);
  }
  for (const edge of c.heads.values())
    if (edge.kind === "relationship" && edge.data.status === "active") {
      const from = String(edge.data.from_item_id),
        to = String(edge.data.to_item_id);
      const evidence = z.array(localEvidenceSchema).parse(edge.data.evidence ?? []);
      if (!evidenceStale(c, evidence)) link(from, to);
    }
  for (const r of content)
    for (const e of z.array(localEvidenceSchema).parse(r.data.evidence ?? [])) {
      try {
        const source = versionData(c, e.source_version_id).source_id;
        if (!evidenceStale(c, [e])) link(r.entity_id, source);
      } catch {}
    }
  const priority = graphFocusDistances(options.focus, links, options.depth ?? 1);
  const visible = [...content, ...collections]
    .sort(
      (a, b) =>
        (priority.get(a.entity_id) ?? Infinity) - (priority.get(b.entity_id) ?? Infinity) ||
        a.entity_id.localeCompare(b.entity_id),
    )
    .slice(0, limit);
  if (visible.length < content.length + collections.length)
    warnings.push(
      `Domain graph limited to ${limit} current items; use Sources/search or focus an item for the full catalog.`,
    );
  for (const r of visible) {
    const evidence = z.array(localEvidenceSchema).parse(r.data.evidence ?? []),
      stale = evidence.length ? evidenceStale(c, evidence) : false;
    let body = String(r.data.summary ?? r.body);
    if (r.kind === "source") {
      try {
        const source = sourceData(c, r.entity_id);
        body = `${source.input_type.replaceAll("_", " ")} source material. Open the source to read its immutable versions and exact original.`;
      } catch {
        body = "Original preserved; extraction is unavailable.";
      }
    }
    const status = stale
      ? "requires_revalidation"
      : String(r.data.status ?? r.data.processing_state ?? "local_file");
    notes.push(
      localNoteSchema.parse({
        id: r.entity_id,
        title: String(r.data.title ?? r.data.name ?? r.kind),
        kind: r.kind === "memory" ? "decision" : r.kind === "collection" ? "catalog" : "note",
        path: r.path,
        markdown: body,
        project_id: r.data.project_id ?? null,
        agent_id: r.data.agent_id ?? null,
        created_at: r.created_at,
        status: "local_file",
        repository_digest: null,
        archived: false,
        aliases: r.data.status === "active" && Array.isArray(r.data.aliases) ? r.data.aliases : [],
        metadata_links: [],
        provenance: {
          paths: [r.path],
          verification:
            r.kind === "source"
              ? "Captured source material; original bytes retained. This is not a verified fact."
              : r.kind === "collection"
                ? "Owner-maintained collection structure; this is not an inferred fact."
                : stale
                  ? "Evidence changed; owner revalidation is required."
                  : r.data.status === "active"
                    ? "Owner-reviewed fact with exact source-version evidence."
                    : "Agent proposal; owner review is required.",
        },
        modified_since_capture: stale,
        file_digest: r.file_digest,
        knowledge: null,
        effective_state: stale
          ? "candidate"
          : r.data.status === "proposed"
            ? "candidate"
            : r.data.status === "superseded"
              ? "superseded"
              : "active",
        domain_kind: r.kind,
        domain_status: status,
        domain_evidence: evidence,
      }),
    );
  }
  const ids = new Set([...legacy.notes, ...notes].map((n) => n.id));
  for (const r of visible) {
    if (typeof r.data.project_id === "string" && ids.has(r.data.project_id))
      edges.push({ source: r.entity_id, target: r.data.project_id, kind: "project" });
    for (const cid of Array.isArray(r.data.collection_ids) ? r.data.collection_ids : [])
      if (typeof cid === "string" && ids.has(cid))
        edges.push({ source: r.entity_id, target: cid, kind: "collection" });
    for (const e of z.array(localEvidenceSchema).parse(r.data.evidence ?? [])) {
      try {
        const version = versionData(c, e.source_version_id);
        if (ids.has(version.source_id))
          edges.push({
            source: r.entity_id,
            target: version.source_id,
            kind: "evidence",
            review: r.data.status === "active" && !evidenceStale(c, [e]) ? "verified" : "proposed",
            confidence: null,
          });
      } catch {
        warnings.push(`Evidence endpoint unavailable for ${r.entity_id}`);
      }
    }
  }
  for (const r of c.heads.values())
    if (
      r.kind === "relationship" &&
      r.data.status === "active" &&
      ids.has(String(r.data.from_item_id)) &&
      ids.has(String(r.data.to_item_id))
    ) {
      const evidence = z.array(localEvidenceSchema).parse(r.data.evidence);
      if (evidenceStale(c, evidence)) continue;
      edges.push({
        source: String(r.data.from_item_id),
        target: String(r.data.to_item_id),
        kind: z
          .enum([
            "USES",
            "DEPENDS_ON",
            "IMPLEMENTS",
            "BELONGS_TO",
            "RELATED_TO",
            "REPLACES",
            "RESOLVES",
            "DOCUMENTS",
            "REFERENCES",
          ])
          .parse(r.data.type),
        review: r.data.status === "active" ? "verified" : "proposed",
        confidence:
          typeof r.data.reported_confidence === "number" ? r.data.reported_confidence : null,
      });
    }
  return { notes, edges, warnings, truncated: content.length + collections.length > limit };
}
