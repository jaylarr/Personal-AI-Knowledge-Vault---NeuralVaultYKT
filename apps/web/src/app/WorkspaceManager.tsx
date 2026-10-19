import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { organizationSnapshotSchema, type z } from "@atlas/contracts";
import { authorizedRequest } from "../lib/authorized.js";
import { AuthPanel } from "../auth/AuthPanel.js";
import { ProjectKnowledge } from "./ProjectKnowledge.js";
type Collection = z.infer<typeof organizationSnapshotSchema>["collections"][number];
export function WorkspaceManager({ workspaceId }: { workspaceId: string }) {
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState(""),
    [editing, setEditing] = useState(""),
    [name, setName] = useState(""),
    [slug, setSlug] = useState(""),
    [description, setDescription] = useState(""),
    [parent, setParent] = useState(""),
    [archived, setArchived] = useState(false),
    [target, setTarget] = useState(""),
    [confirmChildren, setConfirmChildren] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const snapshot = useQuery({
    queryKey: ["organization", workspaceId],
    queryFn: async ({ signal }) =>
      organizationSnapshotSchema.parse(
        await authorizedRequest(`/workspaces/${workspaceId}/organization`, { signal }),
      ),
  });
  const data = snapshot.data;
  const selectedProject = data?.projects.find((p) => p.id === params.get("project"));
  const selectedCollection = data?.collections.find((p) => p.id === params.get("collection"));
  function reset(next: string, id = "") {
    setMode(next);
    setEditing(id);
    setMessage("");
    setName("");
    setSlug("");
    setDescription("");
    setParent("");
    setArchived(false);
    setTarget("");
    setConfirmChildren(false);
    if (next === "project-edit") {
      const p = data?.projects.find((p) => p.id === id);
      if (p) {
        setName(p.name);
        setDescription(p.description);
        setArchived(Boolean(p.archived_at));
      }
    }
    if (next === "collection-edit") {
      const p = data?.collections.find((p) => p.id === id);
      if (p) {
        setName(p.name);
        setParent(p.parent_id ?? "");
        setArchived(Boolean(p.archived_at));
      }
    }
  }
  const mergeSource = data?.collections.find((c) => c.id === editing),
    mergeTarget = data?.collections.find((c) => c.id === target);
  const collisions: { source: Collection; target: Collection }[] = [];
  function findCollisions(source: string, destination: string) {
    for (const child of data?.collections.filter((c) => !c.archived_at && c.parent_id === source) ??
      []) {
      const match = data?.collections.find(
        (c) =>
          !c.archived_at &&
          c.parent_id === destination &&
          c.name.trim().toLowerCase() === child.name.trim().toLowerCase(),
      );
      if (match) {
        collisions.push({ source: child, target: match });
        findCollisions(child.id, match.id);
      }
    }
  }
  if (mergeSource && mergeTarget && mergeSource.id !== mergeTarget.id)
    findCollisions(mergeSource.id, mergeTarget.id);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    setMessage("");
    try {
      let path = `/workspaces/${workspaceId}/${mode.startsWith("project") ? "projects" : "collections"}`,
        method = "POST",
        body: unknown;
      if (mode === "project-new") body = { name, slug, description };
      else if (mode === "project-edit") {
        path = `/projects/${editing}`;
        method = "PATCH";
        body = {
          name,
          description,
          archived,
          expected_revision: data.projects.find((p) => p.id === editing)?.revision,
        };
      } else if (mode === "collection-new") body = { name, parent_id: parent || null };
      else if (mode === "collection-edit") {
        path = `/collections/${editing}`;
        method = "PATCH";
        body = {
          name,
          parent_id: parent || null,
          archived,
          expected_revision: data.collections.find((p) => p.id === editing)?.revision,
        };
      } else {
        path = `/collections/${editing}/merge`;
        body = {
          target_id: target,
          expected_revision: mergeSource?.revision,
          target_revision: mergeTarget?.revision,
          child_conflicts: confirmChildren
            ? Object.fromEntries(collisions.map((c) => [c.source.id, c.target.id]))
            : {},
        };
      }
      await authorizedRequest(path, { method, body });
      await snapshot.refetch();
      setMessage("Saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  if (snapshot.isPending) return <p role="status">Loading your workspace…</p>;
  if (snapshot.isError || !data)
    return (
      <div role="alert">
        <p>Workspace could not be loaded. Your session or connection may need refreshing.</p>
        <button type="button" onClick={() => void snapshot.refetch()}>
          Retry
        </button>
        <AuthPanel />
      </div>
    );
  function collectionRow(c: Collection, depth = 0): React.ReactNode {
    const children =
      data?.collections.filter((child) => !child.archived_at && child.parent_id === c.id) ?? [];
    return (
      <li key={c.id}>
        <div className="organization-row">
          <button
            type="button"
            aria-expanded={expanded.has(c.id)}
            onClick={() => {
              setExpanded((prior) => {
                const next = new Set(prior);
                if (next.has(c.id)) next.delete(c.id);
                else next.add(c.id);
                return next;
              });
              setParams({ collection: c.id });
            }}
          >
            {children.length ? (expanded.has(c.id) ? "−" : "+") : "·"} {c.name}
          </button>
          <button
            type="button"
            aria-label={`Edit collection ${c.name}`}
            onClick={() => reset("collection-edit", c.id)}
          >
            Edit
          </button>
          <button
            type="button"
            aria-label={`Merge collection ${c.name}`}
            onClick={() => reset("collection-merge", c.id)}
          >
            Merge
          </button>
        </div>
        {expanded.has(c.id) && children.length > 0 && depth < 50 && (
          <ul>{children.map((child) => collectionRow(child, depth + 1))}</ul>
        )}
      </li>
    );
  }
  return (
    <section className="organization" aria-label="Knowledge organization">
      <div className="organization-toolbar">
        <div>
          <p className="eyebrow">ORGANIZE YOUR KNOWLEDGE</p>
          <h2>{data.workspace.name}</h2>
        </div>
        <div className="auth-actions">
          <button type="button" onClick={() => reset("project-new")}>
            New project
          </button>
          <button type="button" onClick={() => reset("collection-new")}>
            New collection
          </button>
          <button type="button" onClick={() => void snapshot.refetch()}>
            Reload
          </button>
        </div>
      </div>
      <div className="organization-grid">
        <section className="organization-list" aria-label="Projects and collections">
          <h3>Projects</h3>
          {!data.projects.some((p) => !p.archived_at) && (
            <p className="muted">
              Connected agents create projects as you work. You can also add one manually.
            </p>
          )}
          <ul>
            {data.projects
              .filter((p) => !p.archived_at)
              .map((p) => (
                <li key={p.id} className="organization-row">
                  <button
                    type="button"
                    onClick={() => {
                      setParams({ project: p.id });
                      setMode("");
                    }}
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Edit project ${p.name}`}
                    onClick={() => reset("project-edit", p.id)}
                  >
                    Edit
                  </button>
                </li>
              ))}
          </ul>
          <h3>Collections</h3>
          <ul className="collection-tree">
            {data.collections
              .filter((c) => !c.parent_id && !c.archived_at)
              .map((c) => collectionRow(c))}
          </ul>
          <details>
            <summary>Archived organization</summary>
            <ul>
              {data.projects
                .filter((p) => p.archived_at)
                .map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => reset("project-edit", p.id)}>
                      {p.name}
                    </button>
                  </li>
                ))}
              {data.collections
                .filter((c) => c.archived_at)
                .map((c) => (
                  <li key={c.id}>
                    {c.merged_into_id ? (
                      `${c.name} (merged)`
                    ) : (
                      <button type="button" onClick={() => reset("collection-edit", c.id)}>
                        {c.name}
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </details>
        </section>
        <div className="organization-detail">
          {(selectedProject || selectedCollection) && (
            <section className="selection-detail">
              <h3>{selectedProject?.name ?? selectedCollection?.name}</h3>
              <p>
                {selectedProject?.description ||
                  "Source capture will be available here once it is connected."}
              </p>
            </section>
          )}
          {selectedProject && !selectedProject.archived_at && !mode && (
            <ProjectKnowledge workspaceId={workspaceId} projectId={selectedProject.id} />
          )}
          {!mode && !selectedProject && (
            <p className="muted">
              Your connected agents create projects and save useful knowledge as you work. Select a
              project to browse its context.
            </p>
          )}
          {mode && (
            <form onSubmit={(event) => void submit(event)} className="organization-form">
              <h3>
                {mode === "project-new"
                  ? "Create project"
                  : mode === "project-edit"
                    ? "Edit project"
                    : mode === "collection-new"
                      ? "Create collection"
                      : mode === "collection-edit"
                        ? "Edit collection"
                        : `Merge ${mergeSource?.name ?? "collection"}`}
              </h3>
              {mode !== "collection-merge" ? (
                <>
                  <label>
                    Name
                    <input
                      required
                      maxLength={160}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  {mode === "project-new" && (
                    <label>
                      Project slug
                      <input
                        required
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                        maxLength={120}
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        disabled={busy}
                      />
                    </label>
                  )}
                  {mode.startsWith("project") ? (
                    <label>
                      Description
                      <textarea
                        maxLength={4000}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={busy}
                      />
                    </label>
                  ) : (
                    <label>
                      Parent collection
                      <select
                        value={parent}
                        onChange={(e) => setParent(e.target.value)}
                        disabled={busy}
                      >
                        <option value="">Top level</option>
                        {data.collections
                          .filter((c) => !c.archived_at && c.id !== editing)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  {mode.endsWith("edit") && (
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={archived}
                        onChange={(e) => setArchived(e.target.checked)}
                      />
                      Archive this {mode.startsWith("project") ? "project" : "collection"}
                    </label>
                  )}
                </>
              ) : (
                <>
                  <p>
                    Move memberships and children into another collection. Original sources and
                    their sharing stay intact.
                  </p>
                  <label>
                    Merge into
                    <select
                      required
                      value={target}
                      onChange={(e) => {
                        setTarget(e.target.value);
                        setConfirmChildren(false);
                      }}
                    >
                      <option value="">Choose a collection</option>
                      {data.collections
                        .filter((c) => !c.archived_at && c.id !== editing)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {collisions.length > 0 && (
                    <>
                      <p>Matching children: {collisions.map((c) => c.source.name).join(", ")}</p>
                      <label className="checkbox-label">
                        <input
                          required
                          type="checkbox"
                          checked={confirmChildren}
                          onChange={(e) => setConfirmChildren(e.target.checked)}
                        />
                        Merge these matching child collections too
                      </label>
                    </>
                  )}
                </>
              )}
              <button type="submit" disabled={busy}>
                {busy ? "Saving…" : mode === "collection-merge" ? "Merge collections" : "Save"}
              </button>
              <p role="status">{message}</p>
            </form>
          )}
          <AuthPanel bound />
        </div>
      </div>
    </section>
  );
}
