# Core flaws remediation — 2026-10-20

Owner-supplied specification. Execute F01–F06 sequentially. Preserve original Vault Markdown and source brief SHA-256 BC1CB856343D4E9057D8EFCF2ACE85D380A324EB0D2490C078B110BA1BC27B0A; never print secrets, add dependencies, or break the browser-safe contracts boundary.

## Task F01 — Avoid repeated snapshot writes

Replace it with a pre-write existence check so existing history/receipt files return immediately without creating a .tmp file or calling fsync:

async function createOnce(path: string, content: string) {
  try {
    const existing = await safe(path);
    await lstat(existing);
    return;
  } catch (e) {
    if (!notFound(e)) throw e;
  }
  try {
    await write(path, content);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
}
Verify that sees direct edits and never overwrites them on retry; retains observed versions in tests/unit/local-vault.test.ts still records a new history snapshot when file bytes change, while repeated snapshot() calls on unchanged files allocate zero .tmp files.

## Task F02: Exempt Ephemeral trace Records from Admission Limits & Enable Small-Catalog Watcher (packages/core/src/local/transactions.ts)File: packages/core/src/local/transactions.tsAdd a helper to identify operational trace paths:

const isTraceOutput = (path: string) => path.startsWith(".atlas/operations/trace/");
In catalogUnlocked() (around lines 208–254):Keep parsing and loading trace records into records and heads so head(c, "trace", traceId), tests/unit/local-domain.test.ts, and GET /api/v1/local/domain/traces/:id continue to work identically.Only increment files (checked against 50000) and bytes (checked against 67108864) when !isTraceOutput(out.path).Change if (records.length >= 200) watchChanges(); (around line 292) to watchChanges(); so catalogs of any size use the incremental watcher and in-memory projection instead of rebuilding on every call.In transaction() (around lines 439–447):Compute nextCounts using only non-trace outputs (outputs.filter((o) => !isTraceOutput(o.path))):

const nonTraceOutputs = outputs.filter((o) => !isTraceOutput(o.path));
const oldCounts = counts.get(c) ?? { recordBytes: 0, outputs: 0 },
  nextCounts = {
    recordBytes:
      oldCounts.recordBytes +
      nonTraceOutputs.filter((o) => o.record).reduce((sum, o) => sum + o.bytes, 0),
    outputs: oldCounts.outputs + nonTraceOutputs.length,
  };
if (nextCounts.recordBytes > 67108864 || nextCounts.outputs > 50000)
  throw new DomainError("CATALOG_ADMISSION_LIMIT", 413);
Note: if (outputs.length > 1000) throw new DomainError("OPERATION_TOO_LARGE", 413); and if (Buffer.byteLength(raw) > 2097152) throw new DomainError("RECORD_TOO_LARGE", 413); remain before this check, preserving all admission tests in tests/unit/local-domain.test.ts.

## Task F03: Fix Task Lifecycle, Supersession, Source Aggregation & Pipeline Chunks (packages/core/src/local/tasks.ts, packages/core/src/local/sources.ts, apps/api/src/local-domain.ts)Fix supersession submission completion (packages/core/src/local/tasks.ts):In review() (around line 545), replace:

completeSubmissions(c, id, mutations);
with:

completeSubmissions(c, id, mutations);
if (v.action === "supersede" && v.replacement_id)
  completeSubmissions(c, v.replacement_id, mutations);
Fix aggregate() rejected-submission state and stale Markdown body (packages/core/src/local/tasks.ts):In aggregate(c: Catalog, sourceId: string, mutations: Mutation[]) (around lines 40–62):Determine whether completed tasks for sourceId actually produced any accepted organization or whether every candidate in their submissions was rejected:

function hasAcceptedOutcome(c: Catalog, sourceId: string, mutations: Mutation[]) {
  const currentSource =
    (mutations.find((m) => m.kind === "source" && m.entity_id === sourceId)?.data as
      | Record<string, unknown>
      | undefined) ?? c.heads.get(`source:${sourceId}`)?.data;
  if (
    (Array.isArray(currentSource?.collection_ids) && currentSource.collection_ids.length > 0) ||
    (Array.isArray(currentSource?.tags) && currentSource.tags.length > 0)
  )
    return true;
  const submissions = [...c.heads.values()].filter(
    (r) => r.kind === "submission" && r.data.source_id === sourceId,
  );
  if (!submissions.length) return true;
  let totalCandidates = 0;
  for (const sub of submissions) {
    const refs = Array.isArray(sub.data.candidate_refs)
      ? (sub.data.candidate_refs as { kind: "memory" | "entity" | "relationship" | "review"; id: string }[])
      : [];
    totalCandidates += refs.length;
    for (const ref of refs) {
      const m = mutations.find((x) => x.kind === ref.kind && x.entity_id === ref.id);
      const status = String(m?.data.status ?? c.heads.get(`${ref.kind}:${ref.id}`)?.data.status ?? "");
      if (["active", "approved", "superseded"].includes(status)) return true;
    }
  }
  return totalCandidates === 0;
}
In aggregate(), compute processing_state:

const processing_state = active.some(
  (t) => t.state === "claimed" && Date.parse(String(t.lease_expires_at)) > Date.now(),
)
  ? "claimed"
  : active.some((t) => t.state === "awaiting_agent" || t.state === "claimed")
    ? "awaiting_agent"
    : active.some((t) => t.state === "submitted")
      ? "review_pending"
      : active.length && hasAcceptedOutcome(c, sourceId, mutations)
        ? "organized"
        : "captured";
When updating an existing source mutation in mutations, regenerate both data and body via sourceMutation:

const existing = mutations.find((m) => m.kind === "source" && m.entity_id === sourceId);
if (existing) {
  const updated = sourceMutation(c, sourceId, {
    ...(existing.data as Partial<import("@atlas/contracts").LocalSource>),
    processing_state,
  });
  existing.data = updated.data;
  existing.body = updated.body;
} else {
  mutations.push(sourceMutation(c, sourceId, { processing_state }));
}
Fix sources.edit() overwriting terminal jobs/tasks (packages/core/src/local/sources.ts):In edit() (around lines 331–348), only fence non-terminal grants, jobs, and tasks for old.id:

for (const r of c.heads.values())
  if (["task", "job", "grant"].includes(r.kind) && r.data.source_version_id === old.id) {
    if (r.kind === "grant" && r.data.revoked !== true)
      mutations.push({
        kind: "grant",
        entity_id: r.entity_id,
        expected_revision: r.revision,
        data: { ...r.data, revoked: true },
        body: "Fenced by source version replacement.",
      });
    else if (
      r.kind === "job" &&
      ["queued", "running"].includes(String(r.data.state))
    )
      mutations.push({
        kind: "job",
        entity_id: r.entity_id,
        expected_revision: r.revision,
        data: { ...r.data, state: "cancelled", lease_digest: null, lease_expires_at: null },
        body: "Fenced by source version replacement.",
      });
    else if (
      r.kind === "task" &&
      ["awaiting_agent", "claimed"].includes(String(r.data.state))
    )
      mutations.push({
        kind: "task",
        entity_id: r.entity_id,
        expected_revision: r.revision,
        data: { ...r.data, state: "superseded", lease_digest: null, lease_expires_at: null },
        body: "Fenced by source version replacement.",
      });
  }
Pass version.pipeline_version in GET /sources/:id (apps/api/src/local-domain.ts):In apps/api/src/local-domain.ts (around line 55), change:

chunks: chunkText(source.id, version.id, version.text),
to:

chunks: chunkText(source.id, version.id, version.text, version.pipeline_version),


## Task F04: Bridge K01/L01 Durable Knowledge with Domain Retrieval, Changes & Agent Auth (packages/core/src/local/retrieval.ts, packages/core/src/local/domain.ts, apps/api/src/local-vault.ts)Include K01 durable knowledge notes in general search/retrieval (packages/core/src/local/retrieval.ts):When retrieve() is called with !options.kind && !options.item_id && !options.related_to && !v.collection_id && !v.memory_types:If c.heads.size < 1000 (or if Owner / Projects directories exist in the vault), load and cache the K01 knowledge notes from await store.vault.snapshot() (caching by store.diagnostics().catalog_rebuilds and invalidating after 2000ms so benchmark loops do not re-walk the filesystem).Filter snap.notes to notes where Boolean(n.knowledge) and !n.archived:For actor.kind === "owner": allow n.effective_state === "active", or allow ["active", "candidate", "superseded"].includes(n.effective_state) when v.include_history is true.For actor.kind === "agent": check canRead / agent capabilities (read capability, and either n.knowledge?.scope === "owner" or agent.project_ids.includes(n.project_id ?? "")) and require n.effective_state === "active".Apply v.project_id filter: if v.project_id is provided, keep notes where n.project_id === v.project_id || n.knowledge?.scope === "owner".Apply options.recent_since and options.recent_until on n.created_at.Score each eligible K01 note using the same lexical tokens / wholeTokens scoring against n.title, n.knowledge.key, n.knowledge.summary, n.knowledge.topics.join(" "), n.knowledge.applies_when, and n.markdown. If query is non-empty, require noteScore > 0.Convert matching K01 notes into retrieval items (id: n.id, type: "knowledge", title: n.title, summary: v.detail === "detailed" ? n.markdown : (n.knowledge?.summary ?? n.markdown), status: n.effective_state, critical: n.knowledge?.type === "constraint", source_refs: []) and merge them into the ranked candidate list alongside domain records before cursor slicing and packContext().Ensure ranks in the trace mutation records origin: "vault_knowledge" (or "lexical_selection") and revisions records n.file_digest ?? null when c.heads.get(...) is absent.Important: Because options.kind is "memory" when supplement() or get_memory calls retrieve(), supplement() and get_memory will continue to return ONLY type === "memory" domain records, preserving tests/mcp/local-domain.test.ts.Include Vault Markdown notes in domain.changes() (packages/core/src/local/domain.ts):In changes(actor: LocalActor) (around line 66 of packages/core/src/local/domain.ts), alongside c.records, read (await store.vault.snapshot()).notes when actor.kind === "owner" (or filter by project_ids for actor.kind === "agent"), map notes with a non-null created_at to:

{
  id: `vault:${n.id}:${n.file_digest ?? "0"}`,
  item_id: n.id,
  kind: n.knowledge ? `knowledge (${n.knowledge.type})` : n.kind,
  title: n.title,
  actor: { kind: n.agent_id ? "agent" : "owner", id: n.agent_id ?? "local-file" },
  at: n.created_at,
  revision: 1,
}
Combine with the mapped c.records events, sort by b.at.localeCompare(a.at), and .slice(0, 100).Allow owner-managed agents with capture_project_knowledge in currentValid (apps/api/src/local-vault.ts):In apps/api/src/local-vault.ts (around lines 31–44), update currentValid:

const currentValid = async (value: string | undefined) => {
  if (!value || !/^atlas_[A-Za-z0-9_-]{43}$/.test(value)) return false;
  if (options.token && timingSafeEqual(hash(value), hash(options.token))) {
    if (options.expiresAt && Date.parse(options.expiresAt) <= Date.now()) return false;
  }
  try {
    const actor = await domain.auth.authenticate(value),
      catalog = await domain.store.catalog();
    const record = catalog.heads.get(`agent:${actor.id}`);
    return (
      Array.isArray(record?.data.capabilities) &&
      record.data.capabilities.includes("capture_project_knowledge")
    );
  } catch {
    return false;
  }
};


## Task F05: Fix Conversation Import UI & Non-UUID Graph Focus (apps/web/src/app/local/LocalWorkspace.tsx, apps/web/src/app/LocalApp.tsx, apps/api/src/local-vault.ts)Fix CapturePanel file input rendering for mode === "conversation" (apps/web/src/app/local/LocalWorkspace.tsx):Around line 232 of apps/web/src/app/local/LocalWorkspace.tsx, change:

) : ["file", "n8n"].includes(mode) ? (
to:

) : ["file", "n8n", "conversation"].includes(mode) ? (
Support non-UUID note IDs (imported-collections, file-<sha256>) in Graph Focus (apps/web/src/app/LocalApp.tsx, apps/api/src/local-vault.ts):Define a safe focus ID validator: z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/).In apps/web/src/app/LocalApp.tsx (line 32), replace:

