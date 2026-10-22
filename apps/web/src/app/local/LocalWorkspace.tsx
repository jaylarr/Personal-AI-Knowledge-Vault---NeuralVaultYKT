import {
  useEffect,
  useRef,
  useState,
  useId,
  isValidElement,
  cloneElement,
  type FormEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useSearchParams } from "react-router-dom";
import {
  z,
  previewDirectory,
  conversationExportSchema,
  localDomainSnapshotSchema,
  localRecordSchema,
  localVersionSchema,
  localChunkSchema,
  localSourceSchema,
  localEvidenceSchema,
  localContextPacketSchema,
  type LocalDomainRecord,
  type LocalEvidence,
} from "@atlas/contracts";

const prefix = "/api/v1/local/domain";
async function request(path: string, body?: unknown) {
  const response = await fetch(prefix + (path === "/" ? "" : path), {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const code = z.object({ error: z.object({ code: z.string() }) }).safeParse(value);
    throw new Error(
      code.success
        ? code.data.error.code.replaceAll("_", " ")
        : "The local operation failed. Existing files were preserved.",
    );
  }
  return value;
}
const key = () => crypto.randomUUID();
const orgSchema = z.object({
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      archived: z.boolean(),
      revision: z.number(),
    }),
  ),
  collections: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      parent_id: z.string().nullable(),
      archived: z.boolean(),
      merged_into_id: z.string().nullable(),
      revision: z.number(),
    }),
  ),
});
type Organization = z.infer<typeof orgSchema>;
const agentViewSchema = z.object({
  agents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      revision: z.number(),
      disabled: z.boolean(),
      revoked_at: z.string().nullable(),
      expires_at: z.string(),
      capabilities: z.array(z.string()),
      project_ids: z.array(z.string()),
      scopes: z.array(z.string()),
      token_prefix: z.string(),
    }),
  ),
});
type AgentView = z.infer<typeof agentViewSchema>;
type Run = (work: () => Promise<unknown>) => void;
function useDraftGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest("a[href]");
      if (
        link &&
        link.getAttribute("href") &&
        !link.getAttribute("href")?.startsWith("#") &&
        !window.confirm("Discard the unsaved local draft?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const generated = useId();
  const element = isValidElement<{ id?: string }>(children) ? children : null;
  const id = element?.props.id ?? generated;
  return (
    <div className="domain-field">
      <label htmlFor={id}>{label}</label>
      {element ? cloneElement(element, { id }) : children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="domain-empty">{children}</p>;
}

function CapturePanel({
  organization,
  onSaved,
}: {
  organization: Organization;
  onSaved: (id: string) => void;
}) {
  const client = useQueryClient(),
    [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [project, setProject] = useState(""),
    [scope, setScope] = useState("personal"),
    [mode, setMode] = useState("note"),
    [url, setUrl] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [conversation, setConversation] = useState<z.infer<typeof conversationExportSchema> | null>(
      null,
    ),
    [selectedTurns, setSelectedTurns] = useState<string[]>([]),
    [fileError, setFileError] = useState(""),
    [saved, setSaved] = useState(false);
  const retry = useRef<{ payload: string; key: string; upload_id?: string }>({
    payload: "",
    key: key(),
  });
  useDraftGuard(Boolean(!saved && (title || content || file || url)));
  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { title, content, project_id: project || null, scope, input_type: mode };
      const fingerprint = JSON.stringify({
        ...payload,
        url,
        selectedTurns,
        file: file ? `${file.name}:${file.size}:${file.lastModified}` : null,
      });
      if (retry.current.payload !== fingerprint)
        retry.current = { payload: fingerprint, key: key() };
      if (mode === "url")
        return request("/import-url", {
          request_key: retry.current.key,
          title,
          url,
          project_id: project || null,
        });
      if (["file", "n8n", "conversation"].includes(mode)) {
        if (!file) throw Error("Choose a supported file.");
        if (file.size > 20971520) throw Error("The file exceeds 20 MiB.");
        const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "",
          media =
            file.type ||
            (
              {
                md: "text/markdown",
                txt: "text/plain",
                csv: "text/csv",
                json: "application/json",
                pdf: "application/pdf",
                png: "image/png",
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                webp: "image/webp",
              } as Record<string, string>
            )[extension] ||
            "unsupported";
        let upload_id = retry.current.upload_id;
        if (!upload_id) {
          const response = await fetch(prefix + "/uploads", {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream", "X-Atlas-Media-Type": media },
            body: file,
          });
          if (!response.ok)
            throw Error("The attachment could not be stored. Check its format and size.");
          const upload = z.object({ upload_id: z.string() }).parse(await response.json());
          upload_id = upload.upload_id;
          retry.current.upload_id = upload_id;
        }
        return request("/sources", {
          ...payload,
          request_key: retry.current.key,
          input_type:
            mode === "conversation"
              ? "conversation"
              : mode === "n8n"
                ? "n8n_json"
                : ["md", "txt"].includes(extension)
                  ? extension === "md"
                    ? "markdown"
                    : "text"
                  : extension === "pdf"
                    ? "pdf"
                    : "attachment",
          content: "",
          upload_id,
          ...(mode === "conversation" ? { selected_turn_ids: selectedTurns } : {}),
        });
      }
      return request("/sources", { ...payload, request_key: retry.current.key });
    },
    onSuccess: async (value) => {
      const result = z.object({ source_id: z.string() }).parse(value);
      setSaved(true);
      setTitle("");
      setContent("");
      setUrl("");
      setFile(null);
      await client.invalidateQueries({ queryKey: ["local-domain"] });
      await client.invalidateQueries({ queryKey: ["local-vault"] });
      onSaved(result.source_id);
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }
  return (
    <details className="domain-panel domain-capture">
      <summary>Add source material</summary>
      <form onSubmit={submit}>
        <div className="domain-form-grid">
          <Field label="Source title">
            <input
              required
              maxLength={160}
              value={title}
              onChange={(e) => {
                setSaved(false);
                setTitle(e.target.value);
              }}
            />
          </Field>
          <Field label="Capture method">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="note">Write a note</option>
              <option value="markdown">Paste Markdown</option>
              <option value="text">Paste text</option>
              <option value="file">Import a file</option>
              <option value="n8n">Import an n8n JSON export (static only)</option>
              <option value="conversation">Select conversation turns (supported JSON)</option>
              <option value="url">Import a public URL</option>
            </select>
          </Field>
          <Field label="Project">
            <select value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">Personal / unassigned</option>
              {organization.projects
                .filter((p) => !p.archived)
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Source visibility">
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="personal">Personal — agent reads denied</option>
              <option value="project" disabled={!project}>
                Project — explicitly granted agents
              </option>
              <option value="global_development">Shared development — granted agents</option>
            </select>
          </Field>
        </div>
        {mode === "url" ? (
          <Field label="Public HTTPS URL">
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
        ) : ["file", "n8n", "conversation"].includes(mode) ? (
          <Field label="File to preserve">
            <input
              type="file"
              required
              accept={
                ["n8n", "conversation"].includes(mode)
                  ? ".json"
                  : ".md,.txt,.pdf,.png,.jpg,.jpeg,.webp,.csv,.json"
              }
              onChange={async (e) => {
                const selected = e.target.files?.[0] ?? null;
                setFile(selected);
                setConversation(null);
                setSelectedTurns([]);
                setFileError("");
                if (mode === "conversation" && selected) {
                  try {
                    if (selected.size > 2097152) throw Error("Conversation export exceeds 2 MiB");
                    setConversation(
                      conversationExportSchema.parse(JSON.parse(await selected.text())),
                    );
                  } catch {
                    setFileError(
                      "Use atlas-selected-conversation-v1 JSON with turns containing id, role, timestamp and text. No arbitrary conversation archive is imported.",
                    );
                  }
                }
              }}
            />
          </Field>
        ) : (
          <Field label="Source text">
            <textarea
              rows={8}
              value={content}
              onChange={(e) => {
                setSaved(false);
                setContent(e.target.value);
              }}
            />
          </Field>
        )}
        {mode === "conversation" && (
          <div>
            <p>
              Only explicitly selected turns are stored as a source excerpt. The original export
              remains untouched; omitted turns are not retained. Speaker claims remain unverified.
            </p>
            {fileError && <p role="alert">{fileError}</p>}
            {conversation?.turns.map((turn) => (
              <label className="domain-checkbox" key={turn.id}>
                <input
                  type="checkbox"
                  checked={selectedTurns.includes(turn.id)}
                  onChange={(e) =>
                    setSelectedTurns(
                      e.target.checked
                        ? [...selectedTurns, turn.id]
                        : selectedTurns.filter((id) => id !== turn.id),
                    )
                  }
                />
                <span>
                  {turn.role} · {turn.timestamp ?? "Time unknown"} · {turn.text.slice(0, 160)}
                </span>
              </label>
            ))}
          </div>
        )}
        <p className="muted">
          Originals stay on this PC. Processing is off until you share an exact version with a named
          agent. Text/Markdown: 2 MiB. Supported attachments: 20 MiB.
        </p>
        {mutation.isError && <p role="alert">{mutation.error.message}</p>}
        <button
          type="submit"
          disabled={
            mutation.isPending ||
            !title.trim() ||
            (mode === "conversation" && !selectedTurns.length)
          }
        >
          {mutation.isPending ? "Preserving source…" : "Save source"}
        </button>
        {mutation.isSuccess && <span role="status">Source saved locally.</span>}
      </form>
    </details>
  );
}

function Evidence({ evidence }: { evidence: LocalEvidence }) {
  const [open, setOpen] = useState(false);
  const result = useQuery({
    queryKey: [
      "local-evidence",
      evidence.source_version_id,
      evidence.start_offset,
      evidence.end_offset,
      evidence.quote_sha256,
    ],
    enabled: open,
    queryFn: async () =>
      z
        .object({
          source_id: z.string(),
          title: z.string(),
          version: z.number(),
          quote: z.string(),
          context_before: z.string(),
          context_after: z.string(),
          is_current: z.boolean(),
          original_integrity: z.boolean(),
          pages: z.array(z.number()),
        })
        .parse(
          await request(
            `/evidence/${evidence.source_version_id}?start=${evidence.start_offset}&end=${evidence.end_offset}&sha=${evidence.quote_sha256}`,
          ),
        ),
  });
  return (
    <div className="domain-evidence">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Close evidence" : "Inspect exact evidence"} · {evidence.start_offset}–
        {evidence.end_offset}
      </button>
      {open && (
        <div>
          {result.isPending ? (
            <p role="status">Reading evidence…</p>
          ) : result.isError ? (
            <p role="alert">{result.error.message}</p>
          ) : (
            result.data && (
              <>
                <p>
                  <strong>{result.data.title}</strong> · Version {result.data.version}
                  {result.data.pages.length ? ` · Page ${result.data.pages.join(", ")}` : ""}
                </p>
                <p className="muted">
                  {result.data.is_current
                    ? "Current source version"
                    : "Older source version — revalidation required"}{" "}
                  ·{" "}
                  {result.data.original_integrity
                    ? "Original hash matches"
                    : "Original integrity failed"}
                </p>
                <pre>
                  {result.data.context_before}
                  <mark>{result.data.quote}</mark>
                  {result.data.context_after}
                </pre>
                <NavLink to={`/sources?source=${result.data.source_id}`}>Open source</NavLink>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}

function SourceDetail({
  id,
  agents,
  organization,
  run,
  pending,
}: {
  id: string;
  agents: AgentView["agents"];
  organization: Organization;
  run: Run;
  pending: boolean;
}) {
  const [viewVersion, setViewVersion] = useState("");
  const detail = useQuery({
    queryKey: ["local-source", id, viewVersion],
    queryFn: async () =>
      z
        .object({
          record: localRecordSchema,
          version: localVersionSchema,
          chunks: z.array(localChunkSchema),
          grants: z.array(localRecordSchema).default([]),
          versions: z
            .array(
              z.object({
                id: z.string(),
                version: z.number(),
                captured_at: z.string(),
                extraction_status: z.string(),
              }),
            )
            .default([]),
        })
        .parse(await request(`/sources/${id}${viewVersion ? `?version=${viewVersion}` : ""}`)),
    refetchInterval: 4000,
  });
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(""),
    [base, setBase] = useState<{ revision: number; digest: string; version: string } | null>(null),
    [processor, setProcessor] = useState(""),
    [release, setRelease] = useState(false),
    [collection, setCollection] = useState(""),
    [tags, setTags] = useState("");
  useDraftGuard(editing && draft !== detail.data?.version.text);
  if (detail.isPending) return <p role="status">Reading original and versions…</p>;
  if (detail.isError) return <p role="alert">{detail.error.message}</p>;
  const { record, version, chunks } = detail.data,
    source = localSourceSchema.parse(record.data),
    available = organization.collections.filter((c) => !c.archived && !c.merged_into_id);
  const organize = (include: string[], exclude: string[], nextTags = source.tags) =>
    run(() =>
      request(`/sources/${id}/organize`, {
        request_key: key(),
        expected_revision: record.revision,
        include,
        exclude,
        tags: nextTags,
      }),
    );
  return (
    <article className="domain-panel domain-detail">
      <header>
        <span className="file-kind">
          {source.scope.replaceAll("_", " ")} · {source.processing_state.replaceAll("_", " ")}
        </span>
        <h2>{source.title}</h2>
        <p className="muted">
          Version {version.version} · {version.byte_count.toLocaleString()} bytes ·{" "}
          {source.extraction_status.replaceAll("_", " ")}
        </p>
      </header>
      <Field label="Source version history">
        <select
          value={viewVersion || source.current_version_id}
          disabled={editing}
          onChange={(e) =>
            setViewVersion(e.target.value === source.current_version_id ? "" : e.target.value)
          }
        >
          {detail.data.versions.map((v) => (
            <option value={v.id} key={v.id}>
              Version {v.version} · {v.extraction_status.replaceAll("_", " ")} ·{" "}
              {new Date(v.captured_at).toLocaleString()}
              {v.id === source.current_version_id ? " · current" : ""}
            </option>
          ))}
        </select>
      </Field>
      {version.id !== source.current_version_id && (
        <p role="status">Historical version. Editing and processing use the current version.</p>
      )}
      {source.sensitivity !== "clear" && (
        <p role="alert">
          Potential credentials detected. General agent delivery is blocked. Review and redact a new
          version, or explicitly release this version to the selected processor.
        </p>
      )}
      <div className="domain-actions">
        {source.processing_state === "failed" && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() =>
                request(`/sources/${id}/retry`, {
                  request_key: key(),
                  expected_revision: record.revision,
                }),
              )
            }
          >
            Retry local extraction
          </button>
        )}
        <a href={`${prefix}/sources/${id}/original?version=${version.id}`}>
          Download exact original
        </a>
        <button
          type="button"
          disabled={pending || source.archived || version.id !== source.current_version_id}
          onClick={() => {
            setDraft(version.text);
            setBase({ revision: record.revision, digest: record.file_digest, version: version.id });
            setEditing(true);
          }}
        >
          Edit as a new version
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              request(`/sources/${id}/${source.archived ? "restore" : "archive"}`, {
                request_key: key(),
                expected_revision: record.revision,
              }),
            )
          }
        >
          {source.archived ? "Restore source" : "Archive source"}
        </button>
      </div>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (base)
              run(async () => {
                const value = await request(`/sources/${id}/versions`, {
                  request_key: key(),
                  expected_revision: base.revision,
                  expected_file_digest: base.digest,
                  content: draft,
                });
                setEditing(false);
                return value;
              });
          }}
        >
          <Field label="New version text">
            <textarea rows={14} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </Field>
          {base?.version !== version.id && (
            <p role="alert">
              The source changed while this draft was open. Your draft is preserved; compare before
              saving.
            </p>
          )}
          <div className="domain-actions">
            <button type="submit" disabled={pending}>
              Save new version
            </button>
            <button
              type="button"
              onClick={() => {
                if (draft === version.text || window.confirm("Discard this unsaved version draft?"))
                  setEditing(false);
              }}
            >
              Cancel edit
            </button>
          </div>
        </form>
      ) : (
        <pre className="domain-source-text">
          {version.text ||
            "This original has no extracted text. Download it to inspect the preserved bytes."}
        </pre>
      )}
      <SourceAccess
        source={source}
        revision={record.revision}
        agents={agents}
        organization={organization}
        run={run}
        pending={pending}
      />
      <details>
        <summary>Organize this source</summary>
        <Field label="Collection">
          <select value={collection} onChange={(e) => setCollection(e.target.value)}>
            <option value="">Choose collection</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="domain-actions">
          <button
            type="button"
            disabled={pending || !collection}
            onClick={() =>
              organize(
                [...new Set([...source.manual_include_ids, collection])],
                source.manual_exclude_ids.filter((x) => x !== collection),
              )
            }
          >
            Include collection
          </button>
          <button
            type="button"
            disabled={pending || !collection}
            onClick={() =>
              organize(
                source.manual_include_ids.filter((x) => x !== collection),
                [...new Set([...source.manual_exclude_ids, collection])],
              )
            }
          >
            Exclude collection
          </button>
        </div>
        <p className="muted">Manual exclusions survive agent suggestions and collection merges.</p>
        <ul>
          {source.collection_ids.map((cid) => (
            <li key={cid}>{organization.collections.find((c) => c.id === cid)?.name ?? cid}</li>
          ))}
        </ul>
        <Field label="Tags, separated by commas">
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={source.tags.join(", ")}
          />
        </Field>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            organize(
              source.manual_include_ids,
              source.manual_exclude_ids,
              tags
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            )
          }
        >
          Save tags
        </button>
      </details>
      <details>
        <summary>Share this version for agent processing</summary>
        {detail.data.grants
          .filter((g) => g.data.revoked !== true)
          .map((g) => (
            <p key={g.id}>
              Named processor:{" "}
              {agents.find((a) => a.id === g.data.agent_id)?.name ?? String(g.data.agent_id)} ·
              Expires {new Date(String(g.data.expires_at)).toLocaleString()}{" "}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    request(`/grants/${g.entity_id}/revoke`, {
                      request_key: key(),
                      expected_revision: g.revision,
                    }),
                  )
                }
              >
                Cancel processing and revoke grant
              </button>
            </p>
          ))}
        <p>
          Only this version and selected collection names enter the named agent's session. This does
          not grant general personal-memory access. Previously delivered text cannot be recalled.
        </p>
        <Field label="Processing agent">
          <select value={processor} onChange={(e) => setProcessor(e.target.value)}>
            <option value="">Choose an enabled processor</option>
            {agents
              .filter(
                (a) => !a.disabled && !a.revoked_at && a.capabilities.includes("process_knowledge"),
              )
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </Field>
        {source.sensitivity !== "clear" && (
          <label className="domain-checkbox">
            <input
              type="checkbox"
              checked={release}
              onChange={(e) => setRelease(e.target.checked)}
            />
            Release the flagged content in this exact version to this processor
          </label>
        )}
        <p className="muted">
          Expires in 24 hours. {chunks.length} source chunks; processing waits for an existing
          connected agent.
        </p>
        <button
          type="button"
          disabled={
            pending || !processor || !chunks.length || (source.sensitivity !== "clear" && !release)
          }
          onClick={() =>
            run(() =>
              request(`/sources/${id}/grants`, {
                request_key: key(),
                expected_revision: record.revision,
                agent_id: processor,
                source_version_id: version.id,
                expires_at: new Date(Date.now() + 86400000).toISOString(),
                collection_ids: source.collection_ids,
                release_quarantine: release,
              }),
            )
          }
        >
          Grant this version for 24 hours
        </button>
      </details>
      <details>
        <summary>Version and provenance</summary>
        <dl>
          <dt>Source version</dt>
          <dd>{version.id}</dd>
          <dt>Original SHA-256</dt>
          <dd>{version.raw_sha256}</dd>
          <dt>Normalized SHA-256</dt>
          <dd>{version.normalized_sha256}</dd>
        </dl>
      </details>
    </article>
  );
}

