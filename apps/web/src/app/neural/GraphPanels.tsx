import { ArrowUpRight, Focus, X, Zap } from "lucide-react";
import { type Dispatch, type ReactNode, type SetStateAction, useState } from "react";
import type { GraphSettings, SceneStats } from "./GraphScene.js";
import type { GraphIndex, NeuralGraph, NeuralNode } from "./model.js";
export function IconButton({
  label,
  children,
  onClick,
  pressed,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function GraphSettingsPanel({
  settings,
  update,
  quality,
  stats,
  reduced,
  systemReduced,
  close,
}: {
  settings: GraphSettings;
  update: Dispatch<SetStateAction<GraphSettings>>;
  quality: string;
  stats: SceneStats | null;
  reduced: boolean;
  systemReduced: boolean;
  close: () => void;
}) {
  const setting = <K extends keyof GraphSettings>(key: K, value: GraphSettings[K]) =>
    update((s) => ({ ...s, [key]: value }));
  return (
    <aside className="neural-settings neural-panel" aria-label="Graph settings panel">
      <div className="neural-panel-heading">
        <strong>Graph settings</strong>
        <IconButton label="Close settings" onClick={close}>
          <X size={16} />
        </IconButton>
      </div>
      {(
        [
          ["brightness", "Node brightness"],
          ["connections", "Connection visibility"],
          ["bloom", "Bloom intensity"],
          ["speed", "Animation speed"],
          ["pulse", "Pulse intensity"],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            aria-label={label}
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={settings[key]}
            onChange={(e) => setting(key, Number(e.target.value))}
          />
        </label>
      ))}
      {(
        [
          ["zaps", "Electric zaps"],
          ["autoRotate", "Auto rotation"],
          ["reduced", "Reduced motion"],
        ] as const
      ).map(([key, label]) => (
        <label className="neural-toggle" key={key}>
          {label}
          <input
            type="checkbox"
            checked={settings[key]}
            onChange={(e) => setting(key, e.target.checked)}
            disabled={systemReduced && (key === "zaps" || key === "autoRotate")}
          />
        </label>
      ))}
      <label>
        Performance quality
        <select
          aria-label="Performance quality"
          value={settings.quality}
          onChange={(e) => setting("quality", e.target.value as GraphSettings["quality"])}
        >
          <option value="auto">Automatic</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label>
        Trace depth
        <select
          aria-label="Trace depth"
          value={settings.depth}
          onChange={(e) => setting("depth", Number(e.target.value))}
        >
          <option value="1">1 hop</option>
          <option value="2">2 hops</option>
          <option value="3">3 hops</option>
        </select>
      </label>
      <p>
        {quality} quality{stats ? ` · ${stats.fps} FPS` : ""}
        {reduced ? " · Reduced motion" : ""}
      </p>
      <small>Background particles are decorative. Only file links are relationships.</small>
    </aside>
  );
}
export function GraphInspector({
  node,
  graph,
  index,
  close,
  focus,
  trace,
  find,
  onOpen,
}: {
  node: NeuralNode;
  graph: NeuralGraph;
  index: GraphIndex;
  close: () => void;
  focus: () => void;
  trace: () => void;
  find: (id: string) => void;
  onOpen: (() => void) | undefined;
}) {
  const [copied, setCopied] = useState(false);
  const relations = graph.edges.filter((e) => e.source === node.id || e.target === node.id);
  return (
    <aside className="neural-inspector neural-panel" aria-label="Knowledge inspector">
      <div className="neural-panel-heading">
        <span>Selected knowledge</span>
        <IconButton label="Close inspector" onClick={close}>
          <X size={17} />
        </IconButton>
      </div>
      <div className="neural-inspector-body">
        <p className="neural-category">
          {node.categoryId} · {node.type}
        </p>
        <h2>{node.title}</h2>
        {node.source && <p className="neural-path">{node.source.path}</p>}
        <p className="neural-summary">{node.summary || "This file has no summary yet."}</p>
        {node.tags.length > 0 && (
          <div className="neural-tags">
            {node.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        )}
        {node.source?.knowledge && (
          <p className="neural-evidence">
            {node.source.knowledge.basis.replaceAll("_", " ")} · {node.source.effective_state}
            <br />
            Agent-recorded context retains its original evidence and review state.
          </p>
        )}
        {node.source?.domain_kind && (
          <p className="neural-evidence">
            {node.source.domain_kind} · {node.source.domain_status?.replaceAll("_", " ")}
            <br />
            {node.source.provenance.verification}
          </p>
        )}
        <div className="neural-inspector-actions">
          <button type="button" onClick={focus}>
            <Focus size={15} />
            Focus
          </button>
          <button type="button" onClick={trace}>
            <Zap size={15} />
            Trace links
          </button>
          {onOpen && (
            <button type="button" onClick={onOpen}>
              Open file
              <ArrowUpRight size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard
                .writeText(`[[${node.source?.path ?? node.id}]]`)
                .then(() => setCopied(true))
            }
          >
            {copied ? "Copied" : "Copy reference"}
          </button>
        </div>
        <h3>
          Relationships <span>{relations.length}</span>
        </h3>
        {relations.length === 0 && <p className="neural-muted">No resolved links in this view.</p>}
        <ul className="neural-relations">
          {relations.map((e) => {
            const other = index.nodes.get(e.source === node.id ? e.target : e.source);
            return (
              <li key={e.id}>
                <button type="button" onClick={() => find(other?.id ?? "")}>
                  <strong>{other?.title ?? "Unknown file"}</strong>
                  <span>
                    {e.source === node.id ? "Outgoing →" : "Incoming ←"}{" "}
                    {e.type.replaceAll("_", " ")}
                  </span>
                  <small>
                    {e.origin} · review {e.review}
                  </small>
                </button>
              </li>
            );
          })}
        </ul>
        <h3>Sources</h3>
        <p className="neural-muted">
          {node.source?.provenance.paths.join(" · ") ||
            node.source?.path ||
            "No additional source paths recorded."}
        </p>
        {node.source?.provenance.verification && (
          <p className="neural-muted">{node.source.provenance.verification}</p>
        )}
      </div>
    </aside>
  );
}