const focusId = z.uuid().safeParse(params.get("note")).success ? params.get("note") : null;
with:

const focusId = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/).safeParse(params.get("note")).success
  ? params.get("note")
  : null;
In apps/api/src/local-vault.ts (line 77), replace:

...(c.req.query("focus") ? { focus: z.uuid().parse(c.req.query("focus")) } : {}),
with:

...(c.req.query("focus")
  ? { focus: z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/).parse(c.req.query("focus")) }
  : {}),


## Task F06: Regression Tests & Full Verification GateAdd Unit & Integration Regression Tests:In tests/unit/local-vault.test.ts:Assert that calling snapshot() twice on an unchanged vault does not create any .tmp files or modify .atlas/history mtimes on the second read.Assert that GET /api/v1/local/vault?focus=imported-collections&depth=2 returns 200 instead of 400.In tests/unit/local-domain.test.ts:Assert that review(..., "memory", activeId, { action: "supersede", replacement_id, expected_replacement_revision, ... }) transitions the replacement proposal's submission task from "submitted" to "completed" and updates the source's processing_state from "review_pending" to "organized".Assert that rejecting all candidates in a submission transitions the task to "completed" and returns the source's processing_state to "captured" (not "organized"), with record.body matching State: captured.Assert that sources.edit() does not overwrite a "completed" job on the prior version to "cancelled".Assert that K01 durable knowledge saved via vault.capture() is discoverable via retrieval.retrieve(owner, { query: ... }) and appears in domain.changes(owner).In tests/domain-browser/workspace.spec.ts:Add or extend a check verifying that selecting "Select conversation turns (supported JSON)" in Add source material displays the "File to preserve" file input (input[type="file"]).Run Mandatory Verification Commands:

pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm verify:bundle
pnpm test:unit
pnpm test:local
pnpm test:mcp
pnpm test:domain-browser
pnpm exec playwright test --config tests/playwright.local.config.ts
Update Tracking Documentation:Record the completed F01–F06 remediation and exact test counts in docs/PROGRESS.md, docs/ISSUES.md, and docs/SESSION_LOG.md.