function ReviewView({
  records,
  run,
  pending,
}: {
  records: LocalDomainRecord[];
  run: Run;
  pending: boolean;
}) {
  const [reviewParams] = useSearchParams();
  const [selected, setSelected] = useState(() => reviewParams.get("item") ?? ""),
    [reason, setReason] = useState(""),
    [replacement, setReplacement] = useState("");
  const record = records.find((r) => r.entity_id === selected),
    evidence = record ? z.array(localEvidenceSchema).parse(record.data.evidence ?? []) : [];
  const decide = (action: string) => {
    if (record)
      run(() =>
        request(
          `/reviews/${record.kind === "review" ? "suggestion" : record.kind}/${record.entity_id}`,
          {
            request_key: key(),
            expected_revision: record.revision,
            action,
            reason,
            ...(action === "supersede" && replacement
              ? {
                  replacement_id: replacement,
                  expected_replacement_revision: records.find((r) => r.entity_id === replacement)
                    ?.revision,
                }
              : {}),
          },
        ),
      );
  };
  return (
    <div className="domain-split">
      <section className="domain-panel">
        <h2>Review and memory lifecycle</h2>
        <p className="muted">
          Agent-recorded knowledge keeps its original status. These imported proposals require
          explicit source review.
        </p>
        {records.length ? (
          <ul className="domain-list">
            {records.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  aria-pressed={selected === r.entity_id}
                  onClick={() => {
                    setSelected(r.entity_id);
                    setReason("");
                  }}
                >
                  <strong>{String(r.data.title ?? r.data.type ?? r.kind)}</strong>
                  <span>
                    {r.kind} · {String(r.data.status)}
                    {r.data.requires_revalidation ? " · stale evidence" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            No source-backed proposals yet. Capture and grant a source, or organize it manually.
          </Empty>
        )}
      </section>
      <section className="domain-panel">
        {record ? (
          <>
            <h2>{String(record.data.title ?? record.data.type ?? record.kind)}</h2>
            <p className="file-kind">
              {String(record.data.claim_kind ?? "unknown").replaceAll("_", " ")} ·{" "}
              {String(record.data.status)} · {String(record.data.scope ?? "personal")}
            </p>
            <pre>{String(record.data.summary ?? record.body)}</pre>
            {record.kind === "memory" && (
              <RetrievalSettings key={record.id} record={record} run={run} pending={pending} />
            )}
            {record.kind === "memory" &&
              records.filter(
                (r) =>
                  r.kind === "memory" &&
                  r.entity_id !== record.entity_id &&
                  r.data.subject_key === record.data.subject_key &&
                  r.data.scope === record.data.scope &&
                  r.data.project_id === record.data.project_id,
              ).length > 0 && (
                <details>
                  <summary>Compare other versions of this subject</summary>
                  {records
                    .filter(
                      (r) =>
                        r.kind === "memory" &&
                        r.entity_id !== record.entity_id &&
                        r.data.subject_key === record.data.subject_key &&
                        r.data.scope === record.data.scope &&
                        r.data.project_id === record.data.project_id,
                    )
                    .map((r) => (
                      <article key={r.id}>
                        <h3>
                          {String(r.data.title)} · {String(r.data.status)}
                        </h3>
                        <p>{String(r.data.summary)}</p>
                        <button type="button" onClick={() => setSelected(r.entity_id)}>
                          Inspect this alternative and its evidence
                        </button>
                      </article>
                    ))}
                  <p>No duplicate or contradiction is automatically made canonical.</p>
                </details>
              )}
            {typeof record.data.reported_confidence === "number" && (
              <p className="muted">
                Agent-reported confidence: {Math.round(record.data.reported_confidence * 100)}%.
                This is not independent verification.
              </p>
            )}
            {evidence.map((e) => (
              <Evidence
                key={`${e.source_version_id}:${e.start_offset}:${e.end_offset}:${e.quote_sha256}`}
                evidence={e}
              />
            ))}
            <Field label="Review reason">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </Field>
            <div className="domain-actions">
              {["proposed", "verified", "pending"].includes(String(record.data.status)) && (
                <>
                  <button
                    type="button"
                    disabled={pending || !reason.trim()}
                    onClick={() => decide("approve")}
                  >
                    Approve checked evidence
                  </button>
                  <button
                    type="button"
                    disabled={pending || !reason.trim()}
                    onClick={() => decide("reject")}
                  >
                    Reject proposal
                  </button>
                </>
              )}
              {record.data.status === "active" && (
                <button
                  type="button"
                  disabled={pending || !reason.trim()}
                  onClick={() => decide("archive")}
                >
                  Archive memory
                </button>
              )}
              {record.data.status === "archived" && (
                <button
                  type="button"
                  disabled={pending || !reason.trim()}
                  onClick={() => decide("restore")}
                >
                  Restore to review
                </button>
              )}
            </div>
            {record.kind === "memory" && record.data.status === "active" && (
              <details>
                <summary>Replace with a reviewed proposal</summary>
                <Field label="Replacement proposal">
                  <select value={replacement} onChange={(e) => setReplacement(e.target.value)}>
                    <option value="">Choose matching subject</option>
                    {records
                      .filter(
                        (r) =>
                          r.kind === "memory" &&
                          r.data.status === "proposed" &&
                          r.data.subject_key === record.data.subject_key,
                      )
                      .map((r) => (
                        <option key={r.id} value={r.entity_id}>
                          {String(r.data.title)}
                        </option>
                      ))}
                  </select>
                </Field>
                <button
                  type="button"
                  disabled={pending || !reason.trim() || !replacement}
                  onClick={() => decide("supersede")}
                >
                  Approve replacement and supersede
                </button>
              </details>
            )}
          </>
        ) : (
          <Empty>Select a proposal or memory to inspect its exact evidence and history.</Empty>
        )}
      </section>
    </div>
  );
}

function AgentSettings({
  agents,
  organization,
  run,
  pending,
}: {
  agents: AgentView["agents"];
  organization: Organization;
  run: Run;
  pending: boolean;
}) {
  const [name, setName] = useState(""),
    [project, setProject] = useState(""),
    [read, setRead] = useState(false),
    [propose, setPropose] = useState(false),
    [process, setProcess] = useState(false),
    [token, setToken] = useState<string | null>(null);
  return (
    <div className="domain-split">
      <section className="domain-panel">
        <h2>Local API agents</h2>
        <p className="muted">
          These controls govern app/API access. Other programs with Windows filesystem access can
          still read the vault directly.
        </p>
        <ul className="domain-list">
          {agents.map((a) => (
            <li key={a.id}>
              <strong>{a.name}</strong>
              <AgentEditor agent={a} organization={organization} run={run} pending={pending} />
              <span>
                {a.disabled || a.revoked_at ? "Disabled" : "Enabled"} · Expires{" "}
                {new Date(a.expires_at).toLocaleString()}
              </span>
              <span>{a.capabilities.join(", ").replaceAll("_", " ") || "No allowed actions"}</span>
              <div className="domain-actions">
                <button
                  type="button"
                  disabled={pending || Boolean(a.revoked_at)}
                  onClick={() =>
                    run(() =>
                      request(`/agents/${a.id}`, {
                        request_key: key(),
                        expected_revision: a.revision,
                        revoke: true,
                      }),
                    )
                  }
                >
                  Revoke future access
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="domain-panel">
        <h2>Create a scoped agent</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const result = z.object({ token: z.string().nullable() }).parse(
                await request("/agents", {
                  request_key: key(),
                  name,
                  expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
                  capabilities: [
                    ...(read ? ["read"] : []),
                    ...(propose ? ["propose"] : []),
                    ...(process ? ["process_knowledge"] : []),
                  ],
                  project_ids: project ? [project] : [],
                  scopes: [],
                }),
              );
              setToken(result.token);
              setName("");
              return result;
            });
          }}
        >
          <Field label="Agent name">
            <input
              required
              value={name}
              maxLength={160}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Readable project">
            <select value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">No general project access</option>
              {organization.projects
                .filter((p) => !p.archived)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
          {[
            [read, setRead, "Read granted project sources"],
            [propose, setPropose, "Propose source-backed facts"],
            [process, setProcess, "Process explicitly assigned source versions"],
          ].map(([checked, set, label]) => (
            <label className="domain-checkbox" key={String(label)}>
              <input
                type="checkbox"
                checked={Boolean(checked)}
                onChange={(e) => (set as (value: boolean) => void)(e.target.checked)}
              />
              {String(label)}
            </label>
          ))}
          <p className="muted">
            Expires in 30 days. No client configuration is installed automatically. Personal
            processing still needs a selected-version grant.
          </p>
          <button type="submit" disabled={pending || !name.trim()}>
            Create agent credential
          </button>
        </form>
        {token && (
          <div role="status">
            <p>Copy this credential now. It is shown once and is not stored as plaintext.</p>
            <textarea readOnly aria-label="One-time agent credential" value={token} />
            <button type="button" onClick={() => setToken(null)}>
              Hide credential
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function BackupView({ run, pending }: { run: Run; pending: boolean }) {
  const [result, setResult] = useState<z.infer<typeof backupResult> | null>(null),
    [restored, setRestored] = useState("");
  return (
    <section className="domain-panel">
      <h2>Portable backup and restore rehearsal</h2>
      <p>
        Export Markdown, original bytes, history, evidence and safe metadata. Credentials and live
        processing access stay disabled when restored.
      </p>
      <p className="muted">
        A copy on this disk does not protect against disk loss. Keep a verified copy on separate
        storage. Restore rehearsals create a new folder and preserve your current vault.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const value = backupResult.parse(
              await waitOperation(await request("/backup", { request_key: key() })),
            );
            setResult(value);
            return value;
          })
        }
      >
        {pending ? "Checking local files…" : "Create verified local backup"}
      </button>
      {result && (
        <div role="status">
          <p>
            {result.files} files · {result.bytes.toLocaleString()} bytes · manifest verified
          </p>
          <code>{result.path}</code>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const value = z
                  .object({ path: z.string(), credentials_disabled: z.boolean() })
                  .parse(
                    await waitOperation(
                      await request("/restore-rehearsal", {
                        backup_folder: result.path.split(/[\\/]/).at(-1),
                      }),
                    ),
                  );
                setRestored(value.path);
                return value;
              })
            }
          >
            Restore into an isolated new folder
          </button>
        </div>
      )}
      {restored && (
        <p role="status">
          Restore complete; credentials disabled. <code>{restored}</code>
        </p>
      )}
    </section>
  );
}
const backupResult = z.object({
  backup_id: z.string(),
  path: z.string(),
  files: z.number(),
  bytes: z.number(),
  complete: z.literal(true),
});

