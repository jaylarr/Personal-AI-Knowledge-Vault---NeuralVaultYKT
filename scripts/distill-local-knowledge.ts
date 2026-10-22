import { readFile, writeFile } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createLocalVault } from "@atlas/core/local-vault";
import {
  z,
  localCheckpointInputSchema,
  type LocalCheckpointInput,
  type KnowledgeFields,
} from "@atlas/contracts";
import { identifyRepository } from "../apps/mcp-server/src/repository.js";

const atlasProject = "6b650cd7-c14c-47f5-b41b-31aaf9ef48bc";
const portfolioProject = "53d7ac8f-2102-46aa-9ae3-0105add3b9b0";
export async function seedInputs() {
  const seeds: { projectId: string; input: LocalCheckpointInput }[] = [];
  function add(
    projectId: string,
    title: string,
    knowledge: KnowledgeFields,
    markdown: string,
    paths: string[],
    verification: string,
  ) {
    seeds.push({
      projectId,
      input: localCheckpointInputSchema.parse({
        title,
        kind: knowledge.type === "lesson" ? "lesson" : "decision",
        knowledge,
        markdown,
        provenance: { paths, verification },
        request_key: `k01-seed-${knowledge.key.replaceAll(".", "-")}-v1`,
      }),
    });
  }
  function owner(
    key: string,
    title: string,
    type: "preference" | "constraint",
    summary: string,
    applies: string,
    reason: string,
    statement: string,
    body: string,
    sourceIds: string[],
  ) {
    add(
      atlasProject,
      title,
      {
        type,
        scope: "owner",
        key,
        summary,
        rationale: reason,
        applies_when: applies,
        exceptions: [
          "Current human/project instructions and explicit read-only or privacy boundaries take precedence.",
        ],
        topics: ["workflow", "agents", "knowledge"],
        basis: "owner_explicit",
        source_statement: statement,
        source_refs: [],
        source_note_ids: sourceIds,
      },
      body,
      ["docs/KNOWLEDGE_CAPTURE_POLICY.md", "docs/CODEX_GLOBAL_INSTRUCTIONS.md"],
      "Explicit owner requests and supplied ATLAS instructions in this conversation; short scoped paraphrases, not inferred personality.",
    );
  }
  owner(
    "workflow.automatic-projects",
    "Automatic project context without setup forms",
    "preference",
    "The owner prefers ATLAS-connected agents to find/create project context and capture useful knowledge automatically, without manual project setup forms.",
    "Starting or continuing project work through this Windows ATLAS knowledge workflow.",
    "Reduce repeated manual project creation and context entry.",
    "The owner asked AI agents to create missing projects themselves and save useful knowledge rather than making the owner create everything.",
    "The owner wants project context to be maintained as part of normal agent work. A connected agent identifies the repository, finds or creates its project, loads relevant context, and records newly learned durable subjects when they are useful. The owner should not have to create project forms or repeat established context.\n\nThis preference concerns ATLAS knowledge management. It does not authorize deployment, external messaging, unrelated infrastructure changes or bypassing a current read-only instruction. A routine task with nothing useful to learn needs no new note.",
    ["81a53782-af09-46e0-b6c0-1bc722b2ef37"],
  );
  owner(
    "workflow.local-knowledge",
    "One local Markdown knowledge folder",
    "constraint",
    "The owner's ATLAS knowledge lives in one local Markdown vault accessible directly to agents and the app; cloud knowledge sync requires a later explicit request.",
    "Storing or retrieving knowledge in this owner's ATLAS workflow on this Windows PC.",
    "Agents should be able to use the same ordinary folder as an Obsidian-style vault.",
    "The owner explicitly requested local data in a single folder that agents can access, like Obsidian.",
    "Local Markdown is the source of truth for this knowledge workflow. Agents, the app and a compatible editor use the same vault folder; direct file access is a supported path, including when MCP is unavailable. Preserve stable identity, provenance and linked history so the folder remains useful outside a particular chat.\n\nThe prior Neon setup is historical context. New knowledge should not be written there as a side effect of normal agent work. This constraint does not request deletion of existing cloud history, and future sync would need a separate explicit owner request. Backups of the entire folder remain necessary for disk loss.",
    ["b73c59e0-4636-4585-bbdf-145106f7dda2"],
  );
  owner(
    "workflow.atlas-reasoning",
    "Connected agents reason; ATLAS stores files",
    "constraint",
    "For automatic ATLAS knowledge capture, existing connected agents perform reasoning; a separate AI API, model key or background AI agent is not needed.",
    "Designing inference or capture for this ATLAS knowledge workflow, rather than unrelated future applications.",
    "The owner chose to use agents already doing the project work to derive useful context.",
    "The owner explicitly confirmed that a separate AI API was no longer needed and wanted Codex or existing working agents to handle knowledge extraction.",
    "The working agent has the task context and is responsible for deciding what durable knowledge was learned. ATLAS validates and stores structured local Markdown; it does not need a second model service to summarize every exchange. The owner chose this arrangement when replacing the earlier separate-API proposal.\n\nKeep this constraint scoped to the knowledge workflow. It is not a universal ban on AI APIs in products the owner might later request. It also does not authorize launching another autonomous agent, reading credentials or adding a paid inference service to compensate for missing context.",
    ["81a53782-af09-46e0-b6c0-1bc722b2ef37"],
  );
  owner(
    "workflow.knowledge-quality",
    "Capture reusable knowledge instead of detailed work logs",
    "preference",
    "The owner wants solid reusable context about how they work, their preferences and things to avoid, with useful detail and evidence instead of copied requests or completion logs.",
    "Choosing what an agent should save or retrieve as durable knowledge after project work.",
    "Future agents should understand the owner's working choices without rereading entire tasks or repetitive implementation reports.",
    "The owner asked to update agent-stored knowledge so it captures valuable context about how they work, what they want and do not want, rather than the entire detailed request.",
    "The owner wants knowledge that improves later decisions: explicit preferences and constraints, scoped project decisions, stable facts, and reusable lessons. Preserve conditions, supported rationale, exceptions and evidence so a future agent can apply the knowledge accurately. A short generic slogan is insufficient when important context would be lost.\n\nA detailed description of an edit, its commands and passing tests is work history, not automatically durable knowledge. Save nothing when an ordinary task reveals no new reusable subject. One project's choice must not become a global preference, and agent guesses must remain clearly unconfirmed. Operational details stay available in the originating project's reports and activity history.",
    [],
  );

  const portfolioRoot = "C:/Users/user/Desktop/PROGRAMMING/PROFESSIONAL-PORTFOLIO";
  let css = "",
    component = "",
    verified = false;
  try {
    const identity = await identifyRepository(portfolioRoot);
    verified =
      identity.repository_digest ===
      "3095296aefffa60b50150fc9b90915dff139f2ab883e7f284da60fa430c05792";
    if (verified) {
      css = await readFile(join(portfolioRoot, "src/styles/homepage-showcases.css"), "utf8");
      component = await readFile(
        join(portfolioRoot, "src/components/public/ImmersiveProjectPanel.tsx"),
        "utf8",
      );
    }
  } catch {
    verified = false;
  }
  const sourceRules = /\.immersive-work-panel__screen\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  const plain =
    verified &&
    component.includes('className="immersive-work-panel__screen"') &&
    !/scenery|screen-glow|foreground-rock/.test(component) &&
    Boolean(sourceRules) &&
    !/border|background|padding|radius/.test(sourceRules);
  const mobile =
    verified &&
    /@media\s*\(max-width:\s*639px\)[\s\S]*?\.immersive-work-panel__description\s*\{[^}]*display:\s*none/.test(
      css,
    );
  add(
    portfolioProject,
    "Portfolio homepage screenshot styling is scoped to its media",
    {
      type: "project_fact",
      scope: "project",
      key: "homepage.cards.visual-style",
      summary:
        "The portfolio homepage uses a plain screenshot wrapper without frame styling in its shared CSS; surrounding cards retain their own borders and rounded corners.",
      applies_when:
        "Editing Selected Projects and Automation homepage media in PROFESSIONAL-PORTFOLIO.",
      exceptions: [
        "This does not remove parent card borders/radius, preview controls or lightbox behavior.",
        "This project-specific fact is not a global owner aesthetic preference.",
      ],
      topics: ["homepage", "screenshots", "portfolio"],
      basis: plain ? "verified_observation" : "historical_report",
      source_refs: [],
      source_note_ids: [
        "7edfe2ea-c201-47aa-a23f-a51851cd2010",
        "690796c0-8cfd-4496-8105-a64e1b5e7a04",
      ],
    },
    "The shared homepage panel presents screenshots directly rather than composing scenery and decorative foreground layers. In homepage-showcases.css the screenshot wrapper has no frame border, padding, background or radius rules. The parent card is a separate surface and retains its own border and radius.\n\nThis distinction matters when refining Selected Projects or Automation cards: a request to simplify screenshot media does not imply stripping the surrounding card design or removing preview/lightbox interactions. This is a scoped source-code observation, not a fresh rendered-browser claim or a statement that the owner dislikes decoration in every project. Historical reports remain linked for the change context.",
    ["src/components/public/ImmersiveProjectPanel.tsx", "src/styles/homepage-showcases.css"],
    plain
      ? "Read current component/CSS after normalized repository digest matched the existing portfolio project. Wrapper rules lack frame styling; component omits scenery paths. Source inspection only; no new browser verification."
      : "Historical agent reports only; current source identity/rules could not be confirmed. Keep as candidate.",
  );
  add(
    portfolioProject,
    "Portfolio homepage descriptions hide only at the mobile breakpoint",
    {
      type: "project_fact",
      scope: "project",
      key: "homepage.cards.mobile-descriptions",
      summary:
        "The portfolio's shared homepage card description is hidden at max-width639px; titles and numbering remain separate elements.",
      applies_when:
        "Editing compact mobile Selected Projects and Automation homepage cards in PROFESSIONAL-PORTFOLIO.",
      exceptions: [
        "Do not extend this rule to desktop descriptions or unrelated projects without a new request.",
      ],
      topics: ["homepage", "mobile", "descriptions"],
      basis: mobile ? "verified_observation" : "historical_report",
      source_refs: [],
      source_note_ids: ["c9061b36-e055-4a06-9732-7ef94f449e69"],
    },
    "The shared homepage panel has a separate description element. The max-width639px rule in homepage-showcases.css sets that element to display:none, while headings and numbering are separate component elements. This is a precise responsive behavior for the portfolio's homepage cards.\n\nKeep the breakpoint and surface attached to the fact. It does not establish a general owner preference to remove descriptive text from every mobile interface, and it should not be generalized to desktop views. Read the current shared stylesheet/component before extending the rule. The linked original report is historical evidence; current source inspection does not by itself prove every rendered viewport.",
    ["src/styles/homepage-showcases.css", "src/components/public/ImmersiveProjectPanel.tsx"],
    mobile
      ? "Repository identity matched; current max-width639px CSS contains description display:none. Source inspection only; not a new visual/browser check."
      : "Historical agent report only; current CSS could not be confirmed. Keep as candidate.",
  );
  add(
    atlasProject,
    "Bounded retry for transient NTFS lock contention",
    {
      type: "lesson",
      scope: "project",
      key: "storage.windows-lock-contention",
      summary:
        "On Windows, exclusive lock creation may encounter delete-pending EPERM; bounded retries handle transient contention while preserving live-lock ownership.",
      applies_when:
        "Maintaining ATLAS's local Windows vault writer and testing independent/concurrent captures.",
      exceptions: [
        "Do not steal a lock from a live process or treat persistent permission denial as successful acquisition.",
      ],
      topics: ["windows", "ntfs", "concurrency"],
      basis: "verified_observation",
      source_refs: [],
      source_note_ids: ["ca7c016a-88b4-4de5-a338-4fb3ed938c7c"],
    },
    "NTFS can report EPERM when an exclusive lock path is pending deletion by a prior writer. The local vault's lock-acquisition loop treats that Windows-specific state as transient and retries within its existing bounded limit. Live-process ownership is preserved; a persistent failure remains a failure.\n\nThis is useful when changing the file writer or diagnosing a concurrency regression. Keep separate the lock condition and a test runner's deadline: starting independent Node processes under a busy runner can exceed a short test timeout without proving that two writes escaped the lock. Verify actual record identity and resulting file counts. The original progress note and the current concurrency tests are evidence pointers, rather than a reason to copy build/test totals into the lesson.",
    [
      "packages/core/src/local-vault.ts",
      "tests/unit/local-vault.test.ts",
      "tests/unit/local-knowledge.test.ts",
    ],
    "Inspected the current Windows-only EPERM retry and bounded lock ownership checks; local concurrency regression tests verify one project/concept under competing writers.",
  );
  return seeds;
}
export async function localKnowledgeConfig() {
  const config = z
    .object({ mode: z.literal("local"), root: z.string(), agentId: z.uuid() })
    .parse(JSON.parse(await readFile(resolve(".local/vault.json"), "utf8")));
  if (resolve(config.root) !== resolve("Vault")) throw Error("Unexpected vault target");
  return config;
}
async function verifyOriginals() {
  const audit = await readFile(
    resolve("docs/plans/2026-10-17-agent-knowledge-capture-audit.md"),
    "utf8",
  );
  const manifestPath = (
    await readFile(resolve(".local/knowledge-quality-backup-path.txt"), "utf8")
  ).trim();
  if (!resolve(manifestPath).startsWith(resolve(".local/knowledge-quality-backup") + sep))
    throw Error("Invalid preservation manifest target");
  const manifest = z
    .array(z.object({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }))
    .parse(JSON.parse(await readFile(join(manifestPath, "original-vault-manifest.json"), "utf8")));
  for (const item of manifest) {
    const path = resolve(item.path);
    if (!path.startsWith(resolve("Vault") + sep)) throw Error("Invalid preservation path");
    const actual = createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
    if (actual !== item.sha256)
      throw Error(`Original changed; re-audit without overwriting: ${item.path}`);
  }
  const audited = [...audit.matchAll(/\| `([a-f0-9]{8})` \| `([a-f0-9]{64})` \|/g)];
  if (audited.length !== 9) throw Error("Audit manifest differs");
  for (const entry of audited) {
    const originals = manifest.filter((item) => item.path.endsWith(`-${entry[1]}.md`));
    if (originals.length !== 1 || originals[0]?.sha256 !== entry[2])
      throw Error(
        `Planning source changed before execution; re-audit ${entry[1]} without restoring it`,
      );
  }
  return manifest.length;
}
async function main() {
  const count = await verifyOriginals(),
    config = await localKnowledgeConfig(),
    seeds = await seedInputs();
  if (!process.argv.includes("--apply")) {
    process.stdout.write(
      `${JSON.stringify({ dry_run: true, preserved_originals: count, subjects: seeds.map((s) => ({ project: s.projectId, key: s.input.knowledge?.key, basis: s.input.knowledge?.basis, sources: s.input.knowledge?.source_note_ids })) }, null, 2)}\n`,
    );
    return;
  }
  const vault = createLocalVault(config.root, config.agentId),
    results = [];
  for (const seed of seeds) {
    await verifyOriginals();
    const saved = await vault.capture(seed.projectId, seed.input);
    if (saved.markdown !== seed.input.markdown)
      throw Error(`Existing subject was directly edited; inspect ${saved.path}`);
    results.push({
      key: saved.knowledge?.key,
      id: saved.id,
      path: saved.path,
      basis: saved.knowledge?.basis,
    });
  }
  await verifyOriginals();
  await writeFile(
    resolve(".local/knowledge-distillation-receipt.json"),
    JSON.stringify(
      { at: new Date().toISOString(), preserved_originals: count, records: results },
      null,
      2,
    ),
  );
  process.stdout.write(
    `PASS: ${results.length} durable subjects saved/reused; ${count} original files unchanged.\n`,
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
