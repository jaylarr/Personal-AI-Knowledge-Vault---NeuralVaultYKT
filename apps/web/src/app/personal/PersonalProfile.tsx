import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";
import { personalContextPacketSchema, personalPolicySchema, z } from "@atlas/contracts";
import { personalRequest, usePersonalAction, requestKey } from "./api.js";
export function PersonalProfile() {
  const [query, setQuery] = useState("");
  const profile = useQuery({
    queryKey: ["personal", "profile", query],
    queryFn: async () =>
      personalContextPacketSchema.parse(
        await personalRequest("/context", {
          query,
          limit: query ? 20 : 8,
          character_budget: query ? 24000 : 10000,
        }),
      ),
  });
  const policy = useQuery({
    queryKey: ["personal", "policy"],
    queryFn: async () =>
      personalPolicySchema.extend({ revision: z.number() }).parse(await personalRequest("/policy")),
  });
  const action = usePersonalAction(),
    [stopping, setStopping] = useState<string | null>(null);
  return (
    <section className="personal-panel" aria-label="Personal working context">
      <div className="personal-toolbar">
        <h2>How you work</h2>
        <button type="button" onClick={() => void profile.refetch()}>
          Refresh personal context
        </button>
      </div>
      <p>
        Explicit preferences and constraints that help your agents make better decisions. Project
        histories stay in their projects.
      </p>
      <label htmlFor="personal-subject-search">Find a personal subject</label>
      <input
        id="personal-subject-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {policy.data && !policy.data.enabled && (
        <p className="personal-status">
          Automatic personal capture is off. Existing knowledge is available here. Client setup and
          session access have a separate rollout checkpoint.
        </p>
      )}
      {profile.isPending && <p role="status">Reading your personal context…</p>}
      {profile.isError && (
        <p role="alert">
          {profile.error.message}{" "}
          <button type="button" onClick={() => void profile.refetch()}>
            Retry
          </button>
        </p>
      )}
      {profile.data?.notes.length === 0 && (
        <p>
          {query ? "No matching personal subjects. " : "No personal subjects yet. "}A useful
          explicit preference can be saved by an authorized connected agent; routine work can
          correctly produce nothing.
        </p>
      )}
      {profile.data?.notes.map((n) => (
        <article className="personal-subject" key={n.id}>
          <h3>{n.title}</h3>
          <p>{n.knowledge?.summary}</p>
          <p>
            <strong>Applies when:</strong> {n.knowledge?.applies_when}
          </p>
          {Boolean(n.knowledge?.exceptions.length) && (
            <ul>
              {n.knowledge?.exceptions.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <details>
            <summary>Evidence and previous versions</summary>
            <p>{n.provenance.verification}</p>
            <p>
              {n.knowledge?.source_refs.length ?? 0} exact owner-message references.{" "}
              {n.modified_since_capture
                ? "Read the current body: the source was edited."
                : "Captured source version."}
            </p>
            <NavLink to={`/files?note=${encodeURIComponent(n.id)}&view=all`}>
              Open full Markdown
            </NavLink>
            <p className="personal-path">{n.path}</p>
            {n.knowledge?.supersedes.map((id) => (
              <NavLink key={id} to={`/files?note=${encodeURIComponent(id)}&view=all`}>
                Previous version
              </NavLink>
            ))}
          </details>
          <div className="personal-actions">
            <button
              type="button"
              disabled={action.isPending || !policy.data}
              onClick={() => {
                const p = policy.data;
                if (!p) return;
                const { revision, ...value } = p;
                action.mutate({
                  path: "/policy",
                  body: {
                    policy: {
                      ...value,
                      baseline_keys: p.baseline_keys.includes(n.knowledge!.key)
                        ? p.baseline_keys.filter((k) => k !== n.knowledge!.key)
                        : [...p.baseline_keys, n.knowledge!.key].slice(0, 8),
                    },
                    expected_revision: revision,
                    request_key: requestKey(),
                  },
                });
              }}
            >
              {policy.data?.baseline_keys.includes(n.knowledge!.key)
                ? "Unpin baseline"
                : "Pin to baseline"}
            </button>
            <button type="button" onClick={() => setStopping(n.id)}>
              Stop using
            </button>
          </div>
          {stopping === n.id && (
            <fieldset className="personal-confirm" aria-label="Confirm stop using">
              <p>
                Exclude this subject from default recall. Its original files and history remain.
              </p>
              <button
                type="button"
                disabled={action.isPending}
                onClick={() => {
                  action.mutate(
                    {
                      path: `/subjects/${n.id}/stop-using`,
                      body: { expected_revision: 0, request_key: requestKey() },
                    },
                    { onSuccess: () => setStopping(null) },
                  );
                }}
              >
                Confirm stop using
              </button>
              <button type="button" onClick={() => setStopping(null)}>
                Cancel
              </button>
            </fieldset>
          )}
        </article>
      ))}
      {profile.data?.truncated && (
        <p role="status">
          Some subjects do not fit this context budget. Full files remain available.
        </p>
      )}
      {action.isError && <p role="alert">{action.error.message}</p>}
      <div className="personal-links">
        <NavLink to="/skills">Reusable skills</NavLink>
        <NavLink to="/coverage">Session coverage</NavLink>
        <NavLink to="/personal/review">Unconfirmed patterns</NavLink>
        <NavLink to="/capture">Capture source material</NavLink>
      </div>
    </section>
  );
}
