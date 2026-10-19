# ATLAS

The local workspace now includes Inbox, immutable Sources, evidence review, agents, projects/collections, search, activity, graph and verified backup/restore controls. Capture notes, selected files/folders, HTTPS pages, text PDFs, inert n8n exports and selected supported conversation turns as source material. Agent proposals require owner review before becoming approved facts. See [current acceptance evidence](docs/LOCAL_COMPLETION_REPORT.md).

The MCP server exposes eighteen tools: the original three knowledge tools plus fifteen source/retrieval/proposal/task tools. The existing Codex credential retains narrow compatibility permissions; added tools do not silently grant private-source access. See [agent workflow](docs/AGENT_WORKFLOW.md) and [backup instructions](docs/BACKUP.md).

## Durable agent knowledge

ATLAS captures reusable preferences, constraints, decisions, verified facts and lessons with scope/evidence; routine work logs stay in Activity. Owner/Knowledge and each project's Knowledge folder use ordinary Markdown. The workspace/graph defaults to Knowledge; All files preserves original notes. Agents can request concise or full context and save explicit linked corrections without rewriting history. No separate AI API/database is needed. See [capture policy](docs/KNOWLEDGE_CAPTURE_POLICY.md) and [verified implementation](docs/KNOWLEDGE_QUALITY_REPORT.md).


A local Markdown knowledge vault for existing agents. One folder is the source of truth; no separate AI API or database is needed for normal use.

Current storage is `Vault/` in this project, as requested by the owner (L01). Open it in Obsidian or any editor. Agents find/create project pages and save Markdown notes automatically; ATLAS displays the same files, searches their text and shows a real file/link graph. Existing Neon knowledge was exported read-only and verified locally. Cloud copies/resources remain historical; no sync or normal-runtime cloud requests/writes are enabled. See [local design](docs/LOCAL_VAULT_DESIGN.md) and [verification](docs/LOCAL_VAULT_REPORT.md).

## Local foundation

Requirements: Node 24.18+, pnpm 11.25.0 and Windows PowerShell. Docker is needed only for historical SQL tests, not local vault use.

Automatic Codex project knowledge is installed on this PC: agents find/create their ATLAS project, retrieve context and save durable checkpoints. See [agent workflow](docs/AGENT_WORKFLOW.md) and [verified results](docs/AGENT_WORKFLOW_REPORT.md). Manual project forms are optional.

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Open `http://localhost:4317` or `/graph`. Normal mode reads local Markdown without Neon sign-in. The installed launcher uses the existing Windows-protected credential in memory for agent API calls; direct file access uses normal filesystem permissions. `/ready` reports local storage availability separately from the unfinished broader product roadmap.

For development use `pnpm dev`. The browser uses `http://localhost:5173`; the API remains on loopback port 4317. Ports never change silently. See [setup](docs/SETUP.md), [current progress](docs/PROGRESS.md) and [approved handoff](docs/plans/2026-10-16-atlas-implementation-plan.md).

## Checks

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm test:unit
pnpm db:test:start
pnpm db:migrate:local
pnpm test:db
pnpm db:test:stop
```

Local graph/browser checks: `pnpm exec playwright test --config tests/playwright.local.config.ts`. The separate SQL harness is historical compatibility coverage; it uses only the isolated `atlas-tests` Docker project. Never point disposable tests at Neon. The original cloud-centric handoff is superseded by L01 for knowledge storage and local access.
