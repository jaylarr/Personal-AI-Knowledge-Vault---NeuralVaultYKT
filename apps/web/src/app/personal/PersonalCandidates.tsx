import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { localRecordSchema, z } from "@atlas/contracts";
import { personalRequest, usePersonalAction, requestKey } from "./api.js";
export function PersonalCandidates() {
  const q = useQuery({
    queryKey: ["personal", "candidates"],
    queryFn: async () =>
      z.object({ items: z.array(localRecordSchema) }).parse(await personalRequest("/candidates")),
  });
  const [editing, setEditing] = useState(""),
    [claim, setClaim] = useState(""),
    [applies, setApplies] = useState(""),
    [statement, setStatement] = useState(""),
    [exceptions, setExceptions] = useState(""),
    action = usePersonalAction();
  return (
    <section className="personal-panel">
      <h2>Unconfirmed patterns</h2>
      <p>
        These suggestions are excluded from personal recall. Repetition alone does not establish a
        preference. Confirm only a statement that accurately reflects how you work.
      </p>
      {q.isPending && <p role="status">Reading candidates…</p>}
      {q.isError && <p role="alert">{q.error.message}</p>}
      {q.data?.items.filter((r) => r.data.status === "proposed").length === 0 && (
        <p>No unconfirmed patterns to review.</p>
      )}
      {q.data?.items
        .filter((r) => r.data.status === "proposed")
        .map((r) => (
          <article className="personal-subject" key={r.id}>
            <h3>{String(r.data.title)}</h3>
            <p>{String(r.data.claim)}</p>
            <p>Applies when: {String(r.data.applies_when)}</p>
            <div className="personal-actions">
              <button
                type="button"
                onClick={() => {
                  setEditing(r.entity_id);
                  setClaim(String(r.data.claim));
                  setApplies(String(r.data.applies_when));
                  setStatement("");
                  setExceptions(
                    Array.isArray(r.data.exceptions) ? r.data.exceptions.join("\n") : "",
                  );
                }}
              >
                Review and confirm
              </button>
              <button
                type="button"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    path: `/candidates/${r.entity_id}/decision`,
                    body: {
                      action: "dismiss",
                      expected_revision: r.revision,
                      request_key: requestKey(),
                    },
                  })
                }
              >
                Dismiss pattern
              </button>
            </div>
            {editing === r.entity_id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  action.mutate(
                    {
                      path: `/candidates/${r.entity_id}/decision`,
                      body: {
                        action: "confirm",
                        expected_revision: r.revision,
                        request_key: requestKey(),
                        claim,
                        applies_when: applies,
                        statement,
                        exceptions: exceptions
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      },
                    },
                    { onSuccess: () => setEditing("") },
                  );
                }}
              >
                <label htmlFor={`claim-${r.id}`}>Preference summary</label>
                <textarea
                  id={`claim-${r.id}`}
                  value={claim}
                  minLength={20}
                  maxLength={400}
                  onChange={(e) => setClaim(e.target.value)}
                  required
                />
                <label htmlFor={`applies-${r.id}`}>When it applies</label>
                <textarea
                  id={`applies-${r.id}`}
                  value={applies}
                  minLength={10}
                  maxLength={600}
                  onChange={(e) => setApplies(e.target.value)}
                  required
                />
                <label htmlFor={`exceptions-${r.id}`}>Exceptions, one per line</label>
                <textarea
                  id={`exceptions-${r.id}`}
                  value={exceptions}
                  maxLength={1800}
                  onChange={(e) => setExceptions(e.target.value)}
                />
                <label htmlFor={`statement-${r.id}`}>Your confirmation in your own words</label>
                <textarea
                  id={`statement-${r.id}`}
                  value={statement}
                  minLength={20}
                  maxLength={600}
                  onChange={(e) => setStatement(e.target.value)}
                  required
                />
                <button disabled={action.isPending} type="submit">
                  Save explicit preference
                </button>
                <button type="button" onClick={() => setEditing("")}>
                  Cancel
                </button>
              </form>
            )}
          </article>
        ))}
      {action.isPending && <p role="status">Saving your decision…</p>}
      {action.isError && <p role="alert">{action.error.message}</p>}
    </section>
  );
}
