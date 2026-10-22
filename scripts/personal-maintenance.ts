import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z, type LocalActor } from "@atlas/contracts";
import { createLocalVault } from "@atlas/core/local-vault";
import {
  createDomainService,
  createPersonalService,
  loadPersonalHosts,
  sha256,
  canonical,
} from "@atlas/core/local-domain";

const args = process.argv.slice(2),
  operation = args[0],
  inputPath = args[args.indexOf("--input") + 1],
  apply = args.includes("--apply");
if (!args.includes("--input") || !inputPath)
  throw Error(
    "Use an operation and --input <existing secret-free JSON scope file>. Dry-run is default.",
  );
const input = z
  .object({
    vault: z.string(),
    hosts_file: z.string(),
    host_id: z.string().optional(),
    scope_digest: z.string().optional(),
    cursor: z.number().int().nonnegative().default(0),
    skill_id: z.string().optional(),
    subject_id: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    output: z.string().optional(),
  })
  .strict()
  .parse(JSON.parse(await readFile(resolve(inputPath), "utf8")));
const vault = createLocalVault(resolve(input.vault)),
  domain = createDomainService(vault, { id: "owner-maintenance" }),
  hosts = await loadPersonalHosts(resolve(input.hosts_file)),
  personal = createPersonalService({ vault, domain, hosts }),
  owner: LocalActor = { kind: "owner", id: "local-owner" };
try {
  let result: unknown;
  if (["inventory", "backfill-preview"].includes(operation ?? "")) {
    if (!input.host_id) throw Error("host_id required");
    const inventory = await personal.sessions.adapter.inventory(input.host_id),
      sessions = [];
    for (const locator of inventory.entries) {
      try {
        const s = await personal.sessions.adapter.read(input.host_id, locator);
        sessions.push({
          session_key: s.session_key,
          session_revision: s.revision,
          locator_id: s.locator_id,
          terminal: s.terminal,
          subagent: s.subagent,
          retention_excluded: s.excluded,
          source_version: s.version,
        });
      } catch {
        sessions.push({ locator_id: locator, status: "unsupported_or_unavailable" });
      }
    }
    result = {
      host_id: input.host_id,
      sessions,
      complete: inventory.complete,
      scope_digest: sha256(canonical(sessions)),
      apply: false,
      warning: "Metadata preview only. No session has been semantically reviewed.",
    };
  } else if (operation === "backfill-apply" || operation === "reconcile") {
    if (!apply || !input.scope_digest || !input.host_id)
      throw Error("Apply needs --apply, host_id and matching preview scope_digest.");
    const inv = await personal.sessions.adapter.inventory(input.host_id),
      sessions = [];
    for (const locator of inv.entries) {
      try {
        const s = await personal.sessions.adapter.read(input.host_id, locator);
        sessions.push({
          session_key: s.session_key,
          session_revision: s.revision,
          locator_id: s.locator_id,
          terminal: s.terminal,
          subagent: s.subagent,
          retention_excluded: s.excluded,
          source_version: s.version,
        });
      } catch {
        sessions.push({ locator_id: locator, status: "unsupported_or_unavailable" });
      }
    }
    if (sha256(canonical(sessions)) !== input.scope_digest)
      throw Error("Preview scope changed; generate a new preview before applying.");
    const pages = [];
    let cursor = 0,
      scope: string | undefined;
    do {
      const page = await personal.sessions.scan(owner, {
        host_id: input.host_id,
        mode: "backfill",
        cursor,
        ...(scope ? { scope_digest: scope } : {}),
      });
      pages.push(page);
      scope = page.scope_digest;
      cursor = page.next_cursor ?? -1;
    } while (cursor >= 0);
    result = {
      pages,
      reviewed: false,
      warning: "Inventory queued only. A connected agent must review each eligible revision.",
    };
  } else if (operation === "erasure-preview")
    result = await personal.profile.erasurePreview(owner, { subject_id: input.subject_id });
  else if (operation === "coverage") result = await personal.sessions.coverage(owner, {});
  else if (operation === "context") result = await personal.context(owner, input.payload ?? {});
  else {
    if (!apply)
      throw Error(
        "This operation requires --apply. Configure/curate only within explicit owner execution scope.",
      );
    if (operation === "policy") result = await personal.policy.update(owner, input.payload);
    else if (operation === "grant") result = await personal.policy.grant(owner, input.payload);
    else if (operation === "skills-scan") result = await personal.skills.scan(owner, input.payload);
    else if (operation === "skill-curate" && input.skill_id)
      result = await personal.skills.curate(owner, input.skill_id, input.payload);
    else if (operation === "skill-backup" && input.skill_id)
      result = await personal.skills.backup(owner, input.skill_id, input.payload);
    else if (operation === "skill-restore" && input.skill_id)
      result = await personal.skills.restore(owner, input.skill_id, input.payload);
    else if (operation === "profile-refresh") result = await personal.profile.refresh(owner);
    else throw Error("Unknown personal maintenance operation.");
  }
  if (input.output)
    await writeFile(resolve(input.output), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  else process.stdout.write(JSON.stringify(result) + "\n");
} finally {
  personal.close();
  domain.close();
}
