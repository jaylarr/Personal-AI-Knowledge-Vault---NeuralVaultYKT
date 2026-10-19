import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir, lstat } from "node:fs/promises";
import { join } from "node:path";
import { watch, type FSWatcher, type Stats } from "node:fs";
import { stringify } from "yaml";
import {
  z,
  localRecordSchema,
  localRequestKeySchema,
  type LocalActor,
  type LocalDomainRecord,
  type LocalRecordKind,
} from "@atlas/contracts";
import { type createLocalVault, decodeFrontmatter } from "../local-vault.js";

export class DomainError extends Error {
  constructor(
    readonly code: string,
    readonly status = 409,
  ) {
    super(code);
  }
}
export const sha256 = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  if (typeof value === "number" && !Number.isFinite(value))
    throw new DomainError("INVALID_NUMBER", 400);
  const text = JSON.stringify(value);
  if (text === undefined) throw new DomainError("INVALID_INPUT", 400);
  return text;
}
export type Catalog = {
  records: LocalDomainRecord[];
  heads: Map<string, LocalDomainRecord>;
  warnings: string[];
  incomplete: boolean;
};
export type Mutation = {
  kind: LocalRecordKind;
  entity_id: string;
  expected_revision: number;
  data: Record<string, unknown>;
  body: string;
  project_id?: string | null;
};
export type BlobWrite = { path: string; bytes: Uint8Array };
export const recordKey = (kind: LocalRecordKind, id: string) => `${kind}:${id}`;
export function head(c: Catalog, kind: LocalRecordKind, id: string) {
  const r = c.heads.get(recordKey(kind, id));
  if (!r) throw new DomainError("NOT_FOUND", 404);
  return r;
}
export function expectRevision(record: LocalDomainRecord, revision: number) {
  if (record.revision !== revision) throw new DomainError("REVISION_CONFLICT");
}
const outputSchema = z
  .object({
    path: z.string(),
    sha256: z.string(),
    record: z.boolean(),
    bytes: z.number().int().nonnegative(),
  })
  .strict();
const manifestSchema = z
  .object({
    id: z.uuid(),
    actor: z.object({ kind: z.enum(["owner", "agent", "worker"]), id: z.string() }),
    request_key: z.string(),
    payload_sha256: z.string(),
    created_at: z.string(),
    outputs: z.array(outputSchema).max(1000),
    result: z.record(z.string(), z.unknown()),
  })
  .strict();
