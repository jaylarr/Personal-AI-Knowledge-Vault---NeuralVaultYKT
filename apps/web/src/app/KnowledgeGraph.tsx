import {
  Compass,
  Focus,
  List,
  Maximize2,
  Minimize2,
  Minus,
  Move3D,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Type,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { type CameraCommand, CameraRig, GraphCanvas } from "./neural/GraphCanvas.js";
import { GraphInspector, GraphSettingsPanel, IconButton } from "./neural/GraphPanels.js";
import {
  defaultSettings,
  GraphScene,
  type GraphSettings,
  type SceneStats,
} from "./neural/GraphScene.js";
import { categoryColor } from "./neural/graph-theme.js";
import { parseGraphView } from "./neural/view-state.js";
import {
  bounds,
  LAYOUT_REVISION,
  type Layout,
  type LayoutInput,
  layoutGraph,
} from "./neural/layout.js";
import { adaptVault, type Snapshot, searchNodes, validateGraph, hash } from "./neural/model.js";

function useEnvironment() {
  const [state, setState] = useState(() => ({
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    small: innerWidth < 720,
    visible: !document.hidden,
  }));
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setState({ reduced: media.matches, small: innerWidth < 720, visible: !document.hidden });
    media.addEventListener("change", update);
    window.addEventListener("resize", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return state;
}
function readSettings(): GraphSettings {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem("atlas-neural-settings") ?? "null");
    if (!saved || typeof saved !== "object") return defaultSettings;
    const next = { ...defaultSettings };
    for (const key of ["brightness", "connections", "bloom", "speed", "pulse"] as const) {
      const v: unknown = Reflect.get(saved, key);
      if (typeof v === "number" && Number.isFinite(v)) next[key] = Math.max(0, Math.min(2, v));
    }
    for (const key of ["zaps", "autoRotate", "reduced"] as const) {
      const v: unknown = Reflect.get(saved, key);
      if (typeof v === "boolean") next[key] = v;
    }
    const q: unknown = Reflect.get(saved, "quality");
    const depth: unknown = Reflect.get(saved, "depth");
    if (typeof depth === "number" && [1, 2, 3].includes(depth)) next.depth = depth;
    if (q === "auto" || q === "high" || q === "medium" || q === "low") next.quality = q;
    return next;
  } catch {
    return defaultSettings;
  }
}

