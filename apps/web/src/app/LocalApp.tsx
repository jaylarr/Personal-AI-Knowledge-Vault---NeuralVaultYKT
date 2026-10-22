import { localSnapshotSchema, z } from "@atlas/contracts";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  FolderOpen,
  Layers3,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";

const KnowledgeGraph = lazy(() =>
  import("./KnowledgeGraph.js").then((module) => ({ default: module.KnowledgeGraph })),
);
const LocalWorkspace = lazy(() =>
  import("./local/LocalWorkspace.js").then((m) => ({ default: m.LocalWorkspace })),
);
const PersonalWorkspace = lazy(() =>
  import("./personal/PersonalWorkspace.js").then((m) => ({ default: m.PersonalWorkspace })),
);
export function LocalApp() {
  const location = useLocation(),
    navigate = useNavigate(),
    [params, setParams] = useSearchParams(),
    [query, setQuery] = useState(""),
    [copied, setCopied] = useState(false),
    [readerOpen, setReaderOpen] = useState(false),
    [graphLimit, setGraphLimit] = useState(500),
    [graphDepth, setGraphDepth] = useState<1 | 2>(1);
  const focusId = z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9._:-]+$/)
    .safeParse(params.get("note")).success
    ? params.get("note")
    : null;
  const snapshot = useQuery({
    queryKey: ["local-vault", graphLimit, params.get("view") === "all", focusId, graphDepth],
    queryFn: async ({ signal }) => {
      const r = await fetch(
        `/api/v1/local/vault?limit=${graphLimit}&depth=${graphDepth}&proposals=${params.get("view") === "all" ? 1 : 0}${focusId ? `&focus=${focusId}` : ""}`,
        { signal, cache: "no-store" },
      );
      if (!r.ok) throw Error("Local folder could not be read. Refresh the app and try again.");
      return localSnapshotSchema.parse(await r.json());
    },
    refetchInterval: 4000,
    placeholderData: (previous) => previous,
  });
  const data = snapshot.isError ? undefined : snapshot.data,
    selected = data?.notes.find((n) => n.id === params.get("note")),
    isGraph = location.pathname === "/graph";
  const isPersonal = ["/", "/personal", "/skills", "/coverage", "/personal/review"].includes(
    location.pathname,
  );
  const requestedView = params.get("view");
  const domainModes: Record<string, string> = {
    "/sources": "sources",
    "/inbox": "inbox",
    "/review": "review",
    "/agents": "agents",
    "/organization": "organization",
    "/activity": "activity",
    "/backup": "backup",
    "/search": "search",
  };
  const domainMode =
    location.pathname === "/inbox" && requestedView === "all"
      ? undefined
      : domainModes[location.pathname];
  const view = ["knowledge", "activity", "all"].includes(requestedView ?? "")
    ? requestedView
    : ["/inbox", "/files"].includes(location.pathname)
      ? "all"
      : "knowledge";
  const visible = useMemo(
    () =>
      data?.notes.filter(
        (n) =>
          !n.archived &&
          (view === "all" || (!n.personal_kind && !n.personal_suppressed)) &&
          (view === "all" ||
            (view === "activity"
              ? !n.knowledge && !["project", "catalog"].includes(n.kind)
              : n.kind === "project" ||
                n.path === "Owner/Context.md" ||
                n.effective_state === "active")),
      ) ?? [],
    [data, view],
  );
  const visibleIds = useMemo(() => new Set(visible.map((n) => n.id)), [visible]);
  const graphData = useMemo(
    () =>
      data
        ? {
            ...data,
            notes: visible,
            edges: data.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
          }
        : undefined,
    [data, visible, visibleIds],
  );
  const notes = visible.filter(
    (n) =>
      !n.archived &&
      `${n.title} ${n.markdown} ${n.path}`.toLowerCase().includes(query.toLowerCase()),
  );
  const select = (id: string) => {
    if (id !== params.get("note")) setGraphDepth(1);
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("note", id);
      return next;
    });
  };
  const changeView = (value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("view", value);
      return next;
    });
  const nav = [
    { to: "/", label: "Personal context", icon: Layers3 },
    { to: "/skills", label: "Reusable skills", icon: FileText },
    { to: "/coverage", label: "Session coverage", icon: ShieldCheck },
    { to: "/personal/review", label: "Unconfirmed patterns", icon: ShieldCheck },
    { to: "/capture", label: "Capture source", icon: FileText },
    { to: "/graph", label: "Knowledge graph", icon: Network },
    { to: "/inbox", label: "Inbox", icon: FileText },
    { to: "/sources", label: "Sources", icon: FileText },
    { to: "/search", label: "Search knowledge", icon: Search },
    { to: "/review", label: "Review", icon: ShieldCheck },
    { to: "/files", label: "All notes", icon: FileText },
    { to: "/agents", label: "Agents", icon: ShieldCheck },
    { to: "/organization", label: "Projects & collections", icon: Layers3 },
    { to: "/activity", label: "Changes", icon: FileText },
    { to: "/backup", label: "Backup & restore", icon: FolderOpen },
    { to: "/setup", label: "Vault folder", icon: FolderOpen },
  ];
  return (
    <div className={`workspace local-workspace${isGraph ? " graph-workspace" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Workspace navigation">
        <NavLink to="/" className="brand" aria-label="ATLAS home">
          <span className="brand-mark">
            <Network size={20} />
          </span>
          <span>
            ATLAS<span className="brand-subtitle">Local knowledge</span>
          </span>
        </NavLink>
        <div className="workspace-label">
          <span className="owner-mark">A</span>
          <span>
            Your vault<small>Markdown on this PC</small>
          </span>
        </div>
        <span className="section-label">WORKSPACE</span>
        <nav>
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              title={label}
              end
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={17} />
          <p>
            One folder you own.
            <br />
            <span>No cloud sync enabled.</span>
          </p>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <div className="breadcrumb">
            <NavLink to="/">Your vault</NavLink> <span>›</span>{" "}
            {isGraph ? "Knowledge graph" : "Local files"}
          </div>
          <span className="local-status">
            <span /> Local files
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <section className="main-heading">
            <div>
              <p className="eyebrow">PERSONAL KNOWLEDGE</p>
              <h1>
                {isPersonal
                  ? "Your personal working knowledge"
                  : isGraph
                    ? "Your knowledge graph"
                    : domainMode
                      ? {
                          sources: "Your source material",
                          inbox: "Your source Inbox",
                          review: "Review source-backed knowledge",
                          search: "Search local knowledge",
                          agents: "Your local agents",
                          organization: "Projects and collections",
                          activity: "Your local changes",
                          backup: "Your backup and recovery",
                        }[domainMode]
                      : location.pathname === "/setup"
                        ? "Your vault folder"
                        : "Your local knowledge vault"}
              </h1>
              <p className="intro">Your agents and this app use the same Markdown files.</p>
            </div>
            <button type="button" className="refresh-vault" onClick={() => void snapshot.refetch()}>
              <RefreshCw size={16} /> Refresh files
            </button>
          </section>
          {snapshot.isPending && <p role="status">Reading your local vault…</p>}
          {snapshot.isError && <p role="alert">{snapshot.error.message}</p>}
          {data && domainMode && (
            <Suspense fallback={<p role="status">Opening source workspace…</p>}>
              <LocalWorkspace mode={domainMode} />
            </Suspense>
          )}
          {data && isPersonal && (
            <Suspense fallback={<p role="status">Opening personal workspace…</p>}>
              <PersonalWorkspace />
            </Suspense>
          )}
          {data && location.pathname === "/capture" && (
            <Suspense fallback={<p role="status">Preparing source capture…</p>}>
              <LocalWorkspace mode="capture" />
            </Suspense>
          )}
          {data && !domainMode && !isPersonal && (
            <>
              <fieldset className="knowledge-filters">
                <legend className="sr-only">Knowledge view</legend>
                {(
                  [
                    ["knowledge", "Knowledge"],
                    ["activity", "Activity"],
                    ["all", "All files"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={`knowledge-filter-button${view === value ? " is-active" : ""}`}
                    aria-pressed={view === value}
                    onClick={() => changeView(value)}
                  >
                    {label}
                  </button>
                ))}
              </fieldset>
              {isGraph && data.truncated && (
                <div className="domain-actions">
                  <p>Showing a bounded graph. Sources and search cover the full catalog.</p>
                  <button
                    type="button"
                    disabled={graphLimit >= 1000 || snapshot.isFetching}
                    onClick={() => setGraphLimit(1000)}
                  >
                    Expand graph to 1,000 items
                  </button>
                </div>
              )}
              {isGraph && graphData && (
                <Suspense fallback={<p role="status">Preparing 3D view…</p>}>
                  <KnowledgeGraph
                    data={graphData}
                    select={select}
                    selected={selected?.id ?? ""}
                    view={view}
                    changeView={changeView}
                    neighborhoodDepth={graphDepth}
                    expandNeighborhood={focusId ? () => setGraphDepth(2) : undefined}
                    onOpen={() => {
                      if (selected?.domain_kind === "source")
                        navigate(`/sources?source=${selected.id}`);
                      else if (["memory", "entity"].includes(selected?.domain_kind ?? ""))
                        navigate(`/review?item=${selected?.id}`);
                      else setReaderOpen(true);
                    }}
                  />
                </Suspense>
              )}
              <section className="vault-location">
                <FolderOpen size={18} />
                <div>
                  <strong>Vault folder</strong>
                  <p data-testid="vault-root">{data.vault_root}</p>
                  <span className="muted">
                    Open this folder in Obsidian or any editor. Changes appear here automatically.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(data.vault_root).then(() => setCopied(true));
                  }}
                >
                  {copied ? "Copied" : "Copy path"}
                </button>
              </section>
              {isGraph && readerOpen && (
                <button
                  type="button"
                  className="graph-reader-close"
                  onClick={() => setReaderOpen(false)}
                >
                  Close file reader
                </button>
              )}
              <div
                className={`local-vault-grid${isGraph ? ` graph-file-panel${readerOpen ? " is-open" : ""}` : ""}`}
              >
                <section className="local-file-list" aria-label="Vault files">
                  <div className="file-list-heading">
                    <h2>{isGraph ? "Files in the graph" : "Projects and notes"}</h2>
                    <span className="muted">{visible.length} files</span>
                  </div>
                  <label className="vault-search">
                    <Search size={16} />
                    <span className="sr-only">Search local files</span>
                    <input
                      type="search"
                      placeholder="Search local files"
                      aria-label="Search local files"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <ul>
                    {notes.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => select(n.id)}
                          aria-pressed={selected?.id === n.id}
                        >
                          <span className="file-kind">
                            {n.knowledge
                              ? `${n.knowledge.scope} · ${n.knowledge.type.replace("_", " ")} · ${n.effective_state}`
                              : n.kind === "project"
                                ? "PROJECT"
                                : n.kind === "catalog"
                                  ? "CATALOG"
                                  : `LEGACY · ${n.kind.toUpperCase()}`}
                          </span>
                          <strong>{n.title}</strong>
                          <small>{n.path}</small>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {notes.length === 0 && (
                    <p className="muted">
                      {query
                        ? "No matching files."
                        : "No durable knowledge in this view yet. Activity and All files preserve earlier notes; agents save useful subjects as they learn them."}
                    </p>
                  )}
                </section>
                <section className="local-note-view" aria-label="Selected file">
                  {selected ? (
                    <>
                      <p className="eyebrow">
                        {selected.status === "agent_recorded" ? "AGENT RECORDED" : "LOCAL FILE"}
                      </p>
                      <h2>{selected.title}</h2>
                      <p className="note-file-path">{selected.path}</p>
                      {selected.domain_kind && (
                        <p className="knowledge-details">
                          {selected.domain_kind} · {selected.domain_status?.replaceAll("_", " ")} ·{" "}
                          <NavLink
                            to={
                              selected.domain_kind === "source"
                                ? `/sources?source=${selected.id}`
                                : "/review"
                            }
                          >
                            Open source details and evidence
                          </NavLink>
                        </p>
                      )}
                      {!visibleIds.has(selected.id) && (
                        <p className="muted">
                          This file is outside the current filter. It remains readable in All files.
                        </p>
                      )}
                      {selected.knowledge && (
                        <div className="knowledge-details">
                          <p className="file-kind">
                            {selected.knowledge.scope} · {selected.knowledge.type.replace("_", " ")}{" "}
                            · {selected.effective_state}
                          </p>
                          <p>
                            <strong>Summary</strong> {selected.knowledge.summary}
                          </p>
                          <p>
                            <strong>Applies when</strong> {selected.knowledge.applies_when}
                          </p>
                          {selected.knowledge.rationale && (
                            <p>
                              <strong>Reason</strong> {selected.knowledge.rationale}
                            </p>
                          )}
                          {selected.knowledge.exceptions.length > 0 && (
                            <div>
                              <strong>Exceptions</strong>
                              <ul>
                                {selected.knowledge.exceptions.map((e) => (
                                  <li key={e}>{e}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <p>
                            <strong>Evidence basis</strong>{" "}
                            {selected.knowledge.basis.replaceAll("_", " ")}
                          </p>
                          {selected.knowledge.source_statement && (
                            <p>{selected.knowledge.source_statement}</p>
                          )}
                          <p className="muted">
                            Dated evidence, not instructions or permission. Current owner/project
                            instructions take precedence.
                          </p>
                        </div>
                      )}
                      {selected.modified_since_capture && (
                        <p className="muted">
                          Edited directly since capture. The file is the source of truth.
                        </p>
                      )}
                      <pre className="checkpoint-body">{selected.markdown}</pre>
                      {selected.provenance.verification && (
                        <div className="note-evidence">
                          <strong>Verification</strong>
                          <p>{selected.provenance.verification}</p>
                          {selected.provenance.paths.length > 0 && (
                            <p className="muted">
                              Evidence: {selected.provenance.paths.join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="note-empty">
                      <Network size={28} />
                      <h2>
                        {isGraph ? "Explore a connection" : "Knowledge kept between sessions"}
                      </h2>
                      <p>
                        Select a file{isGraph ? " or graph node" : ""} to read it. Agents can create
                        projects, add notes and link related knowledge without manual forms.
                      </p>
                      <NavLink to="/graph">Open knowledge graph</NavLink>
                    </div>
                  )}
                </section>
              </div>
              {(data.warnings.length > 0 || data.truncated) && (
                <details className="vault-warnings">
                  <summary>
                    {data.warnings.length} file/link notices
                    {data.truncated ? " · scan limit reached" : ""}
                  </summary>
                  <p>Files are preserved. Unresolved links do not create inferred facts.</p>
                  <ul>
                    {[...new Set(data.warnings)].map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
          <footer>
            <span>ATLAS / LOCAL MARKDOWN VAULT</span>
            <span>Files are the source of truth</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
