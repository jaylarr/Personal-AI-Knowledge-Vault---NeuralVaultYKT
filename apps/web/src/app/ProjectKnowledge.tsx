import { useQuery } from "@tanstack/react-query";
import { projectContextSchema } from "@atlas/contracts";
import { authorizedRequest } from "../lib/authorized.js";
export function ProjectKnowledge({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const context = useQuery({
    queryKey: ["project-knowledge", workspaceId, projectId],
    queryFn: async ({ signal }) =>
      projectContextSchema.parse(
        await authorizedRequest(`/projects/${projectId}/checkpoints`, { signal }),
      ),
  });
  return (
    <section className="project-knowledge" aria-label="Saved project knowledge">
      <h3>Saved by your agents</h3>
      <p className="muted">
        Decisions, lessons and handoffs appear here automatically as connected agents work.
      </p>
      <button type="button" onClick={() => void context.refetch()}>
        Refresh knowledge
      </button>
      {context.isPending ? (
        <p role="status">Loading project knowledge…</p>
      ) : context.isError ? (
        <p role="alert">Project knowledge could not be loaded.</p>
      ) : (
        <>
          {context.data.checkpoints.length === 0 && <p>No saved checkpoints yet.</p>}
          {context.data.checkpoints.map((note) => (
            <details key={note.id}>
              <summary>
                {note.title} <span className="muted">· {note.kind}</span>
              </summary>
              <p className="muted">
                Agent recorded · {new Date(note.created_at).toLocaleString()}. Check against current
                project evidence.
              </p>
              <pre className="checkpoint-body">{note.markdown}</pre>
              <p>Verification: {note.provenance.verification || "No verification reported."}</p>
              {note.provenance.paths.length > 0 && (
                <p className="muted">Evidence: {note.provenance.paths.join(", ")}</p>
              )}
            </details>
          ))}
          {context.data.truncated && (
            <p className="muted">
              Showing a bounded selection. Agents can query matching knowledge.
            </p>
          )}
        </>
      )}
    </section>
  );
}