export function createLocalStore(vault: ReturnType<typeof createLocalVault>) {
  const statistics = { catalog_rebuilds: 0, last_catalog_ms: 0, invalidation: "cold" };
  let watcher: FSWatcher | undefined,
    watchHealthy = false,
    materialized: { catalog: Catalog; stamp: string; checkedAt: number } | undefined;
  const dirty = new Set<string>(),
    published = new Map<string, string>(),
    directories = new Map<string, string>();
  // Directory timestamps change when the lock and temporary files are added or
  // removed. Identity plus full-path validation detects replacement; child file
  // events and transaction-directory stamps detect content/commit changes.
  const statIdentity = (s: Stats) => `${s.dev}:${s.ino}`;
  async function stamp() {
    try {
      const s = await lstat(await vault.safeExistingPath(".atlas/transactions"), { bigint: true });
      return `${s.ino}:${s.mtimeNs}:${s.ctimeNs}`;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return "missing";
      throw e;
    }
  }
  function watchChanges() {
    if (watcher) return;
    try {
      watcher = watch(vault.root, { recursive: true }, (_event, name) => {
        if (!name) {
          materialized = undefined;
          return;
        }
        const path = name.toString().replaceAll("\\", "/");
        if (
          path.startsWith(".atlas/derived/") ||
          path === ".atlas/derived" ||
          path === ".atlas/write.lock" ||
          path.endsWith(".tmp") ||
          /^\.atlas\/transactions\/[^/]+\/staged(?:\/|$)/.test(path)
        )
          return;
        dirty.add(path);
      });
      watchHealthy = true;
      watcher.unref();
      watcher.on("error", () => {
        watchHealthy = false;
        materialized = undefined;
        watcher?.close();
        watcher = undefined;
      });
    } catch {
      watchHealthy = false;
    }
  }
  async function rememberPublished(writes: BlobWrite[]) {
    const parents = new Set<string>();
    for (const w of writes) {
      published.set(w.path, sha256(w.bytes));
      const parts = w.path.split("/");
      for (let i = 1; i < parts.length; i++) parents.add(parts.slice(0, i).join("/"));
    }
    await eachLimit([...parents], 24, async (path) => {
      try {
        directories.set(path, statIdentity(await lstat(await vault.safeExistingPath(path))));
      } catch {
        directories.delete(path);
      }
    });
  }
  async function cachedCatalog() {
    const miss = (reason: string) => {
      statistics.invalidation = reason;
      return null;
    };
    if (!watchHealthy || !materialized) return miss("cold_or_watcher_unavailable");
    if (Date.now() - materialized.checkedAt >= 5000) return miss("periodic_verification");
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (!materialized || (await stamp()) !== materialized.stamp)
      return miss("transaction_directory_changed");
    const events = [...dirty];
    dirty.clear();
    for (const path of events) {
      try {
        const expected = published.get(path);
        if (expected) {
          if (sha256(await cachedRead(path)) !== expected) return miss("published_file_changed");
          continue;
        }
        // Windows can notify on access without changing content. Reuse only
        // the same previously verified byte buffer after checking the leaf's
        // identity, size and nanosecond modification/change timestamps. A
        // changed file forces full-path validation and a catalog rebuild.
        const previous = fileCache.get(path);
        if (previous) {
          if ((await cachedRead(path)) === previous.bytes) continue;
          return miss("known_file_changed");
        }
        const directory = directories.get(path);
        if (
          directory &&
          statIdentity(await lstat(await vault.safeExistingPath(path))) === directory
        )
          continue;
        return miss(`unrecognized_event:${path}`);
      } catch {
        return miss("event_validation_failed");
      }
    }
    const pending = scans.get(materialized.catalog)?.pending ?? [];
    for (const id of pending)
      try {
        await vault.safeExistingPath(`.atlas/transactions/${id}/COMMITTED.json`);
        return null;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") return null;
      }
    return materialized.catalog;
  }
  const scans = new WeakMap<
    Catalog,
    { manifests: z.infer<typeof manifestSchema>[]; pending: string[] }
  >();
  const counts = new WeakMap<Catalog, { recordBytes: number; outputs: number }>();
  const manifestCache = new Map<
    string,
    { raw: Buffer; marker: Buffer; manifest: z.infer<typeof manifestSchema> }
  >();
  const fileCache = new Map<string, { signature: string; bytes: Buffer }>(),
    recordCache = new Map<string, LocalDomainRecord>();
  let cachedBytes = 0;
  async function cachedRead(path: string) {
    const prior = fileCache.get(path);
    // A cache hit returns previously verified bytes, never new bytes through a
    // changed parent. Any changed leaf identity/timestamp forces full-path
    // junction/symlink validation before the file is read again.
    let absolute = prior
      ? join(vault.root, ...path.split("/"))
      : await vault.safeExistingPath(path);
    const stat = await lstat(absolute, { bigint: true });
    if (!stat.isFile() || stat.size > 2097152n) throw new DomainError("CATALOG_LIMIT", 503);
    const signature = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`,
      cached = prior;
    if (cached?.signature === signature) return cached.bytes;
    if (prior) absolute = await vault.safeExistingPath(path);
    const bytes = await readFile(absolute);
    if (prior) cachedBytes -= prior.bytes.length;
    if (cachedBytes + bytes.length > 83886080) {
      fileCache.clear();
      recordCache.clear();
      cachedBytes = 0;
    }
    fileCache.set(path, { signature, bytes });
    cachedBytes += bytes.length;
    return bytes;
  }
  async function read(path: string) {
    return readFile(await vault.safePath(path));
  }
  async function folders(path: string) {
    try {
      return await readdir(await vault.safePath(path), { withFileTypes: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
  async function manifests() {
    await vault.initialize();
    const manifests: z.infer<typeof manifestSchema>[] = [],
      warnings: string[] = [],
      pending: string[] = [];
    const entries = await folders(".atlas/transactions");
    if (entries.length > 50000) throw new DomainError("CATALOG_LIMIT", 503);
    await eachLimit(entries, 24, async (e) => {
      if (!e.isDirectory() || e.isSymbolicLink() || !z.uuid().safeParse(e.name).success) return;
      const base = `.atlas/transactions/${e.name}`;
      let marker: Buffer;
      try {
        marker = await cachedRead(`${base}/COMMITTED.json`);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          pending.push(e.name);
          return;
        }
        throw err;
      }
      try {
        const raw = await cachedRead(`${base}/manifest.json`);
        const known = manifestCache.get(base);
        if (known?.raw === raw && known.marker === marker) {
          manifests.push(known.manifest);
          return;
        }
        if (raw.length > 2097152 || marker.length > 1024) throw new DomainError("MANIFEST_LIMIT");
        const commit = z
          .object({ id: z.uuid(), manifest_sha256: z.string() })
          .strict()
          .parse(JSON.parse(marker.toString("utf8")));
        const m = manifestSchema.parse(JSON.parse(raw.toString("utf8")));
        if (commit.id !== m.id || m.id !== e.name || sha256(raw) !== commit.manifest_sha256)
          throw new DomainError("COMMIT_INTEGRITY");
        manifests.push(m);
        manifestCache.set(base, { raw, marker, manifest: m });
      } catch {
        warnings.push(`Transaction ${e.name}: invalid committed manifest; preserved`);
      }
    });
    return { manifests, warnings, pending };
  }
  async function catalogUnlocked(): Promise<Catalog> {
    const cached = await cachedCatalog();
    if (cached) return cached;
    const rebuildStarted = performance.now();
    statistics.catalog_rebuilds++;
    materialized = undefined;
    dirty.clear();
    const scan = await manifests(),
      records: LocalDomainRecord[] = [],
      warnings = [...scan.warnings];
    let bytes = 0,
      files = 0;
    const managed = scan.manifests.flatMap((m) => m.outputs.map((out) => ({ m, out })));
    // Validated commit manifests also cover originals. A read/access event on
    // such a file is harmless only after its bytes match that exact digest.
    for (const { out } of managed) published.set(out.path, out.sha256);
    await eachLimit(managed, 48, async ({ m, out }) => {
      if (++files > 50000) {
        warnings.push("Managed file count limit reached");
        return;
      }
      if (!out.record) return;
      try {
        const buffer = await cachedRead(out.path);
        bytes += buffer.length;
        if (bytes > 67108864) throw new DomainError("CATALOG_LIMIT");
        const raw = buffer.toString("utf8");
        const contentHash = sha256(buffer);
        if (contentHash !== out.sha256) {
          warnings.push(`${out.path}: directly changed or corrupted; approval unavailable`);
          return;
        }
        const cached = recordCache.get(contentHash);
        if (cached) {
          records.push(cached);
          return;
        }
        const { metadata, body } = decodeFrontmatter(raw);
        if (metadata.atlas_schema !== 3 || metadata.transaction_id !== m.id)
          throw new DomainError("RECORD_INTEGRITY");
        const data = z
          .record(z.string(), z.unknown())
          .parse(JSON.parse(String(metadata.fields_json)));
        if (metadata.record_kind === "version") data.text = body;
        const r = localRecordSchema.parse({
          id: metadata.atlas_id,
          entity_id: metadata.entity_id,
          kind: metadata.record_kind,
          revision: metadata.revision,
          previous_id: metadata.previous_id ?? null,
          previous_digest: metadata.previous_digest ?? null,
          transaction_id: m.id,
          actor: m.actor,
          created_at: m.created_at,
          data,
          body,
          path: out.path,
          file_digest: out.sha256,
        });
        records.push(r);
        recordCache.set(contentHash, r);
      } catch {
        warnings.push(`${out.path}: unreadable managed record; preserved`);
      }
    });
    const byId = new Map(records.map((r) => [r.id, r])),
      groups = new Map<string, LocalDomainRecord[]>(),
      heads = new Map<string, LocalDomainRecord>();
    if (byId.size !== records.length) warnings.push("Duplicate domain revision ID");
    for (const r of records) {
      const k = recordKey(r.kind, r.entity_id);
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    for (const [key, group] of groups) {
      const used = new Set<string>();
      let valid = true;
      for (const r of group) {
        if (r.previous_id) {
          const p = byId.get(r.previous_id);
          if (
            !p ||
            recordKey(p.kind, p.entity_id) !== key ||
            p.file_digest !== r.previous_digest ||
            p.revision + 1 !== r.revision
          )
            valid = false;
          used.add(r.previous_id);
        } else if (r.revision !== 1 || r.previous_digest !== null) valid = false;
      }
      const latest = group.filter((r) => !used.has(r.id));
      if (
        valid &&
        latest.length === 1 &&
        group.filter((r) => r.previous_id === null).length === 1 &&
        latest[0]
      )
        heads.set(key, latest[0]);
      else warnings.push(`${key}: conflicting or incomplete version chain; no automatic winner`);
    }
    if (
      [...heads.values()].filter((r) =>
        ["source", "memory", "entity", "relationship"].includes(r.kind),
      ).length > 5000
    )
      warnings.push("Logical item limit reached");
    const result = { records, heads, warnings, incomplete: warnings.length > 0 };
    scans.set(result, scan);
    counts.set(result, { recordBytes: bytes, outputs: files });
    if (records.length >= 200) watchChanges();
    if (!result.incomplete)
      materialized = { catalog: result, stamp: await stamp(), checkedAt: Date.now() };
    statistics.last_catalog_ms = performance.now() - rebuildStarted;
    return result;
  }
  async function catalog() {
    return vault.withLock(catalogUnlocked);
  }
  async function basePath(projectId: string | null | undefined) {
    if (!projectId) return "Personal";
    const matches: string[] = [];
    for (const entry of await folders("Projects")) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      try {
        const path = `Projects/${entry.name}/Project.md`,
          bytes = await read(path);
        if (bytes.length > 2097152) throw new DomainError("PROJECT_FILE_LIMIT");
        const { metadata } = decodeFrontmatter(bytes.toString("utf8"));
        if (metadata.atlas_id === projectId && metadata.archived !== true)
          matches.push(`Projects/${entry.name}`);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
    if (matches.length !== 1 || !matches[0]) throw new DomainError("PROJECT_NOT_FOUND", 404);
    return matches[0];
  }
  async function recordPath(m: Mutation, id: string) {
    const base = await basePath(m.project_id);
    if (m.kind === "source")
      return m.expected_revision === 0
        ? `${base}/Sources/${m.entity_id}/Source.md`
        : `${base}/Sources/${m.entity_id}/Events/${id}.md`;
    if (m.kind === "version")
      return `${base}/Sources/${String(m.data.source_id)}/Versions/${id}.md`;
    const folder = {
      memory: "Memories",
      entity: "Entities",
      relationship: "Relationships",
      review: "Reviews",
    }[m.kind as "memory" | "entity" | "relationship" | "review"];
    return folder
      ? `${base}/${folder}/${m.entity_id}/${id}.md`
      : `.atlas/operations/${m.kind}/${m.entity_id}/${id}.md`;
  }
  async function transaction<T extends Record<string, unknown>>(
    actor: LocalActor,
    key: string,
    payload: unknown,
    work: (
      c: Catalog,
    ) =>
      | Promise<{ mutations: Mutation[]; blobs?: BlobWrite[]; result: T }>
      | { mutations: Mutation[]; blobs?: BlobWrite[]; result: T },
    guard?: (c: Catalog) => Promise<void> | void,
  ): Promise<T> {
    localRequestKeySchema.parse(key);
    const payloadHash = sha256(canonical(payload));
    return vault.withLock(async () => {
      const c = await catalogUnlocked();
      if (c.incomplete) throw new DomainError("CATALOG_INTEGRITY", 503);
      await guard?.(c);
      const scan = scans.get(c) ?? (await manifests());
      const prior = scan.manifests.find(
        (m) => m.actor.kind === actor.kind && m.actor.id === actor.id && m.request_key === key,
      );
      if (prior) {
        if (prior.payload_sha256 !== payloadHash) throw new DomainError("REQUEST_CONFLICT");
        return structuredClone(prior.result) as T;
      }
      // A manifest is written only after every bounded output is staged. Resume the
      // same request after a crash, but never over a newer committed head.
      for (const entry of scan.pending) {
        const base = `.atlas/transactions/${entry}`;
        let pending: z.infer<typeof manifestSchema>;
        try {
          await read(`${base}/COMMITTED.json`);
          continue;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        try {
          pending = manifestSchema.parse(
            JSON.parse((await read(`${base}/manifest.json`)).toString()),
          );
        } catch {
          continue;
        }
        if (
          pending.actor.kind !== actor.kind ||
          pending.actor.id !== actor.id ||
          pending.request_key !== key
        )
          continue;
        if (pending.payload_sha256 !== payloadHash) throw new DomainError("REQUEST_CONFLICT");
        for (const [index, out] of pending.outputs.entries()) {
          const bytes = await read(`${base}/staged/${index}.bin`);
          if (bytes.length !== out.bytes || sha256(bytes) !== out.sha256)
            throw new DomainError("RECOVERY_STAGE_INTEGRITY", 503);
          if (out.record) {
            const { metadata } = decodeFrontmatter(bytes.toString()),
              existing = c.heads.get(`${metadata.record_kind}:${metadata.entity_id}`);
            if (
              (existing?.revision ?? 0) !== Number(metadata.revision) - 1 ||
              (existing?.id ?? null) !== (metadata.previous_id ?? null)
            )
              throw new DomainError("RECOVERY_HEAD_CONFLICT");
          }
        }
        for (const [index, out] of pending.outputs.entries()) {
          const bytes = await read(`${base}/staged/${index}.bin`);
          try {
            await vault.writeExclusive(out.path, bytes);
          } catch (error) {
            if (
              (error as NodeJS.ErrnoException).code !== "EEXIST" ||
              sha256(await read(out.path)) !== out.sha256
            )
              throw new DomainError("RECOVERY_OUTPUT_CONFLICT");
          }
        }
        const raw = await read(`${base}/manifest.json`);
        materialized = undefined;
        await vault.writeExclusive(
          `${base}/COMMITTED.json`,
          canonical({ id: pending.id, manifest_sha256: sha256(raw) }),
        );
        return pending.result as T;
      }
      const change = await work(c),
        id = randomUUID(),
        created_at = new Date().toISOString();
      const outputs: z.infer<typeof outputSchema>[] = [],
        writes: BlobWrite[] = [],
        newRecords: LocalDomainRecord[] = [];
      const keys = new Set<string>();
      for (const mutation of change.mutations) {
        const k = recordKey(mutation.kind, mutation.entity_id);
        if (keys.has(k)) throw new DomainError("DUPLICATE_MUTATION", 400);
        keys.add(k);
        const previous = c.heads.get(k);
        if ((previous?.revision ?? 0) !== mutation.expected_revision)
          throw new DomainError("REVISION_CONFLICT");
        if (previous && sha256(await read(previous.path)) !== previous.file_digest)
          throw new DomainError("FILE_CONFLICT");
        const revisionId = randomUUID(),
          path = await recordPath(mutation, revisionId),
          data = { ...mutation.data };
        if (mutation.kind === "version") delete data.text;
        const metadata = {
          atlas_schema: 3,
          atlas_id: revisionId,
          entity_id: mutation.entity_id,
          record_kind: mutation.kind,
          revision: (previous?.revision ?? 0) + 1,
          previous_id: previous?.id ?? null,
          previous_digest: previous?.file_digest ?? null,
          transaction_id: id,
          fields_json: canonical(data),
        };
        const raw = `---\n${stringify(metadata, { lineWidth: 0, defaultStringType: "QUOTE_DOUBLE" })}---\n${mutation.body}`;
        if (Buffer.byteLength(raw) > 2097152) throw new DomainError("RECORD_TOO_LARGE", 413);
        writes.push({ path, bytes: Buffer.from(raw) });
        outputs.push({ path, sha256: sha256(raw), record: true, bytes: Buffer.byteLength(raw) });
        newRecords.push(
          localRecordSchema.parse({
            id: revisionId,
            entity_id: mutation.entity_id,
            kind: mutation.kind,
            revision: (previous?.revision ?? 0) + 1,
            previous_id: previous?.id ?? null,
            previous_digest: previous?.file_digest ?? null,
            transaction_id: id,
            actor,
            created_at,
            data: mutation.data,
            body: mutation.body,
            path,
            file_digest: sha256(raw),
          }),
        );
        if (
          mutation.expected_revision === 0 &&
          ["source", "memory", "entity", "relationship", "review"].includes(mutation.kind) &&
          !path.startsWith(".atlas/")
        ) {
          const markerPath = path.slice(0, path.lastIndexOf("/")) + "/.atlas-domain.json",
            marker = Buffer.from(canonical({ atlas_schema: 3, entity_id: mutation.entity_id }));
          writes.push({ path: markerPath, bytes: marker });
          outputs.push({
            path: markerPath,
            sha256: sha256(marker),
            record: false,
            bytes: marker.length,
          });
        }
      }
      for (const blob of change.blobs ?? []) {
        writes.push(blob);
        outputs.push({
          path: blob.path,
          sha256: sha256(blob.bytes),
          record: false,
          bytes: blob.bytes.length,
        });
      }
      if (outputs.length > 1000) throw new DomainError("OPERATION_TOO_LARGE", 413);
      const m = manifestSchema.parse({
        id,
        actor,
        request_key: key,
        payload_sha256: payloadHash,
        created_at,
        outputs,
        result: change.result,
      });
      const raw = canonical(m),
        base = `.atlas/transactions/${id}`;
      const oldCounts = counts.get(c) ?? { recordBytes: 0, outputs: 0 },
        nextCounts = {
          recordBytes:
            oldCounts.recordBytes +
            outputs.filter((o) => o.record).reduce((sum, o) => sum + o.bytes, 0),
          outputs: oldCounts.outputs + outputs.length,
        };
      if (nextCounts.recordBytes > 67108864 || nextCounts.outputs > 50000)
        throw new DomainError("CATALOG_ADMISSION_LIMIT", 413);
      const updatedHeads = new Map(c.heads);
      for (const record of newRecords)
        updatedHeads.set(recordKey(record.kind, record.entity_id), record);
      if (
        [...updatedHeads.values()].filter((r) =>
          ["source", "memory", "entity", "relationship"].includes(r.kind),
        ).length > 5000
      )
        throw new DomainError("LOGICAL_ITEM_LIMIT", 413);
      if (new Set(writes.map((w) => w.path)).size !== writes.length)
        throw new DomainError("DUPLICATE_OUTPUT_PATH", 400);
      await eachLimit([...writes.entries()], 12, async ([index, out]) => {
        await vault.writeExclusive(`${base}/staged/${index}.bin`, out.bytes);
      });
      await vault.writeExclusive(`${base}/manifest.json`, raw);
      await eachLimit(writes, 12, async (out) => {
        try {
          await vault.writeExclusive(out.path, out.bytes);
        } catch (e) {
          const output = outputs.find((o) => o.path === out.path);
          if (
            (e as NodeJS.ErrnoException).code !== "EEXIST" ||
            output?.record ||
            sha256(await read(out.path)) !== sha256(out.bytes)
          )
            throw e;
        }
      });
      await vault.writeExclusive(
        `${base}/COMMITTED.json`,
        canonical({ id, manifest_sha256: sha256(raw) }),
      );
      if (watchHealthy) {
        const committed = Buffer.from(canonical({ id, manifest_sha256: sha256(raw) }));
        await rememberPublished([
          ...writes,
          { path: `${base}/manifest.json`, bytes: Buffer.from(raw) },
          { path: `${base}/COMMITTED.json`, bytes: committed },
        ]);
        const next = {
          records: [...c.records, ...newRecords],
          heads: updatedHeads,
          warnings: [],
          incomplete: false,
        };
        scans.set(next, { manifests: [...scan.manifests, m], pending: scan.pending });
        counts.set(next, nextCounts);
        materialized = {
          catalog: next,
          stamp: await stamp(),
          checkedAt: materialized?.checkedAt ?? Date.now(),
        };
      }
      return change.result;
    });
  }
  return {
    vault,
    read,
    catalog,
    catalogUnlocked,
    transaction,
    basePath,
    diagnostics: () => ({ ...statistics }),
    close() {
      watcher?.close();
      watcher = undefined;
      watchHealthy = false;
      materialized = undefined;
    },
  };
}
export type LocalStore = ReturnType<typeof createLocalStore>;

async function eachLimit<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0;
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        await work(items[index]!);
      }
    }),
  );
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}
