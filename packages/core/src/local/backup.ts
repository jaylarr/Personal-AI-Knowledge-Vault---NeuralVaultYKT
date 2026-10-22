import { randomUUID } from "node:crypto";
import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  lstat,
  realpath,
  copyFile,
  unlink,
} from "node:fs/promises";
import { resolve, join, isAbsolute, sep } from "node:path";
import { z } from "@atlas/contracts";
import { createLocalVault } from "../local-vault.js";
import { createCoverage } from "./personal/coverage.js";
import {
  createLocalStore,
  DomainError,
  sha256,
  canonical,
  type LocalStore,
  type Mutation,
} from "./transactions.js";

const itemSchema = z
  .object({
    path: z.string(),
    bytes: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const backupManifestSchema = z
  .object({
    format_version: z.literal(1),
    backup_id: z.uuid(),
    created_at: z.string(),
    app_version: z.string(),
    files: z.array(itemSchema).max(50000),
    total_bytes: z.number().int().nonnegative().max(1073741824),
    exclusions: z.array(z.string()),
    complete: z.literal(true),
  })
  .strict();
function relativeSafe(path: string) {
  if (
    !path ||
    isAbsolute(path) ||
    path.includes("\\") ||
    path
      .split("/")
      .some(
        (p) =>
          !p ||
          p === ".." ||
          p === "." ||
          /[<>:"|?*\0]/.test(p) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p),
      )
  )
    throw new DomainError("UNSAFE_BACKUP_PATH", 400);
}
async function plainDirectory(path: string) {
  const stat = await lstat(path);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    resolve(await realpath(path)) !== resolve(path)
  )
    throw new DomainError("UNSAFE_BACKUP_DIRECTORY", 400);
}
async function beneath(root: string, path: string) {
  relativeSafe(path);
  let current = root;
  const parts = path.split("/");
  for (let i = 0; i < parts.length; i++) {
    current = join(current, parts[i]!);
    const s = await lstat(current);
    if (s.isSymbolicLink() || (i < parts.length - 1 && !s.isDirectory()))
      throw new DomainError("UNSAFE_BACKUP_PATH", 400);
  }
  return current;
}
export async function backupLocalVault(store: LocalStore, target: string) {
  if (
    !isAbsolute(target) ||
    resolve(target).startsWith(store.vault.root + sep) ||
    resolve(target) === store.vault.root
  )
    throw new DomainError("BACKUP_TARGET_MUST_BE_SEPARATE", 400);
  await plainDirectory(resolve(target, ".."));
  return store.vault.withLock(async () => {
    const c = await store.catalogUnlocked();
    if (c.incomplete) throw new DomainError("CATALOG_INTEGRITY", 503);
    const checkedOriginals = new Set<string>();
    for (const record of c.heads.values())
      if (record.kind === "version") {
        const path = String(record.data.original_path);
        if (checkedOriginals.has(path)) continue;
        if (sha256(await store.read(path)) !== record.data.raw_sha256)
          throw new DomainError("ORIGINAL_INTEGRITY", 503);
        checkedOriginals.add(path);
      }
    await mkdir(target);
    const backupId = randomUUID(),
      files: z.infer<typeof itemSchema>[] = [],
      exclusions: string[] = [];
    let total = 0;
    async function walk(folder: string, depth: number) {
      if (depth > 16) throw new DomainError("BACKUP_DEPTH_LIMIT", 413);
      const absolute = folder ? await store.vault.safePath(folder) : store.vault.root;
      for (const e of await readdir(absolute, { withFileTypes: true })) {
        const path = folder ? `${folder}/${e.name}` : e.name;
        if (/^\.atlas\/transactions\/[0-9a-f-]{36}\/staged$/.test(path)) {
          try {
            await store.read(`${folder}/COMMITTED.json`);
            exclusions.push(path);
            continue;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
        }
        if (
          path === ".atlas/write.lock" ||
          path.startsWith(".atlas/derived/") ||
          path === ".atlas/derived" ||
          path === ".atlas/pending/uploads" ||
          path.startsWith(".atlas/pending/uploads/") ||
          e.name.startsWith(".env") ||
          e.name.endsWith(".clixml") ||
          e.name.endsWith(".tmp")
        ) {
          exclusions.push(path);
          continue;
        }
        if (e.isSymbolicLink()) throw new DomainError("BACKUP_LINK_DENIED", 400);
        if (e.isDirectory()) {
          await walk(path, depth + 1);
          continue;
        }
        if (!e.isFile()) throw new DomainError("BACKUP_SPECIAL_FILE", 400);
        if (files.length >= 50000) throw new DomainError("BACKUP_FILE_LIMIT", 413);
        const source = await store.vault.safePath(path),
          size = (await lstat(source)).size;
        total += size;
        if (size > 20971520 || total > 1073741824) throw new DomainError("BACKUP_BYTE_LIMIT", 413);
        const bytes = await readFile(source),
          hash = sha256(bytes),
          destination = join(target, path);
        await mkdir(resolve(destination, ".."), { recursive: true });
        await copyFile(source, destination, 1);
        if (sha256(await readFile(destination)) !== hash || sha256(await readFile(source)) !== hash)
          throw new DomainError("BACKUP_SOURCE_CHANGED", 409);
        files.push({ path, bytes: size, sha256: hash });
      }
    }
    await writeFile(
      join(target, "INCOMPLETE.json"),
      canonical({ backup_id: backupId, started_at: new Date().toISOString() }),
      { flag: "wx" },
    );
    await walk("", 0);
    for (const file of files) {
      if (sha256(await readFile(await store.vault.safePath(file.path))) !== file.sha256)
        throw new DomainError("BACKUP_SOURCE_CHANGED", 409);
    }
    const manifest = backupManifestSchema.parse({
      format_version: 1,
      backup_id: backupId,
      created_at: new Date().toISOString(),
      app_version: "0.1.0",
      files,
      total_bytes: total,
      exclusions,
      complete: true,
    });
    await writeFile(join(target, "manifest.json"), canonical(manifest), { flag: "wx" });
    await unlink(join(target, "INCOMPLETE.json"));
    return {
      backup_id: backupId,
      path: target,
      files: files.length,
      bytes: total,
      complete: true,
      warning:
        "A copy on this disk does not protect against disk loss. Copy the verified package to separate storage.",
    };
  });
}
export async function restoreLocalVault(packageRoot: string, target: string) {
  if (
    !isAbsolute(packageRoot) ||
    !isAbsolute(target) ||
    resolve(target) === resolve(packageRoot) ||
    resolve(target).startsWith(resolve(packageRoot) + sep)
  )
    throw new DomainError("RESTORE_TARGET_MUST_BE_SEPARATE", 400);
  await plainDirectory(packageRoot);
  await plainDirectory(resolve(target, ".."));
  const manifest = backupManifestSchema.parse(
    JSON.parse(await readFile(join(packageRoot, "manifest.json"), "utf8")),
  );
  const seen = new Set<string>();
  let bytes = 0;
  for (const file of manifest.files) {
    relativeSafe(file.path);
    const key = file.path.toLowerCase();
    if (seen.has(key)) throw new DomainError("BACKUP_CASE_COLLISION", 400);
    seen.add(key);
    const source = await beneath(packageRoot, file.path),
      stat = await lstat(source);
    if (
      !stat.isFile() ||
      stat.size !== file.bytes ||
      sha256(await readFile(source)) !== file.sha256
    )
      throw new DomainError("BACKUP_INTEGRITY", 400);
    bytes += file.bytes;
  }
  if (bytes !== manifest.total_bytes) throw new DomainError("BACKUP_INTEGRITY", 400);
  await mkdir(target);
  for (const file of manifest.files) {
    const destination = join(target, file.path);
    await mkdir(resolve(destination, ".."), { recursive: true });
    await copyFile(await beneath(packageRoot, file.path), destination, 1);
  }
  const store = createLocalStore(createLocalVault(target, "restored-disabled-agent")),
    c = await store.catalog();
  if (c.incomplete) throw new DomainError("RESTORED_CATALOG_INTEGRITY", 503);
  try {
    const coverageRoot = await store.vault.safeExistingPath(".atlas/personal/coverage");
    const entries = await readdir(coverageRoot, { withFileTypes: true });
    const hosts = entries.map((entry) => {
      if (
        !entry.isDirectory() ||
        entry.isSymbolicLink() ||
        !/^[a-z][a-z0-9-]{2,47}$/.test(entry.name)
      )
        throw new DomainError("PERSONAL_JOURNAL_INTEGRITY", 503);
      return {
        id: entry.name,
        kind: "codex-local-jsonl" as const,
        enabled: false,
        codex_home: target,
        skill_roots: [],
      };
    });
    const journal = createCoverage(store.vault, hosts);
    for (const host of hosts) await journal.list(host.id);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const mutations: Mutation[] = [],
    now = new Date().toISOString();
  for (const r of c.heads.values()) {
    if (r.kind === "settings" && r.entity_id === "personal-policy-v1")
      mutations.push({
        kind: r.kind,
        entity_id: r.entity_id,
        expected_revision: r.revision,
        data: {
          ...r.data,
          policy: {
            ...(r.data.policy as Record<string, unknown>),
            enabled: false,
            enabled_hosts: [],
          },
        },
        body: "Personal capture disabled during isolated restore. Re-enrollment is explicit.",
      });
    if (r.kind === "agent")
      mutations.push({
        kind: r.kind,
        entity_id: r.entity_id,
        expected_revision: r.revision,
        data: { ...r.data, disabled: true, revoked_at: now },
        body: "Credential disabled during isolated restore. Re-enrollment is explicit.",
      });
    if (r.kind === "grant")
      mutations.push({
        kind: r.kind,
        entity_id: r.entity_id,
        expected_revision: r.revision,
        data: { ...r.data, revoked: true },
        body: "Processing grant disabled during restore.",
      });
    if (r.kind === "task" && ["claimed", "awaiting_agent"].includes(String(r.data.state)))
      mutations.push({
        kind: r.kind,
        entity_id: r.entity_id,
        expected_revision: r.revision,
        data: { ...r.data, state: "cancelled", lease_digest: null, lease_expires_at: null },
        body: "Live processing claim cancelled during restore.",
      });
    if (r.kind === "job" && r.data.state === "running")
      mutations.push({
        kind: r.kind,
        entity_id: r.entity_id,
        expected_revision: r.revision,
        data: {
          ...r.data,
          state: "queued",
          lease_digest: null,
          lease_expires_at: null,
          available_at: now,
        },
        body: "Deterministic job requeued after restore.",
      });
  }
  if (mutations.length) {
    if (mutations.length > 900) throw new DomainError("RESTORE_REVOCATION_LIMIT", 503);
    await store.transaction(
      { kind: "owner", id: "restore" },
      `restore:${manifest.backup_id}`,
      { backup_id: manifest.backup_id },
      () => ({ mutations, result: { restored: true } }),
    );
  }
  return {
    backup_id: manifest.backup_id,
    path: target,
    files: manifest.files.length,
    bytes,
    credentials_disabled: true,
    original_vault_unchanged: true,
  };
}
