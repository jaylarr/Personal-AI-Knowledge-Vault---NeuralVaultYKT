import { z } from "@atlas/contracts";
import { canonical, sha256, type Catalog, type LocalStore } from "./transactions.js";
import { versionData } from "./sources.js";

const indexSchema = z
  .object({
    schema: z.literal(1),
    revision: z.string(),
    documents: z.array(z.tuple([z.string(), z.string()])).max(5000),
  })
  .strict();
export function lexicalRevision(c: Catalog) {
  return sha256(
    canonical(
      [...c.heads.values()]
        .filter((r) => ["source", "version", "memory", "entity", "relationship"].includes(r.kind))
        .map((r) => [r.id, r.file_digest])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ),
  );
}
export async function lexicalIndex(store: LocalStore, c: Catalog, revision: string) {
  const path = `.atlas/derived/lexical-v1/${revision}.json`;
  try {
    const raw = await store.read(path);
    if (raw.length > 67108864) throw Error("Index limit");
    const saved = indexSchema.parse(JSON.parse(raw.toString()));
    // Derived caches have no authority: compare their complete deterministic digest
    // with canonical records before trusting them, including after a direct edit.
    const built = build(c, revision);
    if (sha256(canonical(saved)) === sha256(canonical(built))) return new Map(saved.documents);
  } catch {
    /* Rebuild corrupt/missing derived data without changing source files. */
  }
  const built = build(c, revision),
    bytes = Buffer.from(canonical(built));
  if (bytes.length <= 67108864)
    try {
      await store.vault.writeExclusive(path, bytes);
    } catch {
      /* Cache collisions/failures never authorize source content. */
    }
  return new Map(built.documents);
}
function build(c: Catalog, revision: string) {
  const documents: [string, string][] = [];
  for (const r of c.heads.values())
    if (["source", "memory", "entity", "relationship"].includes(r.kind)) {
      const sourceText =
        r.kind === "source" ? versionData(c, String(r.data.current_version_id)).text : "";
      const aliases =
        r.kind === "entity" && r.data.status === "active" && Array.isArray(r.data.aliases)
          ? r.data.aliases.join(" ")
          : "";
      documents.push([
        r.entity_id,
        [
          r.data.title,
          r.data.subject_key,
          r.data.canonical_key,
          r.data.summary,
          r.body,
          sourceText,
          aliases,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase(),
      ]);
    }
  return {
    schema: 1 as const,
    revision,
    documents: documents.sort(([a], [b]) => a.localeCompare(b)),
  };
}
