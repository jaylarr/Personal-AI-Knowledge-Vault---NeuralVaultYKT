import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "@atlas/contracts";
import { personalRequest, usePersonalAction, requestKey } from "./api.js";
const schema = z.object({
  as_of: z.string(),
  scan_complete: z.boolean(),
  reviewed: z.number(),
  eligible_terminal_revisions: z.number(),
  main_chats: z.number(),
  counts: z.record(z.string(), z.number()),
  scope: z.string(),
  warnings: z.array(z.string()),
  next_cursor: z.number().nullable(),
  items: z.array(
    z.object({
      host_id: z.string(),
      session_key: z.string(),
      session_revision: z.string(),
      outcome: z.string(),
      reason_code: z.string(),
      revision: z.number(),
      at: z.string(),
      terminal: z.boolean(),
      native_consent: z.string(),
    }),
  ),
});
export function PersonalCoverage() {
  const [cursor, setCursor] = useState(0),
    [host, setHost] = useState(""),
    [scanPage, setScanPage] = useState<{ cursor: number; scope_digest?: string }>({ cursor: 0 }),
    action = usePersonalAction();
  const q = useQuery({
    queryKey: ["personal", "coverage", cursor],
    queryFn: async () => schema.parse(await personalRequest(`/coverage?cursor=${cursor}`)),
  });
  return (
    <section className="personal-panel">
      <h2>Session coverage</h2>
      <p>
        Review outcomes for configured hosts. Saving nothing is a valid outcome. A tool attempt does
        not count as a completed review.
      </p>
      {q.isPending && <p role="status">Reading coverage…</p>}
      {q.isError && (
        <p role="alert">
          {q.error.message}{" "}
          <button type="button" onClick={() => void q.refetch()}>
            Retry
          </button>
        </p>
      )}
      {q.data && (
        <>
          <p className="personal-status">
            {q.data.scan_complete
              ? "Inventory complete for configured scope"
              : "Inventory incomplete or not started"}{" "}
            · {q.data.reviewed} reviewed of {q.data.eligible_terminal_revisions} identified eligible
            terminal revisions
          </p>
          <p>{q.data.scope}</p>
          <p>As of {new Date(q.data.as_of).toLocaleString()}</p>
          {q.data.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          {q.data.items.length === 0 && (
            <p>No session review records. No history has been imported by opening this view.</p>
          )}
          <ul className="personal-rows">
            {q.data.items.map((r) => (
              <li key={`${r.host_id}:${r.session_key}:${r.session_revision}`}>
                <div>
                  <strong>{r.outcome.replaceAll("_", " ")}</strong>
                  <p>
                    {r.host_id} · {r.reason_code.replaceAll("_", " ")}
                  </p>
                  <details>
                    <summary>Revision identifiers</summary>
                    <p className="personal-path">
                      {r.session_key}
                      <br />
                      {r.session_revision}
                    </p>
                    <p>
                      Native consent status: {r.native_consent}. {new Date(r.at).toLocaleString()}
                    </p>
                  </details>
                </div>
                <div className="personal-actions">
                  {["failed", "source_unavailable"].includes(r.outcome) && (
                    <button
                      type="button"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({
                          path: "/sessions/retry",
                          body: {
                            host_id: r.host_id,
                            session_key: r.session_key,
                            session_revision: r.session_revision,
                            expected_revision: r.revision,
                            request_key: requestKey(),
                          },
                        })
                      }
                    >
                      Retry review
                    </button>
                  )}
                  {r.outcome !== "excluded" && (
                    <button
                      type="button"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({
                          path: "/sessions/exclude",
                          body: {
                            host_id: r.host_id,
                            session_key: r.session_key,
                            session_revision: r.session_revision,
                            expected_revision: r.revision,
                            request_key: requestKey(),
                          },
                        })
                      }
                    >
                      Exclude session
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="personal-actions">
            <button
              type="button"
              disabled={cursor === 0}
              onClick={() => setCursor(Math.max(0, cursor - 100))}
            >
              Previous page
            </button>
            <button
              type="button"
              disabled={q.data.next_cursor === null}
              onClick={() => setCursor(q.data!.next_cursor!)}
            >
              Next page
            </button>
          </div>
        </>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action.mutate(
            { path: "/sessions/scan", body: { host_id: host, mode: "live", ...scanPage } },
            {
              onSuccess: (data) => {
                const next = z
                  .object({ next_cursor: z.number().nullable(), scope_digest: z.string() })
                  .parse(data);
                setScanPage({ cursor: next.next_cursor ?? 0, scope_digest: next.scope_digest });
              },
            },
          );
        }}
      >
        <label htmlFor="personal-host">Configured host ID</label>
        <input
          id="personal-host"
          value={host}
          onChange={(e) => {
            setHost(e.target.value);
            setScanPage({ cursor: 0 });
          }}
          placeholder="windows-primary"
          required
        />
        <button disabled={action.isPending} type="submit">
          Scan next bounded inventory page
        </button>
      </form>
      {action.isPending && <p role="status">Processing local metadata…</p>}
      {action.isError && <p role="alert">{action.error.message}</p>}
      {action.isSuccess && (
        <p role="status">
          Operation recorded. Pending work still requires review by a connected agent.
        </p>
      )}
    </section>
  );
}