function OrganizationView({
  organization,
  run,
  pending,
}: {
  organization: Organization;
  run: Run;
  pending: boolean;
}) {
  const [projectName, setProjectName] = useState(""),
    [collectionName, setCollectionName] = useState(""),
    [parent, setParent] = useState("");
  return (
    <div className="domain-split">
      <section className="domain-panel">
        <h2>Projects</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const value = await request("/projects", {
                request_key: key(),
                name: projectName,
                description: "",
              });
              setProjectName("");
              return value;
            });
          }}
        >
          <Field label="New project name">
            <input required value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          </Field>
          <button type="submit" disabled={pending || !projectName.trim()}>
            Create local project
          </button>
        </form>
        <ul className="domain-list">
          {organization.projects.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong>
              <ProjectEditor project={p} run={run} pending={pending} />
              <span>{p.archived ? "Archived" : "Active"}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    request(`/projects/${p.id}`, {
                      request_key: key(),
                      expected_revision: p.revision,
                      archived: !p.archived,
                    }),
                  )
                }
              >
                {p.archived ? "Restore project" : "Archive project"}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="domain-panel">
        <h2>Collections</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const value = await request("/collections", {
                request_key: key(),
                name: collectionName,
                parent_id: parent || null,
              });
              setCollectionName("");
              return value;
            });
          }}
        >
          <Field label="New collection name">
            <input
              required
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
            />
          </Field>
          <Field label="Parent collection">
            <select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">Root collection</option>
              {organization.collections
                .filter((c) => !c.archived)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
          <button type="submit" disabled={pending || !collectionName.trim()}>
            Create collection
          </button>
        </form>
        <ul className="domain-list">
          {organization.collections.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              <CollectionEditor
                collection={c}
                organization={organization}
                run={run}
                pending={pending}
              />
              <span>
                {c.merged_into_id ? "Merged" : c.archived ? "Archived" : "Active"} ·{" "}
                {c.parent_id
                  ? (organization.collections.find((p) => p.id === c.parent_id)?.name ??
                    "Parent unavailable")
                  : "Root"}
              </span>
              <button
                type="button"
                disabled={pending || Boolean(c.merged_into_id)}
                onClick={() =>
                  run(() =>
                    request(`/collections/${c.id}`, {
                      request_key: key(),
                      expected_revision: c.revision,
                      name: c.name,
                      parent_id: c.parent_id,
                      archived: !c.archived,
                    }),
                  )
                }
              >
                {c.archived ? "Restore collection" : "Archive collection"}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function LocalWorkspace({ mode }: { mode: string }) {
  const client = useQueryClient(),
    [params, setParams] = useSearchParams(),
    [search, setSearch] = useState(""),
    [sourceLimit, setSourceLimit] = useState(100),
    [inboxFilter, setInboxFilter] = useState("all"),
    [message, setMessage] = useState("");
  const snapshot = useQuery({
    queryKey: ["local-domain"],
    queryFn: async () => localDomainSnapshotSchema.parse(await request("/")),
    refetchInterval: 4000,
  });
  const organization = useQuery({
    queryKey: ["local-organization"],
    queryFn: async () => orgSchema.parse(await request("/organization")),
  });
  const agents = useQuery({
    queryKey: ["local-agents"],
    queryFn: async () => agentViewSchema.parse(await request("/agents")),
    enabled: ["sources", "inbox", "agents"].includes(mode),
  });
  const events = useQuery({
    queryKey: ["local-events"],
    queryFn: async () =>
      z
        .object({
          events: z.array(
            z.object({
              id: z.string(),
              item_id: z.string(),
              kind: z.string(),
              title: z.string(),
              actor: z.object({ kind: z.string(), id: z.string() }),
              at: z.string(),
              revision: z.number(),
            }),
          ),
        })
        .parse(await request("/changes")),
    enabled: mode === "activity",
  });
  const mutation = useMutation({
    mutationFn: (work: () => Promise<unknown>) => work(),
    onSuccess: async () => {
      setMessage("Saved locally.");
      for (const queryKey of [
        ["local-domain"],
        ["local-source"],
        ["local-organization"],
        ["local-agents"],
        ["local-vault"],
        ["local-events"],
      ])
        await client.invalidateQueries({ queryKey });
    },
  });
  const run: Run = (work) => {
    setMessage("");
    mutation.mutate(work);
  };
  const select = (id: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old);
      next.set("source", id);
      return next;
    });
  const org = organization.data ?? { projects: [], collections: [] };
  if (snapshot.isPending) return <p role="status">Reading local source workspace…</p>;
  if (snapshot.isError)
    return (
      <p role="alert">
        {snapshot.error.message}{" "}
        <button type="button" onClick={() => void snapshot.refetch()}>
          Retry
        </button>
      </p>
    );
  const data = snapshot.data,
    sources = data.sources
      .filter(
        (r) =>
          (mode === "sources" || r.data.archived !== true) &&
          `${r.data.title ?? ""} ${r.data.tags ?? ""}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()) &&
          (inboxFilter === "all" || r.data.processing_state === inboxFilter),
      )
      .sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) || a.entity_id.localeCompare(b.entity_id),
      );
  return (
    <section className="domain-workspace" aria-label="Local source workspace">
      {mutation.isError && <p role="alert">{mutation.error.message}</p>}
      {message && <p role="status">{message}</p>}
      {data.warnings.length > 0 && (
        <details className="domain-panel">
          <summary>Local integrity notices — existing files preserved</summary>
          <ul>
            {data.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      {["capture", "sources", "inbox"].includes(mode) && (
        <CapturePanel
          organization={org}
          onSaved={(id) => {
            select(id);
            setMessage(
              "Source saved. Open Sources to inspect its original, versions and processing controls.",
            );
          }}
        />
      )}
      {["sources", "inbox"].includes(mode) && (
        <>
          <DirectoryImport run={run} pending={mutation.isPending} />
          <div className="domain-actions">
            <Field label="Search sources">
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
            </Field>
            <Field label="Source state">
              <select value={inboxFilter} onChange={(e) => setInboxFilter(e.target.value)}>
                {[
                  "all",
                  "captured",
                  "indexing",
                  "awaiting_agent",
                  "claimed",
                  "review_pending",
                  "organized",
                  "failed",
                ].map((state) => (
                  <option key={state} value={state}>
                    {state.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="domain-split">
            <section className="domain-panel">
              <h2>{mode === "inbox" ? "Source Inbox" : "Sources and originals"}</h2>
              {sources.length ? (
                <ul className="domain-list">
                  {sources.slice(0, sourceLimit).map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        aria-pressed={params.get("source") === r.entity_id}
                        onClick={() => select(r.entity_id)}
                      >
                        <strong>{String(r.data.title)}</strong>
                        <span>
                          {String(r.data.processing_state).replaceAll("_", " ")} ·{" "}
                          {String(r.data.scope)}
                          {r.data.archived ? " · archived" : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>
                  No sources in this view. Capturing a source preserves it without starting an
                  agent.
                </Empty>
              )}
              {sources.length > sourceLimit && (
                <button type="button" onClick={() => setSourceLimit((limit) => limit + 100)}>
                  Show more sources ({sourceLimit} of {sources.length})
                </button>
              )}
            </section>
            {params.get("source") ? (
              <SourceDetail
                key={params.get("source")}
                id={params.get("source")!}
                agents={agents.data?.agents ?? []}
                organization={org}
                run={run}
                pending={mutation.isPending}
              />
            ) : (
              <section className="domain-panel">
                <Empty>Select a source to inspect its original and versions.</Empty>
              </section>
            )}
          </div>
        </>
      )}
      {mode === "review" && (
        <ReviewView
          records={[
            ...data.memories,
            ...data.entities,
            ...data.relationships,
            ...data.reviews.filter((r) => r.data.status === "pending"),
          ]}
          run={run}
          pending={mutation.isPending}
        />
      )}
      {mode === "agents" && (
        <>
          <AgentSettings
            agents={agents.data?.agents ?? []}
            organization={org}
            run={run}
            pending={mutation.isPending}
          />
          <ProcessingSettings />
        </>
      )}
      {mode === "organization" && (
        <OrganizationView organization={org} run={run} pending={mutation.isPending} />
      )}
      {mode === "backup" && <BackupView run={run} pending={mutation.isPending} />}
      {mode === "search" && <SearchView organization={org} />}
      {mode === "activity" && (
        <section className="domain-panel">
          <h2>Actual local changes</h2>
          <p className="muted">
            Recorded commits show their API actor. Direct file edits are identified by integrity
            notices, without invented authorship.
          </p>
          {events.isPending ? (
            <p role="status">Reading changes…</p>
          ) : events.isError ? (
            <p role="alert">{events.error.message}</p>
          ) : events.data?.events.length ? (
            <ul className="domain-list">
              {events.data.events.map((e) => (
                <li key={e.id}>
                  <strong>{e.title}</strong>
                  <span>
                    {e.kind} · revision {e.revision} · {e.actor.kind} ·{" "}
                    {new Date(e.at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No domain changes yet.</Empty>
          )}
        </section>
      )}
    </section>
  );
}

function ProcessingSettings() {
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: ["local-processing-settings"],
    queryFn: async () =>
      z
        .object({ revision: z.number(), auto_classify: z.boolean() })
        .parse(await request("/settings")),
  });
  const [draft, setDraft] = useState<boolean | null>(null);
  const save = useMutation({
    mutationFn: async () =>
      request("/settings", {
        request_key: key(),
        expected_revision: settings.data?.revision ?? 0,
        auto_classify: draft ?? settings.data?.auto_classify ?? false,
      }),
    onSuccess: async () => {
      setDraft(null);
      await client.invalidateQueries({ queryKey: ["local-processing-settings"] });
    },
  });
  return (
    <section className="domain-panel">
      <h2>Processing defaults</h2>
      <p className="muted">
        Sources need an explicit named-agent grant. No agent starts automatically. Classification
        suggestions normally wait for review.
      </p>
      {settings.isPending ? (
        <p role="status">Reading local settings…</p>
      ) : settings.isError ? (
        <p role="alert">{settings.error.message}</p>
      ) : (
        <>
          <label className="domain-check">
            <input
              type="checkbox"
              checked={draft ?? settings.data.auto_classify}
              onChange={(event) => setDraft(event.target.checked)}
            />{" "}
            Apply high-confidence collection suggestions automatically
          </label>
          <p className="muted">
            Only existing allowed collections at confidence 0.85 or above qualify. Manual exclusions
            and locked choices remain in force. Memory and relationship claims still need review.
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={save.isPending || draft === null}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving defaults…" : "Save processing defaults"}
          </button>
        </>
      )}
      {save.isError && (
        <p role="alert">
          {save.error.message}. Reload settings before retrying a revision conflict.
        </p>
      )}
      {save.isSuccess && <p role="status">Processing defaults saved locally.</p>}
    </section>
  );
}

function ProjectEditor({
  project,
  run,
  pending,
}: {
  project: Organization["projects"][number];
  run: Run;
  pending: boolean;
}) {
  const [name, setName] = useState(project.name),
    [description, setDescription] = useState(project.description);
  return (
    <details>
      <summary>Edit project</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            request(`/projects/${project.id}`, {
              request_key: key(),
              expected_revision: project.revision,
              name,
              description,
            }),
          );
        }}
      >
        <Field label="Project name">
          <input required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Project description">
          <textarea
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <button disabled={pending} type="submit">
          Save project details
        </button>
      </form>
    </details>
  );
}
function CollectionEditor({
  collection,
  organization,
  run,
  pending,
}: {
  collection: Organization["collections"][number];
  organization: Organization;
  run: Run;
  pending: boolean;
}) {
  const [name, setName] = useState(collection.name),
    [parent, setParent] = useState(collection.parent_id ?? ""),
    [target, setTarget] = useState(""),
    [childMappings, setChildMappings] = useState<Record<string, string>>({}),
    [membershipMappings, setMembershipMappings] = useState<Record<string, "include" | "exclude">>(
      {},
    );
  const preview = useQuery({
    queryKey: ["merge-preview", collection.id, target, collection.revision],
    enabled: Boolean(target),
    queryFn: async () =>
      z
        .object({
          children: z.array(
            z.object({
              source_id: z.string(),
              source_name: z.string(),
              target_id: z.string(),
              target_name: z.string(),
            }),
          ),
          memberships: z.array(z.object({ source_id: z.string(), title: z.string() })),
        })
        .parse(await request(`/collections/${collection.id}/merge-preview?target=${target}`)),
  });
  return (
    <details>
      <summary>Edit, move or merge collection</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            request(`/collections/${collection.id}`, {
              request_key: key(),
              expected_revision: collection.revision,
              name,
              parent_id: parent || null,
              archived: collection.archived,
            }),
          );
        }}
      >
        <Field label="Collection name">
          <input required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Move under collection">
          <select value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">Root collection</option>
            {organization.collections
              .filter((c) => c.id !== collection.id && !c.archived)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        <button type="submit" disabled={pending || Boolean(collection.merged_into_id)}>
          Save collection
        </button>
      </form>
      <details>
        <summary>Merge with explicit conflict choices</summary>
        <p>
          Memberships and children move to the target. The original collection identity stays
          archived. Conflicts require explicit mappings before anything changes.
        </p>
        <Field label="Merge target">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose target</option>
            {organization.collections
              .filter((c) => c.id !== collection.id && !c.archived)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        {preview.isError && <p role="alert">{preview.error.message}</p>}
        {preview.data?.children.map((child) => (
          <label className="domain-checkbox" key={child.source_id}>
            <input
              type="checkbox"
              checked={childMappings[child.source_id] === child.target_id}
              onChange={(e) =>
                setChildMappings((old) => ({
                  ...old,
                  [child.source_id]: e.target.checked ? child.target_id : "",
                }))
              }
            />
            Merge duplicate child “{child.source_name}” into “{child.target_name}”
          </label>
        ))}
        {preview.data?.memberships.map((item) => (
          <Field label={`Membership for ${item.title}`} key={item.source_id}>
            <select
              value={membershipMappings[item.source_id] ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "include" || value === "exclude")
                  setMembershipMappings((old) => ({ ...old, [item.source_id]: value }));
              }}
            >
              <option value="">Choose how to resolve the conflict</option>
              <option value="include">Include in the merged collection</option>
              <option value="exclude">Keep excluded from the merged collection</option>
            </select>
          </Field>
        ))}
        <button
          type="button"
          disabled={
            pending ||
            !target ||
            collection.archived ||
            preview.isPending ||
            preview.isError ||
            Boolean(
              preview.data?.children.some((c) => childMappings[c.source_id] !== c.target_id),
            ) ||
            Boolean(preview.data?.memberships.some((m) => !membershipMappings[m.source_id]))
          }
          onClick={() =>
            run(async () =>
              request(`/collections/${collection.id}/merge`, {
                request_key: key(),
                expected_revision: collection.revision,
                target_id: target,
                expected_target_revision: organization.collections.find((c) => c.id === target)
                  ?.revision,
                child_conflicts: childMappings,
                membership_conflicts: membershipMappings,
              }),
            )
          }
        >
          Merge into selected collection
        </button>
      </details>
    </details>
  );
}

function SourceAccess({
  source,
  revision,
  agents,
  organization,
  run,
  pending,
}: {
  source: z.infer<typeof localSourceSchema>;
  revision: number;
  agents: AgentView["agents"];
  organization: Organization;
  run: Run;
  pending: boolean;
}) {
  const [scope, setScope] = useState<string>(source.scope),
    [project, setProject] = useState(source.project_id ?? ""),
    [agent, setAgent] = useState(source.owner_agent_id ?? ""),
    [audience, setAudience] = useState(source.audience);
  return (
    <details>
      <summary>General API visibility</summary>
      <p>
        Derived facts also require access to every original source. Changing visibility does not
        recall previously delivered text.
      </p>
      <Field label="Source visibility">
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          {["personal", "project", "global_development", "agent_private", "shared_agents"].map(
            (v) => (
              <option key={v} value={v}>
                {v.replaceAll("_", " ")}
              </option>
            ),
          )}
        </select>
      </Field>
      <Field label="Source project">
        <select value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">No project</option>
          {organization.projects
            .filter((p) => !p.archived)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </Field>
      {scope === "agent_private" && (
        <Field label="Private agent">
          <select value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="">Choose agent</option>
            {agents
              .filter((a) => !a.revoked_at && !a.disabled)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </Field>
      )}
      {scope === "shared_agents" &&
        agents
          .filter((a) => !a.revoked_at && !a.disabled)
          .map((a) => (
            <label className="domain-checkbox" key={a.id}>
              <input
                type="checkbox"
                checked={audience.includes(a.id)}
                onChange={(e) =>
                  setAudience(
                    e.target.checked ? [...audience, a.id] : audience.filter((id) => id !== a.id),
                  )
                }
              />
              {a.name}
            </label>
          ))}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(() =>
            request(`/sources/${source.id}/access`, {
              request_key: key(),
              expected_revision: revision,
              scope,
              project_id: project || null,
              owner_agent_id: scope === "agent_private" ? agent || null : null,
              audience: scope === "shared_agents" ? audience : [],
            }),
          )
        }
      >
        Save source visibility
      </button>
    </details>
  );
}

async function waitOperation(start: unknown) {
  const { operation_id } = z.object({ operation_id: z.string() }).parse(start);
  for (let i = 0; i < 1200; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const state = z
      .object({ state: z.string(), result: z.unknown().optional(), error: z.string().optional() })
      .parse(await request(`/operations/${operation_id}`));
    if (state.state === "completed") return state.result;
    if (state.state !== "running")
      throw new Error(
        state.error ?? "Local backup operation interrupted; original files preserved.",
      );
  }
  throw new Error("Operation continues locally. Its ID is " + operation_id);
}

function SearchView({ organization }: { organization: Organization }) {
  const [query, setQuery] = useState(""),
    [project, setProject] = useState(""),
    [history, setHistory] = useState(false),
    [packet, setPacket] = useState<z.infer<typeof localContextPacketSchema> | null>(null),
    [earlierItems, setEarlierItems] = useState<z.infer<typeof localContextPacketSchema>["items"]>(
      [],
    ),
    [submitted, setSubmitted] = useState<{
      query: string;
      project_id?: string;
      token_budget: number;
      include_history: boolean;
    } | null>(null),
    [trace, setTrace] = useState<LocalDomainRecord | null>(null);
  const search = useMutation({
    mutationFn: async () => {
      const input = {
        query,
        ...(project ? { project_id: project } : {}),
        token_budget: 8192,
        include_history: history,
      };
      setSubmitted(input);
      return localContextPacketSchema.parse(await request("/retrieval", input));
    },
    onSuccess: (value) => {
      setPacket(value);
      setEarlierItems([]);
      setTrace(null);
    },
  });
  const more = useMutation({
    mutationFn: async () => {
      if (!submitted || !packet?.continuation) throw Error("Run a new search first.");
      return localContextPacketSchema.parse(
        await request("/retrieval", { ...submitted, continuation: packet.continuation }),
      );
    },
    onSuccess: (value) => {
      setEarlierItems((previous) => [...previous, ...(packet?.items ?? [])]);
      setPacket(value);
      setTrace(null);
    },
  });
  return (
    <section className="domain-panel">
      <h2>Search sources and reviewed knowledge</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          more.reset();
          search.mutate();
        }}
      >
        <Field label="Search knowledge">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
        <Field label="Search project">
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">All accessible projects</option>
            {organization.projects
              .filter((p) => !p.archived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <label className="domain-checkbox">
          <input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} />
          Include proposals and historical facts in this owner view
        </label>
        <button type="submit" disabled={search.isPending || more.isPending}>
          {search.isPending ? "Searching local files…" : "Search local knowledge"}
        </button>
      </form>
      {search.isError && <p role="alert">{search.error.message}</p>}
      {more.isError && (
        <p role="alert">{more.error.message}. Run a new search if the catalog changed.</p>
      )}
      {packet && (
        <>
          <p className="muted">
            {earlierItems.length + packet.items.length} complete results · latest response{" "}
            {packet.budget.used} of {packet.budget.requested} conservative context units
          </p>
          {packet.warnings.map((w) => (
            <p role="status" key={w}>
              {w}
            </p>
          ))}
          {[...earlierItems, ...packet.items].map((item) => (
            <article className="domain-panel" key={item.id}>
              <h3>{item.title}</h3>
              {item.type === "relationship" ||
              (["memory", "entity"].includes(item.type) && item.status !== "active") ? (
                <NavLink to={`/review?item=${item.id}`}>
                  Inspect this recorded item and exact evidence
                </NavLink>
              ) : (
                <NavLink to={`/graph?note=${item.id}`}>
                  Show this recorded item in the graph
                </NavLink>
              )}
              <p className="file-kind">
                {item.type} · {item.status}
              </p>
              <p>{item.summary}</p>
              {item.source_refs.map((e) => (
                <Evidence
                  key={`${e.source_version_id}:${e.start_offset}:${e.end_offset}`}
                  evidence={e}
                />
              ))}
            </article>
          ))}
          {packet.has_more && (
            <button
              type="button"
              disabled={
                more.isPending || search.isPending || !packet.continuation || !packet.items.length
              }
              onClick={() => more.mutate()}
            >
              {more.isPending ? "Reading more results…" : "Load more matching results"}
            </button>
          )}
          <button
            type="button"
            onClick={async () =>
              setTrace(localRecordSchema.parse(await request(`/traces/${packet.trace_id}`)))
            }
          >
            Inspect this retrieval trace
          </button>
          {trace && (
            <div>
              <p>Recorded results in rank order. Raw search text is not stored.</p>
              <ol>
                {z
                  .array(z.string())
                  .parse(trace.data.item_ids)
                  .map((id) => (
                    <li key={id}>{packet.items.find((i) => i.id === id)?.title ?? id}</li>
                  ))}
              </ol>
              <p className="muted">
                {Math.round(Number(trace.data.elapsed_ms))}ms · Trace {trace.entity_id}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function DirectoryImport({ run, pending }: { run: Run; pending: boolean }) {
  const [files, setFiles] = useState<File[]>([]),
    [results, setResults] = useState<{ path: string; id?: string; error?: string }[]>([]),
    [busy, setBusy] = useState(false),
    stop = useRef(false),
    receipts = useRef(new Map<string, { request_key: string; upload_id?: string }>());
  const preview = previewDirectory(
    files.map((f) => ({ path: f.webkitRelativePath || f.name, bytes: f.size })),
  );
  async function importFiles() {
    setBusy(true);
    stop.current = false;
    const report: { path: string; id?: string; error?: string }[] = [];
    try {
      for (const candidate of preview.accepted) {
        if (stop.current) break;
        const file = files.find((f) => (f.webkitRelativePath || f.name) === candidate.path);
        if (!file) continue;
        const fingerprint = `${candidate.path}:${file.size}:${file.lastModified}`;
        let receipt = receipts.current.get(fingerprint);
        if (!receipt) {
          receipt = { request_key: key() };
          receipts.current.set(fingerprint, receipt);
        }
        try {
          if (!receipt.upload_id) {
            const response = await fetch(prefix + "/uploads", {
              method: "POST",
              headers: {
                "Content-Type": "application/octet-stream",
                "X-Atlas-Media-Type": /\.md$/i.test(candidate.path)
                  ? "text/markdown"
                  : "text/plain",
              },
              body: file,
            });
            if (!response.ok) throw Error("File upload failed");
            receipt.upload_id = z
              .object({ upload_id: z.string() })
              .parse(await response.json()).upload_id;
          }
          const saved = z.object({ source_id: z.string() }).parse(
            await request("/sources", {
              request_key: receipt.request_key,
              title: candidate.path.slice(-160),
              input_type: /\.md$/i.test(candidate.path) ? "markdown" : "text",
              scope: "personal",
              project_id: null,
              content: "",
              upload_id: receipt.upload_id,
            }),
          );
          report.push({ path: candidate.path, id: saved.source_id });
        } catch (e) {
          report.push({
            path: candidate.path,
            error: e instanceof Error ? e.message : "Import failed",
          });
        }
        setResults([...report]);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="domain-panel">
      <summary>Import selected text folder</summary>
      <p>
        Choose a folder, review its inventory, then import only the listed Markdown/text files as
        personal sources. Hidden folders, builds and dependencies are excluded. Limit: 100 files /
        10 MiB. No agent starts automatically.
      </p>
      <Field label="Text folder to preview">
        <input
          type="file"
          multiple
          ref={(el) => {
            el?.setAttribute("webkitdirectory", "");
          }}
          disabled={busy}
          onChange={(e) => {
            setFiles(Array.from(e.target.files ?? []));
            setResults([]);
            receipts.current.clear();
          }}
        />
      </Field>
      {files.length > 0 && (
        <>
          <p>
            {preview.accepted.length} selected · {preview.total_bytes.toLocaleString()} bytes ·{" "}
            {preview.rejected.length} excluded
          </p>
          <details>
            <summary>Inspect selected and excluded files</summary>
            <ul>
              {preview.accepted.map((f) => (
                <li key={f.path}>
                  {f.path} · {f.bytes} bytes
                </li>
              ))}
              {preview.rejected.map((f) => (
                <li key={f.path}>
                  {f.path} · {f.reason}
                </li>
              ))}
            </ul>
          </details>
          <button
            type="button"
            disabled={pending || busy || !preview.accepted.length}
            onClick={() => run(importFiles)}
          >
            Import selected files
          </button>
        </>
      )}
      {busy && (
        <button
          type="button"
          onClick={() => {
            stop.current = true;
          }}
        >
          Stop after this file
        </button>
      )}
      {results.length > 0 && (
        <div role="status">
          <p>
            {results.filter((r) => r.id).length} saved; {results.filter((r) => r.error).length}{" "}
            failed. Each successful source is preserved independently.
          </p>
          <ul>
            {results.map((r) => (
              <li key={r.path}>
                {r.id ? (
                  <NavLink to={`/sources?source=${r.id}`}>{r.path}</NavLink>
                ) : (
                  `${r.path}: ${r.error}`
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={pending || busy}
            onClick={() =>
              run(async () => {
                for (const saved of results.filter((r) => r.id)) {
                  const detail = z
                    .object({ record: localRecordSchema })
                    .parse(await request(`/sources/${saved.id}`));
                  await request(`/sources/${saved.id}/archive`, {
                    request_key: key(),
                    expected_revision: detail.record.revision,
                  });
                }
                return { archived: true };
              })
            }
          >
            Archive this imported batch
          </button>
        </div>
      )}
    </details>
  );
}

function AgentEditor({
  agent,
  organization,
  run,
  pending,
}: {
  agent: AgentView["agents"][number];
  organization: Organization;
  run: Run;
  pending: boolean;
}) {
  const [capabilities, setCapabilities] = useState(agent.capabilities),
    [projects, setProjects] = useState(agent.project_ids),
    [scopes, setScopes] = useState(agent.scopes);
  return (
    <details>
      <summary>Edit API permissions</summary>
      <p>
        Permission changes affect future API calls. Windows filesystem access is governed
        separately.
      </p>
      {[
        "read",
        "propose",
        "process_knowledge",
        ...(agent.capabilities.includes("capture_project_knowledge")
          ? ["capture_project_knowledge"]
          : []),
      ].map((cap) => (
        <label className="domain-checkbox" key={cap}>
          <input
            type="checkbox"
            checked={capabilities.includes(cap)}
            onChange={(e) =>
              setCapabilities(
                e.target.checked ? [...capabilities, cap] : capabilities.filter((c) => c !== cap),
              )
            }
          />
          {cap.replaceAll("_", " ")}
        </label>
      ))}
      <p>Readable projects</p>
      {organization.projects
        .filter((p) => !p.archived)
        .map((p) => (
          <label className="domain-checkbox" key={p.id}>
            <input
              type="checkbox"
              checked={projects.includes(p.id)}
              onChange={(e) =>
                setProjects(
                  e.target.checked ? [...projects, p.id] : projects.filter((id) => id !== p.id),
                )
              }
            />
            {p.name}
          </label>
        ))}
      <p>Additional scopes</p>
      {["global_development", "agent_private", "shared_agents"].map((scope) => (
        <label className="domain-checkbox" key={scope}>
          <input
            type="checkbox"
            checked={scopes.includes(scope)}
            onChange={(e) =>
              setScopes(e.target.checked ? [...scopes, scope] : scopes.filter((s) => s !== scope))
            }
          />
          {scope.replaceAll("_", " ")}
        </label>
      ))}
      <button
        type="button"
        disabled={pending || Boolean(agent.revoked_at)}
        onClick={() =>
          run(() =>
            request(`/agents/${agent.id}`, {
              request_key: key(),
              expected_revision: agent.revision,
              capabilities,
              project_ids: projects,
              scopes,
            }),
          )
        }
      >
        Save agent permissions
      </button>
      <button
        type="button"
        disabled={pending || Boolean(agent.revoked_at)}
        onClick={() =>
          run(() =>
            request(`/agents/${agent.id}`, {
              request_key: key(),
              expected_revision: agent.revision,
              disabled: !agent.disabled,
            }),
          )
        }
      >
        {agent.disabled ? "Enable agent" : "Pause API access"}
      </button>
    </details>
  );
}

function RetrievalSettings({
  record,
  run,
  pending,
}: {
  record: LocalDomainRecord;
  run: Run;
  pending: boolean;
}) {
  const [critical, setCritical] = useState(record.data.critical === true),
    [level, setLevel] = useState(String(record.data.retrieval_level ?? "detail")),
    [reason, setReason] = useState("");
  return (
    <details>
      <summary>Context priority</summary>
      <label className="domain-checkbox">
        <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} />
        Critical constraint: warn if it cannot fit the context budget
      </label>
      <Field label="Retrieval level">
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          {["core", "project", "detail"].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Priority change reason">
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <button
        type="button"
        disabled={pending || !reason.trim() || Boolean(record.data.requires_revalidation)}
        onClick={() =>
          run(() =>
            request(`/memories/${record.entity_id}/retrieval-settings`, {
              request_key: key(),
              expected_revision: record.revision,
              critical,
              retrieval_level: level,
              reason,
            }),
          )
        }
      >
        Save context priority
      </button>
    </details>
  );
}
