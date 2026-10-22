import { randomUUID } from "node:crypto";
import { readFile, readdir, lstat, mkdir, writeFile, realpath } from "node:fs/promises";
import { resolve, join, dirname, relative, sep, isAbsolute } from "node:path";
import { parseDocument } from "yaml";
import {
  z,
  personalSkillQuerySchema,
  personalSkillSummarySchema,
  type PersonalHost,
  type PersonalSkillSummary,
  type LocalActor,
} from "@atlas/contracts";
import { canonical, sha256, DomainError, type LocalStore } from "../transactions.js";
import { safeExternal } from "./sessions.js";
import { clearInput, ownerOnly, personalSecret, type createPersonalPolicy } from "./policy.js";

export function createPersonalSkills(
  store: LocalStore,
  hosts: PersonalHost[],
  policy: ReturnType<typeof createPersonalPolicy>,
) {
  async function records() {
    return [...(await store.catalog()).heads.values()].filter((r) => r.kind === "skill_ref");
  }
  async function resolveSkill(id: string) {
    const record = (await records()).find((r) => r.entity_id === id);
    if (!record) throw new DomainError("NOT_FOUND", 404);
    const skill = personalSkillSummarySchema.parse(record.data.skill);
    return { record, skill };
  }
  async function checked(skill: PersonalSkillSummary, location: string) {
    const host = hosts.find((h) => h.id === skill.host_id && h.enabled);
    if (!host) return { ...skill, availability: "denied" as const };
    try {
      const root = host.skill_roots.find((r) => {
        const rel = relative(resolve(r), resolve(location));
        return rel !== ".." && !rel.startsWith(`..${sep}`) && !resolve(location).startsWith("\\\\");
      });
      if (!root) return { ...skill, availability: "unapproved_target" as const };
      await safeExternal(root, location);
      const stat = await lstat(location);
      if (stat.size > 65536) throw new DomainError("SKILL_BODY_LIMIT", 413);
      const bytes = await readFile(location);
      return {
        ...skill,
        availability:
          sha256(bytes) === skill.sha256 ? ("available" as const) : ("changed" as const),
      };
    } catch (e) {
      return {
        ...skill,
        availability:
          (e as NodeJS.ErrnoException).code === "ENOENT"
            ? ("missing" as const)
            : ("denied" as const),
      };
    }
  }
  async function list(actor: LocalActor, input: unknown = {}) {
    const v = personalSkillQuerySchema.parse(input);
    if (actor.kind !== "owner") await policy.assert(actor, "read_personal_memory");
    const out: PersonalSkillSummary[] = [];
    for (const r of await records()) {
      const s = personalSkillSummarySchema.parse(r.data.skill);
      if (actor.kind !== "owner") {
        try {
          await policy.assert(actor, "read_personal_memory", s.host_id);
        } catch {
          continue;
        }
      }
      if (v.skill_id && v.skill_id !== s.id) continue;
      if (
        v.query &&
        !(v.query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).some(
          (token) =>
            token.length > 1 &&
            `${s.name} ${s.description} ${s.triggers.join(" ")}`.toLowerCase().includes(token),
        )
      )
        continue;
      out.push(await checked(s, String(r.data.canonical_path)));
    }
    if (v.read_body) {
      if (!v.skill_id || !v.expected_digest) throw new DomainError("SKILL_DIGEST_REQUIRED", 400);
      const { record, skill } = await resolveSkill(v.skill_id);
      if (actor.kind !== "owner") await policy.assert(actor, "read_personal_memory", skill.host_id);
      const state = await checked(skill, String(record.data.canonical_path));
      if (state.availability !== "available" || v.expected_digest !== skill.sha256)
        throw new DomainError("SKILL_SOURCE_CHANGED", 409);
      const body = await readFile(String(record.data.canonical_path), "utf8");
      if (sha256(body) !== skill.sha256 || Buffer.byteLength(body) > 65536)
        throw new DomainError("SKILL_SOURCE_CHANGED", 409);
      clearInput(body);
      return { skills: out, body };
    }
    return {
      skills: out,
      ...(actor.kind === "owner"
        ? { revisions: Object.fromEntries((await records()).map((r) => [r.entity_id, r.revision])) }
        : {}),
    };
  }
  async function save(
    actor: LocalActor,
    id: string,
    expected: number,
    data: Record<string, unknown>,
    requestKey: string,
  ) {
    return store.transaction(actor, requestKey, { id, expected, data }, () => ({
      mutations: [
        {
          kind: "skill_ref",
          entity_id: id,
          expected_revision: expected,
          data,
          body: `# ${String((data.skill as PersonalSkillSummary).name)}\n\n${String((data.skill as PersonalSkillSummary).description)}\n\nReference only; this does not install or execute a skill.`,
        },
      ],
      result: { id },
    }));
  }
  async function scan(actor: LocalActor, input: unknown) {
    ownerOnly(actor);
    const v = z
        .object({ host_id: z.string(), request_key: z.string().min(16) })
        .strict()
        .parse(input),
      h = hosts.find((h) => h.id === v.host_id && h.enabled);
    if (!h) throw new DomainError("PERSONAL_HOST_DISABLED", 403);
    const found = new Map<
      string,
      { path: string; name: string; description: string; hash: string; duplicates: string[] }
    >();
    let count = 0;
    for (const root of h.skill_roots) {
      async function walk(folder: string, depth: number) {
        if (depth > 10 || ++count > 5000) throw new DomainError("SKILL_SCAN_LIMIT", 413);
        const es = await readdir(await safeExternal(root, folder), { withFileTypes: true });
        for (const e of es) {
          if (["node_modules", ".git", "dist"].includes(e.name)) continue;
          const p = join(folder, e.name);
          if (e.isSymbolicLink()) continue;
          if (e.isDirectory()) {
            await walk(p, depth + 1);
            continue;
          }
          if (e.name !== "SKILL.md" || !e.isFile()) continue;
          const safe = await safeExternal(root, p),
            stat = await lstat(safe);
          if (stat.size > 65536) continue;
          const raw = await readFile(safe, "utf8");
          if (personalSecret.test(raw)) continue;
          const header = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
          if (!header) continue;
          const doc = parseDocument(header[1] ?? "");
          if (doc.errors.length) continue;
          const name = doc.get("name"),
            description = doc.get("description");
          if (typeof name !== "string" || typeof description !== "string" || !name || !description)
            continue;
          const hash = sha256(raw),
            identity = sha256(`${(await realpath(safe)).toLowerCase()}:${hash}`);
          const prior = found.get(identity);
          if (prior) prior.duplicates.push(sha256(p));
          else
            found.set(identity, {
              path: safe,
              name: name.slice(0, 120),
              description: description.slice(0, 600),
              hash,
              duplicates: [],
            });
        }
      }
      try {
        await walk(root, 0);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
    let added = 0;
    for (const f of found.values()) {
      const locator = sha256(f.path.toLowerCase()),
        old = (await records()).find(
          (r) => (r.data.skill as PersonalSkillSummary)?.locator_id === locator,
        ),
        id = old?.entity_id ?? randomUUID(),
        previous = old ? personalSkillSummarySchema.parse(old.data.skill) : null;
      const skill = personalSkillSummarySchema.parse({
        id,
        name: f.name,
        description: f.description,
        triggers: previous?.triggers ?? [],
        kind: previous?.kind ?? (f.path.includes(`${sep}.system${sep}`) ? "system" : "unknown"),
        state: previous?.state ?? "discovered",
        locator_id: locator,
        sha256: f.hash,
        duplicate_locators: f.duplicates,
        availability: "available",
        host_id: h.id,
        source: "owner-approved skill root",
        last_checked_at: new Date().toISOString(),
        backup_manifest: previous?.backup_manifest ?? null,
      });
      await save(
        actor,
        id,
        old?.revision ?? 0,
        { skill, canonical_path: f.path },
        `skillscan:${sha256(`${v.request_key}:${locator}`)}`,
      );
      added++;
    }
    return { scanned: added };
  }
  async function curate(actor: LocalActor, id: string, input: unknown) {
    ownerOnly(actor);
    const v = z
      .object({
        expected_revision: z.number().int().positive(),
        request_key: z.string().min(16),
        state: z.enum(["curated", "dismissed"]),
        kind: z.enum(["owner_custom", "project_custom", "third_party", "system", "unknown"]),
        triggers: z.array(z.string().max(120)).max(8).default([]),
      })
      .strict()
      .parse(input);
    const { record, skill } = await resolveSkill(id);
    return save(
      actor,
      id,
      v.expected_revision,
      { ...record.data, skill: { ...skill, state: v.state, kind: v.kind, triggers: v.triggers } },
      v.request_key,
    );
  }
  async function backup(actor: LocalActor, id: string, input: unknown) {
    ownerOnly(actor);
    const v = z
        .object({
          request_key: z.string().min(16),
          expected_revision: z.number().int().positive(),
          files: z.array(z.string().min(1).max(240)).min(1).max(500),
        })
        .strict()
        .parse(input),
      { record, skill } = await resolveSkill(id);
    if (record.revision !== v.expected_revision) throw new DomainError("REVISION_CONFLICT");
    if (skill.state !== "curated" || !["owner_custom", "project_custom"].includes(skill.kind))
      throw new DomainError("SKILL_SELECTION_REQUIRED", 400);
    const state = await checked(skill, String(record.data.canonical_path));
    if (state.availability !== "available") throw new DomainError("SKILL_SOURCE_CHANGED", 409);
    const root = dirname(String(record.data.canonical_path)),
      files: { path: string; bytes: number; sha256: string }[] = [],
      writes: { path: string; bytes: Buffer }[] = [];
    let total = 0;
    for (const name of [...new Set(v.files)]) {
      if (
        name.includes("\\") ||
        name
          .split("/")
          .some(
            (p) =>
              !p ||
              p === ".." ||
              p === "." ||
              /[<>:"|?*\0]/.test(p) ||
              /^(?:\.env.*|credentials?.*|id_rsa|id_ed25519|node_modules|\.git|dist|cache)$/i.test(
                p,
              ),
          ) ||
        /\.(pem|key|pfx)$/i.test(name)
      )
        throw new DomainError("SKILL_SOURCE_EXCLUDED", 400);
      const safe = await safeExternal(root, resolve(root, name)),
        stat = await lstat(safe);
      if (!stat.isFile() || stat.size > 2097152) throw new DomainError("SKILL_SOURCE_LIMIT", 413);
      const bytes = await readFile(safe);
      total += bytes.length;
      if (total > 20971520) throw new DomainError("SKILL_SOURCE_LIMIT", 413);
      if (personalSecret.test(bytes.toString("utf8")))
        throw new DomainError("SKILL_SOURCE_SENSITIVE", 400);
      files.push({ path: name, bytes: bytes.length, sha256: sha256(bytes) });
      writes.push({ path: name, bytes });
    }
    if (!files.some((f) => f.path === "SKILL.md"))
      throw new DomainError("SKILL_ENTRY_REQUIRED", 400);
    const digest = sha256(canonical(files)),
      base = `Owner/SkillSources/${id}/${digest}`;
    for (const f of files)
      if (sha256(await readFile(await safeExternal(root, resolve(root, f.path)))) !== f.sha256)
        throw new DomainError("SKILL_SOURCE_CHANGED", 409);
    for (const f of writes) {
      try {
        await store.vault.writeExclusive(`${base}/${f.path}`, f.bytes);
      } catch (e) {
        if (
          (e as NodeJS.ErrnoException).code !== "EEXIST" ||
          sha256(await store.read(`${base}/${f.path}`)) !== sha256(f.bytes)
        )
          throw e;
      }
    }
    const manifest = {
      format_version: 1,
      skill_id: id,
      source_digest: skill.sha256,
      files,
      provenance: "Selected by owner; source license files included only when selected.",
      complete: true,
    };
    try {
      await store.vault.writeExclusive(`${base}/manifest.json`, canonical(manifest));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    for (const f of files)
      if (sha256(await store.read(`${base}/${f.path}`)) !== f.sha256)
        throw new DomainError("SKILL_BACKUP_INTEGRITY", 503);
    await save(
      actor,
      id,
      record.revision,
      { ...record.data, skill: { ...skill, backup_manifest: `${base}/manifest.json` } },
      v.request_key,
    );
    return { manifest: `${base}/manifest.json`, files: files.length };
  }
  async function restore(actor: LocalActor, id: string, input: unknown) {
    ownerOnly(actor);
    const v = z
        .object({ destination: z.string().min(1) })
        .strict()
        .parse(input),
      { skill } = await resolveSkill(id);
    if (!skill.backup_manifest) throw new DomainError("SKILL_BACKUP_MISSING", 404);
    const target = resolve(v.destination);
    const within = (base: string) => {
      const rel = relative(resolve(base), target);
      return !rel || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
    };
    if (
      !/^(?:[A-Za-z]:[\\/]|\/)/.test(v.destination) ||
      within(store.vault.root) ||
      hosts.some((h) => h.skill_roots.some(within))
    )
      throw new DomainError("SKILL_RESTORE_TARGET_DENIED", 400);
    await safeExternal(dirname(target), dirname(target));
    try {
      await lstat(target);
      throw new DomainError("SKILL_RESTORE_TARGET_EXISTS", 409);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const m = z
      .object({
        format_version: z.literal(1),
        skill_id: z.literal(id),
        source_digest: z.string().regex(/^[a-f0-9]{64}$/),
        files: z
          .array(
            z.object({
              path: z.string(),
              bytes: z.number().int().nonnegative().max(2097152),
              sha256: z.string().regex(/^[a-f0-9]{64}$/),
            }),
          )
          .min(1)
          .max(500),
        complete: z.literal(true),
      })
      .passthrough()
      .parse(JSON.parse((await store.read(skill.backup_manifest)).toString()));
    const base = skill.backup_manifest.slice(0, -"manifest.json".length),
      buffers = [];
    if (
      m.files.reduce((total, f) => total + f.bytes, 0) > 20971520 ||
      !m.files.some((f) => f.path === "SKILL.md") ||
      new Set(m.files.map((f) => f.path.toLowerCase())).size !== m.files.length
    )
      throw new DomainError("SKILL_BACKUP_INTEGRITY", 503);
    for (const f of m.files) {
      if (
        f.path.includes("\\") ||
        f.path.split("/").some((p) => !p || p === ".." || p === "." || /[<>:"|?*\0]/.test(p))
      )
        throw new DomainError("SKILL_BACKUP_INTEGRITY", 503);
      const bytes = await store.read(base + f.path);
      if (bytes.length !== f.bytes || sha256(bytes) !== f.sha256)
        throw new DomainError("SKILL_BACKUP_INTEGRITY", 503);
      buffers.push({ path: f.path, bytes });
    }
    await mkdir(target);
    for (const f of buffers) {
      const dest = join(target, f.path);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, f.bytes, { flag: "wx" });
    }
    return { path: target, files: buffers.length, installed: false };
  }
  return { list, scan, curate, backup, restore, records };
}
