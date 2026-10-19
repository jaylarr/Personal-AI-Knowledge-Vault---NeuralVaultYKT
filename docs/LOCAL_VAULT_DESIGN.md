# L01 local vault amendment

## K01 durable knowledge amendment — 2026-10-17

Owner/Knowledge stores explicit reusable owner preferences/constraints; project Knowledge folders store scoped decisions, facts and lessons. Stable subject keys and immutable supersedes links determine current heads. New frontmatter is flat; older Notes/provenance are preserved as activity. Default context selects current owner/project knowledge and returns marked summaries; detail=full and direct files retain rich bodies. Direct edits are returned in full with a warning, candidates/conflicts/superseded claims are excluded, and scan/privacy/history boundaries remain. Templates are excluded from scanning. See KNOWLEDGE_CAPTURE_POLICY.md and KNOWLEDGE_QUALITY_REPORT.md. The L01 file architecture below remains in effect.


2026-10-17 owner decision supersedes the cloud knowledge storage design: one local folder is the source of truth, accessible directly by agents and usable as an Obsidian vault. Existing Neon content is exported read-only and preserved locally; cloud history/resources are not deleted. Normal local app/MCP operation must make no Neon/Auth/storage requests or knowledge writes.

Location: Vault/ inside this Windows project. Projects/<readable-name-id>/Project.md and its Notes/<readable-title-id>.md, Collections.md, optional Attachments/, and .atlas/ local metadata/history. YAML frontmatter carries stable IDs and provenance; bodies are ordinary Markdown. [[wikilinks]], relative Markdown links and project membership supply graph edges. Unknown/malformed files are preserved and reported. Direct edits appear within the app's four-second foreground refresh interval; no cloud index is involved.

The existing MCP tool names remain, backed by local files; direct folder access is a first-class route for agents. Local HTTP remains loopback-only with Host/Origin enforcement; agent writes require a local protected credential. The browser is a single-user local folder viewer, not a cloud account boundary. Private machine/filesystem permissions are the access boundary for direct file access. Cloud credential/grant semantics do not pretend to apply to arbitrary local processes.

Implement a basic interactive graph using actual project/note/link data, plus a readable list and empty/malformed states. This is not the future advanced semantic/entity graph. Filesystem writes use stable IDs, exclusive creation, serialized per-vault locking, safe paths/symlink refusal, byte checks, request conflict protection, recoverable history and no broad deletion. Existing user edits win over generated retries.

Implemented local access boundary: this is a trusted single-user Windows-session app. Host/Origin/Sec-Fetch checks, strict local-session cookies and a protected agent write credential prevent ordinary cross-site browser access. They are not a multi-user OS authorization system; direct folder access and other trusted local programs use the machine's filesystem/session permissions. No claim of per-agent cloud RLS over arbitrary file access is made.

History retains versions created/observed by ATLAS, not every intervening external editor keystroke, and does not protect against disk loss. Back up the whole folder. Scans are bounded to 2MiB/file, 16MiB total/2000 notes, 5000 visited entries and depth12, with explicit notices; graph renders at most300 files. Semantic search/review, URL/binary ingestion, advanced graph layout and scheduled backup remain separate work.

Compatibility references: [Obsidian local data storage](https://obsidian.md/help/data-storage), [internal links](https://obsidian.md/help/links). YAML frontmatter uses the exact yaml@2.9.1 parser. Obsidian itself was not installed/launched as part of this change.