export function KnowledgeGraph({
  data,
  select,
  selected,
  onOpen,
  view = "knowledge",
  changeView,
  expandNeighborhood,
  neighborhoodDepth = 1,
}: {
  data: Snapshot;
  select: (id: string) => void;
  selected: string;
  onOpen?: () => void;
  view?: string | null;
  changeView?: (value: string) => void;
  expandNeighborhood?: (() => void) | undefined;
  neighborhoodDepth?: 1 | 2;
}) {
  const { graph, index } = useMemo(() => validateGraph(adaptVault(data)), [data]);
  const viewStorageKey = `atlas-view:${hash(data.vault_root)}:${LAYOUT_REVISION}`;
  const [initialView] = useState(() => {
    try {
      return parseGraphView(localStorage.getItem(viewStorageKey));
    } catch {
      return parseGraphView(null);
    }
  });
  const viewState = useRef(initialView);
  const env = useEnvironment(),
    [settings, setSettings] = useState(readSettings),
    [paused, setPaused] = useState(false),
    [hidden, setHidden] = useState<Set<string>>(() => new Set(initialView.hidden)),
    [typeFilter, setTypeFilter] = useState(initialView.type),
    [reviewFilter, setReviewFilter] = useState(initialView.review),
    [evidenceOnly, setEvidenceOnly] = useState(initialView.evidence),
    [hovered, setHovered] = useState(""),
    [query, setQuery] = useState(""),
    [listOpen, setListOpen] = useState(false),
    [resultIndex, setResultIndex] = useState(0),
    [panel, setPanel] = useState<"filters" | "settings" | null>(null),
    [showLabels, setShowLabels] = useState(true),
    [pan, setPan] = useState(false),
    [expanded, setExpanded] = useState(false),
    [lost, setLost] = useState(false),
    [generation, setGeneration] = useState(0),
    [positions, setPositions] = useState<Layout>({}),
    [layoutPending, setLayoutPending] = useState(true),
    [stats, setStats] = useState<SceneStats | null>(null),
    [autoQuality, setAutoQuality] = useState<"high" | "medium" | "low">("high"),
    [trace, setTrace] = useState(0),
    [host, setHost] = useState<HTMLElement | null>(null),
    [labels, setLabels] = useState<HTMLDivElement | null>(null);
  const layoutStorageKey = `atlas-layout:${hash(data.vault_root)}:${LAYOUT_REVISION}`;
  const [initialLayout] = useState(() => readSavedLayout(layoutStorageKey)),
    firstLayout = useRef(true);
  const prior = useRef({ revision: LAYOUT_REVISION, positions: initialLayout });
  if (prior.current.revision !== LAYOUT_REVISION)
    prior.current = { revision: LAYOUT_REVISION, positions: {} };
  const controls = useRef<OrbitControls | null>(null),
    searchRef = useRef<HTMLInputElement>(null),
    expandRef = useRef<HTMLButtonElement>(null),
    slow = useRef(0);
  const [command, setCommand] = useState<CameraCommand>({ kind: "fit", radius: 15, serial: 0 });
  const reduced = env.reduced || settings.reduced;
  const quality =
    settings.quality === "auto"
      ? env.small || graph.nodes.length > 3000
        ? "low"
        : graph.nodes.length > 1000
          ? "medium"
          : autoQuality
      : settings.quality;
  const frame = useMemo(() => bounds(positions), [positions]);
  const active = index.nodes.get(selected),
    hover = index.nodes.get(hovered);
  const results = useMemo(() => searchNodes(graph.nodes, query), [graph, query]);
  const saveCamera = useCallback(() => {
    const c = controls.current;
    if (!c) return;
    viewState.current = {
      ...viewState.current,
      camera: { position: c.object.position.toArray(), target: c.target.toArray() },
    };
    try {
      localStorage.setItem(viewStorageKey, JSON.stringify(viewState.current));
    } catch {
      /* Optional view state. */
    }
  }, [viewStorageKey]);
  const setControls = useCallback(
    (c: OrbitControls | null) => {
      controls.current?.removeEventListener("end", saveCamera);
      controls.current = c;
      c?.addEventListener("end", saveCamera);
    },
    [saveCamera],
  );
  useEffect(() => {
    window.addEventListener("pagehide", saveCamera);
    return () => window.removeEventListener("pagehide", saveCamera);
  }, [saveCamera]);
  useEffect(() => {
    viewState.current = {
      ...viewState.current,
      hidden: [...hidden],
      type: typeFilter,
      review: reviewFilter,
      evidence: evidenceOnly,
    };
    try {
      localStorage.setItem(viewStorageKey, JSON.stringify(viewState.current));
    } catch {
      /* Optional view state. */
    }
  }, [hidden, typeFilter, reviewFilter, evidenceOnly, viewStorageKey]);
  const filteredHidden = useMemo(
    () =>
      new Set([
        ...hidden,
        ...graph.nodes
          .filter(
            (n) =>
              (typeFilter !== "all" && n.type !== typeFilter) ||
              (evidenceOnly && !n.source?.domain_evidence?.length) ||
              (reviewFilter === "agent_recorded" && !n.source?.knowledge) ||
              (reviewFilter === "active" && n.source?.domain_status !== "active") ||
              (reviewFilter === "proposed" && n.source?.domain_status !== "proposed") ||
              (reviewFilter === "stale" && !n.source?.modified_since_capture),
          )
          .map((n) => n.id),
      ]),
    [hidden, graph.nodes, typeFilter, reviewFilter, evidenceOnly],
  );
  const updateStats = useCallback(
    (s: SceneStats) => {
      setStats(s);
      if (!paused && !reduced && env.visible && s.fps > 0 && s.fps < 26) {
        slow.current++;
        if (slow.current >= 3) {
          setAutoQuality((q) => (q === "high" ? "medium" : "low"));
          slow.current = 0;
        }
      } else slow.current = 0;
    },
    [paused, reduced, env.visible],
  );
  useEffect(() => {
    try {
      localStorage.setItem("atlas-neural-settings", JSON.stringify(settings));
    } catch {
      /* Storage may be disabled. */
    }
  }, [settings]);
  const layoutKey = useMemo(
    () =>
      JSON.stringify({
        sample: graph.sample,
        nodes: graph.nodes
          .map((n) => ({
            id: n.id,
            categoryId: n.categoryId,
            importance: n.importance,
            type: n.type,
            position: n.position,
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        edges: [...graph.edges].sort((a, b) => a.id.localeCompare(b.id)),
      }),
    [graph],
  );
  const layoutInput = useMemo(() => JSON.parse(layoutKey) as LayoutInput, [layoutKey]);
  useEffect(() => {
    setLayoutPending(true);
    const started = performance.now();
    let cancelled = false;
    const initial = firstLayout.current;
    const finish = (value: Layout) => {
      if (cancelled) return;
      firstLayout.current = false;
      prior.current.positions = { ...prior.current.positions, ...value };
      setPositions(value);
      if (!graph.sample && Object.keys(value).length <= 1000)
        try {
          localStorage.setItem(
            layoutStorageKey,
            JSON.stringify({ revision: LAYOUT_REVISION, positions: value }),
          );
        } catch {
          /* Layout persistence is optional. */
        }
      setLayoutPending(false);
      if (host) host.dataset.layoutMs = String(Math.round(performance.now() - started));
      if (initial) {
        const b = bounds(value);
        const camera = initialView.camera;
        setCommand((c) =>
          camera
            ? {
                kind: "restore",
                point: camera.target,
                position: camera.position,
                serial: c.serial + 1,
              }
            : {
                kind: "fit",
                point: b.center,
                radius: b.radius,
                serial: c.serial + 1,
              },
        );
      }
    };
    const payload = layoutInput;
    if (layoutInput.nodes.length > 200) {
      const worker = new Worker(new URL("./neural/layout.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<Layout>) => finish(event.data);
      worker.onerror = () => {
        setLayoutPending(false);
        setLost(true);
      };
      worker.postMessage({ graph: payload, prior: prior.current.positions });
      return () => {
        cancelled = true;
        worker.terminate();
      };
    }
    finish(layoutGraph(payload, prior.current.positions));
    return () => {
      cancelled = true;
    };
    // Content edits do not change the layout signature.
  }, [layoutInput, host, graph.sample, layoutStorageKey, initialView.camera]);
  const choose = useCallback(
    (id: string) => {
      select(id);
      setTrace((t) => t + 1);
      const p = positions[id];
      if (p) setCommand((c) => ({ kind: "reveal", point: p, serial: c.serial + 1 }));
    },
    [select, positions],
  );
  const focus = useCallback(
    (id: string) => {
      const p = positions[id];
      if (p) setCommand((c) => ({ kind: "focus", point: p, serial: c.serial + 1 }));
    },
    [positions],
  );
  const find = useCallback(
    (id: string) => {
      choose(id);
      setHidden((previous) => {
        const next = new Set(previous);
        next.delete(index.nodes.get(id)?.categoryId ?? "");
        return next;
      });
      focus(id);
      setListOpen(false);
      setQuery("");
    },
    [choose, focus, index],
  );
  const fit = useCallback(
    () =>
      setCommand((c) => ({
        kind: "fit",
        point: frame.center,
        radius: frame.radius,
        serial: c.serial + 1,
      })),
    [frame],
  );
  const reset = useCallback(
    () =>
      setCommand((c) => ({
        kind: "reset",
        point: frame.center,
        radius: frame.radius,
        serial: c.serial + 1,
      })),
    [frame],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanel(null);
        setListOpen(false);
        if (expanded) {
          setExpanded(false);
          expandRef.current?.focus();
        } else if (selected) choose("");
      }
      if (
        (e.key === "/" && !(e.target instanceof HTMLInputElement)) ||
        ((e.ctrlKey || e.metaKey) && e.key === "k")
      ) {
        e.preventDefault();
        searchRef.current?.focus();
        setListOpen(true);
      }
      if (e.key.toLowerCase() === "r" && !(e.target instanceof HTMLInputElement)) reset();
      if (
        !(e.target instanceof HTMLInputElement) &&
        (e.key === "+" || e.key === "=" || e.key === "-")
      ) {
        e.preventDefault();
        setCommand((c) => ({
          kind: "zoom",
          factor: e.key === "-" ? 1 / 1.2 : 1.2,
          serial: c.serial + 1,
        }));
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [expanded, selected, choose, reset]);
  const labelNodes = useMemo(() => {
    const ids = new Set<string>();
    if (selected) ids.add(selected);
    if (hovered) ids.add(hovered);
    if (showLabels) {
      for (const n of [...graph.nodes].sort((a, b) => b.importance - a.importance)) {
        if (ids.size >= Math.min(10, Math.max(3, graph.nodes.length))) break;
        ids.add(n.id);
      }
    }
    return [...ids].map((id) => index.nodes.get(id)).filter((n) => n !== undefined);
  }, [selected, hovered, showLabels, graph, index]);
  const onLost = useCallback(() => setLost(true), []),
    onRestore = useCallback(() => {
      setLost(false);
      setGeneration((n) => n + 1);
    }, []);
  const fallback = (
    <div className="neural-fallback" role="status">
      <Compass size={24} />
      <strong>3D view is unavailable</strong>
      <p>Your files remain accessible through search and the list.</p>
      <button type="button" onClick={() => setListOpen(true)}>
        Browse knowledge
      </button>
      <button type="button" onClick={onRestore}>
        Retry 3D view
      </button>
    </div>
  );
  return (
    <section
      ref={setHost}
      className={`neural-graph spatial-graph${expanded ? " is-expanded" : ""}${active ? " has-inspector" : ""}`}
      aria-label="Knowledge graph"
      data-quality={quality}
      data-motion={reduced ? "reduced" : paused ? "paused" : "running"}
      data-trace={trace}
    >
      <div className="neural-stage graph-viewport" data-testid="neural-stage">
        {!layoutPending && (
          <GraphCanvas
            key={generation}
            quality={quality}
            running={!paused && !reduced && env.visible && !lost}
            fallback={fallback}
            onLost={onLost}
            onRestore={onRestore}
          >
            <CameraRig
              command={command}
              radius={frame.radius}
              reduced={reduced}
              pan={pan}
              rotate={
                settings.autoRotate &&
                !paused &&
                env.visible &&
                !selected &&
                !query &&
                !listOpen &&
                !panel
              }
              onControls={setControls}
            />
            <GraphScene
              graph={graph}
              index={index}
              positions={positions}
              selected={selected}
              hovered={hovered}
              hidden={filteredHidden}
              settings={settings}
              quality={quality}
              paused={paused || !env.visible}
              reduced={reduced}
              trace={trace}
              onSelect={choose}
              onHover={setHovered}
              onFocus={focus}
              onStats={updateStats}
              labels={labels}
              host={host}
            />
          </GraphCanvas>
        )}
        {layoutPending && (
          <div className="neural-fallback" role="status">
            Preparing knowledge layout…
          </div>
        )}
        {lost && <div className="neural-context-fallback">{fallback}</div>}
        <div className="neural-labels" ref={setLabels}>
          {labelNodes.map((n) => (
            <button
              type="button"
              key={n.id}
              data-label-id={n.id}
              data-node-id={n.id}
              className={selected === n.id ? "is-selected" : ""}
              onClick={() => choose(n.id)}
              onDoubleClick={() => focus(n.id)}
              title={`${n.title} · ${n.categoryId}`}
            >
              <span />
              {n.title}
            </button>
          ))}
        </div>
        {graph.nodes.length === 0 && !layoutPending && (
          <div className="neural-empty">
            <h2>No files in this view</h2>
            <p>Choose another view or add linked Markdown to your vault.</p>
          </div>
        )}
      </div>
      <header className="neural-header">
        <div className="neural-identity">
          <Move3D size={19} />
          <div>
            <h2>Knowledge graph</h2>
            <span>
              {graph.nodes.length} files · {graph.edges.length} connections
            </span>
          </div>
        </div>
        <div className="neural-search">
          <Search size={16} />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search knowledge graph"
            placeholder="Search knowledge…"
            value={query}
            onFocus={() => setListOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setResultIndex(0);
              setListOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setResultIndex((i) => Math.min(results.length - 1, i + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setResultIndex((i) => Math.max(0, i - 1));
              }
              const result = results[resultIndex];
              if (e.key === "Enter" && result) find(result.id);
            }}
            aria-controls="neural-results"
          />
          <kbd>/</kbd>
        </div>
        <div className="neural-header-actions">
          <IconButton
            label="Browse knowledge"
            pressed={listOpen}
            onClick={() => setListOpen((v) => !v)}
          >
            <List size={18} />
          </IconButton>
          <IconButton
            label="Graph settings"
            pressed={panel === "settings"}
            onClick={() => setPanel((p) => (p === "settings" ? null : "settings"))}
          >
            <Settings2 size={18} />
          </IconButton>
          <button
            type="button"
            ref={expandRef}
            title={expanded ? "Exit expanded graph" : "Expand graph"}
            aria-label={expanded ? "Exit expanded graph" : "Expand graph"}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </header>
      <div className="neural-left">
        <button
          type="button"
          aria-label="Filter categories"
          aria-expanded={panel === "filters"}
          onClick={() => setPanel((p) => (p === "filters" ? null : "filters"))}
        >
          <SlidersHorizontal size={17} />
        </button>
        {changeView && (
          <select
            aria-label="Knowledge view"
            value={view ?? "knowledge"}
            onChange={(e) => changeView(e.target.value)}
          >
            <option value="knowledge">Knowledge</option>
            <option value="activity">Activity</option>
            <option value="all">All files</option>
          </select>
        )}
      </div>
      {listOpen && (
        <section
          className="neural-results neural-panel"
          id="neural-results"
          aria-label="Knowledge search results"
        >
          <div className="neural-panel-heading">
            <strong>{query ? `${results.length} matches` : "Knowledge files"}</strong>
            <IconButton label="Close search" onClick={() => setListOpen(false)}>
              <X size={16} />
            </IconButton>
          </div>
          <ul>
            {results.slice(0, 100).map((n, i) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={i === resultIndex ? "is-current" : ""}
                  onClick={() => find(n.id)}
                >
                  <span
                    className="neural-result-dot"
                    style={{
                      background: categoryColor(n.categoryId),
                    }}
                  />
                  <span>
                    <strong>{n.title}</strong>
                    <small>
                      {n.categoryId} · {n.type}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {results.length === 0 && <p>No matching knowledge. Try a title, tag or summary.</p>}
          {results.length > 100 && <p>Showing 100 results. Refine your search.</p>}
        </section>
      )}
      {panel === "filters" && (
        <aside className="neural-filter-panel neural-panel" aria-label="Category filters">
          <div className="neural-panel-heading">
            <strong>Categories</strong>
            <IconButton label="Close filters" onClick={() => setPanel(null)}>
              <X size={16} />
            </IconButton>
          </div>
          <label className="neural-filter-field">
            Item type
            <select
              aria-label="Graph item type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="all">All types</option>
              {[...new Set(graph.nodes.map((n) => n.type))].sort().map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="neural-filter-field">
            Review state
            <select
              aria-label="Graph review state"
              value={reviewFilter}
              onChange={(event) => {
                setReviewFilter(event.target.value as typeof reviewFilter);
                if (["proposed", "stale"].includes(event.target.value) && view !== "all")
                  changeView?.("all");
              }}
            >
              <option value="all">All states</option>
              <option value="active">Owner reviewed</option>
              <option value="proposed">Proposed</option>
              <option value="stale">Stale evidence</option>
              <option value="agent_recorded">Agent recorded</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={evidenceOnly}
              onChange={(event) => setEvidenceOnly(event.target.checked)}
            />{" "}
            Has exact source evidence
          </label>
          {index.categories.map((category) => (
            <label key={category}>
              <input
                type="checkbox"
                checked={!hidden.has(category)}
                onChange={() =>
                  setHidden((previous) => {
                    const next = new Set(previous);
                    if (next.has(category)) next.delete(category);
                    else next.add(category);
                    return next;
                  })
                }
              />
              <span style={{ background: categoryColor(category) }} />
              {category}
              <small>{graph.nodes.filter((n) => n.categoryId === category).length}</small>
            </label>
          ))}
          <button type="button" onClick={() => setHidden(new Set())}>
            Show all categories
          </button>
          {selected && expandNeighborhood && (
            <button type="button" disabled={neighborhoodDepth === 2} onClick={expandNeighborhood}>
              {neighborhoodDepth === 2
                ? "Two-hop neighborhood loaded"
                : "Load two hops around selected item"}
            </button>
          )}
          <p>
            {index.isolated} isolated · {index.components} components
            <br />
            Positions stay fixed when filtering.
          </p>
        </aside>
      )}
      {panel === "settings" && (
        <GraphSettingsPanel
          settings={settings}
          update={setSettings}
          quality={quality}
          stats={stats}
          reduced={reduced}
          systemReduced={env.reduced}
          close={() => setPanel(null)}
        />
      )}
      {active && (
        <GraphInspector
          node={active}
          graph={graph}
          index={index}
          close={() => choose("")}
          focus={() => focus(selected)}
          trace={() => setTrace((t) => t + 1)}
          find={find}
          onOpen={onOpen}
        />
      )}
      {hover && !active && (
        <div className="neural-hover" role="status">
          <strong>{hover.title}</strong>
          <span>{hover.categoryId}</span>
        </div>
      )}
      <div className="neural-bottom">
        <div
          className="neural-controls spatial-controls"
          role="toolbar"
          aria-label="Graph navigation"
        >
          <IconButton label="Reset view" onClick={reset}>
            <RotateCcw size={17} />
          </IconButton>
          <IconButton label="Fit graph" onClick={fit}>
            <Focus size={17} />
          </IconButton>
          <span className="neural-divider" />
          <IconButton label="Orbit graph" pressed={!pan} onClick={() => setPan(false)}>
            <Move3D size={17} />
          </IconButton>
          <IconButton label="Pan graph" pressed={pan} onClick={() => setPan(true)}>
            <Compass size={17} />
          </IconButton>
          <IconButton
            label="Zoom out"
            onClick={() =>
              setCommand((c) => ({ kind: "zoom", factor: 1 / 1.2, serial: c.serial + 1 }))
            }
          >
            <Minus size={17} />
          </IconButton>
          <IconButton
            label="Zoom in"
            onClick={() => setCommand((c) => ({ kind: "zoom", factor: 1.2, serial: c.serial + 1 }))}
          >
            <Plus size={17} />
          </IconButton>
          <span className="neural-divider" />
          <IconButton
            label={paused ? "Resume animation" : "Pause animation"}
            pressed={paused}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <Play size={17} /> : <Pause size={17} />}
          </IconButton>
          <IconButton
            label="Toggle labels"
            pressed={showLabels}
            onClick={() => setShowLabels((v) => !v)}
          >
            <Type size={17} />
          </IconButton>
          <IconButton
            label="Toggle connection pulses"
            pressed={settings.pulse > 0}
            onClick={() => setSettings((s) => ({ ...s, pulse: s.pulse > 0 ? 0 : 1 }))}
          >
            <Zap size={17} />
          </IconButton>
        </div>
        <div className="neural-help">
          Drag to orbit · Scroll to zoom · Double-click to focus
          <span>
            {reduced ? "Reduced motion" : paused ? "Animation paused" : `${quality} quality`}
          </span>
        </div>
      </div>
      {index.warnings.length > 0 && (
        <div className="neural-validation" role="status">
          {index.warnings.length} graph data notices; invalid relations omitted.
        </div>
      )}
    </section>
  );
}

function readSavedLayout(key: string): Layout {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw.length > 262144) return {};
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Reflect.get(value, "revision") !== LAYOUT_REVISION)
      return {};
    const positions: unknown = Reflect.get(value, "positions");
    if (
      !positions ||
      typeof positions !== "object" ||
      Array.isArray(positions) ||
      Object.keys(positions).length > 1000
    )
      return {};
    const result: Layout = {};
    for (const [id, p] of Object.entries(positions))
      if (
        Array.isArray(p) &&
        p.length === 3 &&
        p.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 100000)
      )
        result[id] = [p[0], p[1], p[2]];
    return result;
  } catch {
    return {};
  }
}
