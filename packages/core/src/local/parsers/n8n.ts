import { z } from "@atlas/contracts";
import { DomainError } from "../transactions.js";
import { normalized, secretClasses } from "../sources.js";

// Static supplied-export inventory only: no instance, SDK, execution, imports,
// credentials resolution, expressions evaluation, or workflow modification.
export function parseN8nExport(bytes: Uint8Array) {
  if (bytes.length > 2097152) throw new DomainError("N8N_EXPORT_TOO_LARGE", 413);
  const raw = normalized(bytes);
  if (secretClasses(raw).length) throw new DomainError("N8N_EXPORT_REQUIRES_SECRET_REMOVAL", 415);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new DomainError("N8N_EXPORT_INVALID", 415);
  }
  const workflow = z
    .object({
      name: z.string().min(1).max(500),
      nodes: z
        .array(
          z.object({
            name: z.string().min(1).max(500),
            type: z.string().min(1).max(500),
            typeVersion: z.number().optional(),
            credentials: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .max(5000),
      connections: z.record(
        z.string(),
        z.record(
          z.string(),
          z.array(
            z.array(
              z.object({
                node: z.string().max(500),
                type: z.string().max(100).optional(),
                index: z.number().int().nonnegative().optional(),
              }),
            ),
          ),
        ),
      ),
      versionId: z.string().max(200).optional(),
    })
    .safeParse(value);
  if (!workflow.success) throw new DomainError("N8N_EXPORT_INVALID", 415);
  const v = workflow.data,
    names = new Set(v.nodes.map((n) => n.name));
  if (names.size !== v.nodes.length) throw new DomainError("N8N_DUPLICATE_NODE_NAME", 415);
  let edges = 0;
  const lines = [
    `# Supplied workflow: ${v.name}`,
    "",
    "Static export inventory; live installation, validation and execution are unverified.",
    ...(v.versionId ? [`Reported export version: ${v.versionId}`] : []),
    "",
    "## Nodes",
  ];
  for (const node of v.nodes)
    lines.push(
      `- ${node.name} — ${node.type}${node.typeVersion !== undefined ? ` (type version ${node.typeVersion})` : ""}${node.credentials ? " — credential references withheld from context" : ""}`,
    );
  lines.push("", "## Connections");
  for (const [from, outputs] of Object.entries(v.connections)) {
    if (!names.has(from)) throw new DomainError("N8N_UNKNOWN_CONNECTION", 415);
    for (const [kind, branches] of Object.entries(outputs))
      for (const branch of branches)
        for (const edge of branch) {
          if (!names.has(edge.node) || ++edges > 10000)
            throw new DomainError("N8N_UNKNOWN_CONNECTION", 415);
          lines.push(`- ${from} → ${edge.node} (${kind})`);
        }
  }
  const text = lines.join("\n");
  if (Buffer.byteLength(text) > 2097152) throw new DomainError("N8N_EXPORT_TOO_LARGE", 413);
  return {
    text,
    extraction_status: "n8n_static_export",
    nodes: v.nodes.length,
    connections: edges,
  };
}
