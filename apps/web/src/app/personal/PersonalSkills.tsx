import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { personalSkillSummarySchema, z } from "@atlas/contracts";
import { personalRequest, usePersonalAction, requestKey } from "./api.js";
export function PersonalSkills() {
  const [query, setQuery] = useState(""),
    [host, setHost] = useState(""),
    [body, setBody] = useState<{ id: string; text: string } | null>(null),
    [error, setError] = useState(""),
    [files, setFiles] = useState("SKILL.md"),
    [destination, setDestination] = useState("");
  const action = usePersonalAction();
  const q = useQuery({
    queryKey: ["personal", "skills", query],
    queryFn: async () =>
      z
        .object({
          skills: z.array(personalSkillSummarySchema),
          revisions: z.record(z.string(), z.number()).default({}),
        })
        .parse(await personalRequest(`/skills?query=${encodeURIComponent(query)}`)),
  });
  return (
    <section className="personal-panel">
      <h2>Reusable skills</h2>
      <p>
        Canonical procedures, loaded only when relevant. Installed skills are not automatically your
        preferences. A reference is not a source backup.
      </p>
      <label htmlFor="personal-skill-query">Find a skill</label>
      <input id="personal-skill-query" value={query} onChange={(e) => setQuery(e.target.value)} />
      {q.isPending && <p role="status">Reading skill references…</p>}
      {q.isError && <p role="alert">{q.error.message}</p>}
      {q.data?.skills.length === 0 && (
        <p>No matching skill references. Discovery uses approved roots only.</p>
      )}
      {q.data?.skills.map((s) => (
        <article className="personal-subject" key={s.id}>
          <h3>{s.name}</h3>
          <p>{s.description}</p>
          <p>
            {s.state} · {s.kind.replaceAll("_", " ")} · {s.availability}
          </p>
          <p>
            {s.backup_manifest
              ? "Selected source package backed up in the vault"
              : "Source files are not backed up in this vault"}
          </p>
          <button
            type="button"
            disabled={s.availability !== "available"}
            onClick={async () => {
              setError("");
              try {
                const value = z
                  .object({ body: z.string() })
                  .passthrough()
                  .parse(
                    await personalRequest("/skills/query", {
                      skill_id: s.id,
                      expected_digest: s.sha256,
                      read_body: true,
                    }),
                  );
                setBody({ id: s.id, text: value.body });
              } catch (e) {
                setError(e instanceof Error ? e.message : "Skill could not be opened");
              }
            }}
          >
            Read procedure
          </button>
          {body?.id === s.id && <pre className="personal-procedure">{body.text}</pre>}
          <details>
            <summary>Source and availability</summary>
            <p>{s.source}</p>
            <p className="personal-path">Locator {s.locator_id}</p>
            <p>Checked {new Date(s.last_checked_at).toLocaleString()}</p>
            <p>
              No skill is installed or executed here. Mark custom only if you own or maintain this
              source.
            </p>
            <div className="personal-actions">
              <button
                type="button"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    path: `/skills/${s.id}/curate`,
                    body: {
                      state: "curated",
                      kind: s.kind,
                      triggers: [s.name],
                      expected_revision: q.data?.revisions[s.id],
                      request_key: requestKey(),
                    },
                  })
                }
              >
                Curate reference
              </button>
              <button
                type="button"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    path: `/skills/${s.id}/curate`,
                    body: {
                      state: "dismissed",
                      kind: s.kind,
                      triggers: s.triggers,
                      expected_revision: q.data?.revisions[s.id],
                      request_key: requestKey(),
                    },
                  })
                }
              >
                Dismiss reference
              </button>
              <button
                type="button"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    path: `/skills/${s.id}/curate`,
                    body: {
                      state: "curated",
                      kind: "owner_custom",
                      triggers: [s.name],
                      expected_revision: q.data?.revisions[s.id],
                      request_key: requestKey(),
                    },
                  })
                }
              >
                Mark as my custom source
              </button>
            </div>
            {s.state === "curated" && ["owner_custom", "project_custom"].includes(s.kind) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  action.mutate({
                    path: `/skills/${s.id}/backup`,
                    body: {
                      files: files
                        .split("\n")
                        .map((f) => f.trim())
                        .filter(Boolean),
                      expected_revision: q.data?.revisions[s.id],
                      request_key: requestKey(),
                    },
                  });
                }}
              >
                <label htmlFor={`files-${s.id}`}>
                  Source files to back up, one relative path per line
                </label>
                <textarea
                  id={`files-${s.id}`}
                  value={files}
                  onChange={(e) => setFiles(e.target.value)}
                  required
                />
                <button type="submit" disabled={action.isPending}>
                  Back up selected source files
                </button>
              </form>
            )}
            {s.backup_manifest && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  action.mutate({ path: `/skills/${s.id}/restore-preview`, body: { destination } });
                }}
              >
                <label htmlFor={`restore-${s.id}`}>New separate inspection folder</label>
                <input
                  id={`restore-${s.id}`}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                />
                <button type="submit" disabled={action.isPending}>
                  Restore copy for inspection
                </button>
              </form>
            )}
          </details>
        </article>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action.mutate({
            path: "/skills/scan",
            body: { host_id: host, request_key: requestKey() },
          });
        }}
      >
        <label htmlFor="skill-host">Configured host ID</label>
        <input id="skill-host" value={host} onChange={(e) => setHost(e.target.value)} required />
        <button type="submit" disabled={action.isPending}>
          Discover skill metadata
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {action.isError && <p role="alert">{action.error.message}</p>}
      {action.isPending && <p role="status">Discovering approved skill sources…</p>}
    </section>
  );
}
