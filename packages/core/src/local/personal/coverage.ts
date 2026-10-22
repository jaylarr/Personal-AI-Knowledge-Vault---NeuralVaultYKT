import { readdir, readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { z, type PersonalHost, type LocalActor } from "@atlas/contracts";
import type { createLocalVault } from "../../local-vault.js";
import { canonical, sha256, DomainError } from "../transactions.js";

const dataSchema = z
  .object({
    host_id: z.string(),
    session_key: z.string().regex(/^[a-f0-9]{64}$/),
    session_revision: z.string().regex(/^[a-f0-9]{64}$/),
    locator_id: z.string(),
    outcome: z.string(),
    reason_code: z.string(),
    native_consent: z.enum(["unknown", "excluded"]),
    messages: z.number().int().nonnegative(),
    terminal: z.boolean(),
    source_version: z.string(),
    source_signature: z.string(),
    lease_digest: z.string().optional(),
    lease_actor: z.string().optional(),
    lease_started_at: z.number().optional(),
    lease_expires_at: z.number().optional(),
    read_cursor: z.number().optional(),
    delivered_cursor: z.number().optional(),
    delivered_digest: z.string().optional(),
    acknowledged: z.boolean().optional(),
    note_refs: z.array(z.object({ id: z.string(), file_digest: z.string() })).optional(),
    candidate_ids: z.array(z.string()).optional(),
    completion_payload: z.string().optional(),
  })
  .strict();
export type CoverageData = z.infer<typeof dataSchema>;
const eventSchema = z
  .object({
    format_version: z.literal(1),
    entity_key: z.string(),
    revision: z.number().int().positive(),
    previous_event_sha256: z.string().nullable(),
    request_key: z.string(),
    payload_sha256: z.string(),
    actor_id: z.string(),
    at: z.string(),
    data: dataSchema,
  })
  .strict();
export type CoverageEvent = z.infer<typeof eventSchema> & { digest: string };
type CoverageState = {
  records: CoverageEvent[];
  heads: Map<string, CoverageEvent>;
  bytes: number;
  files: number;
};
export function createCoverage(vault: ReturnType<typeof createLocalVault>, hosts: PersonalHost[]) {
  const cache = new Map<string, { state: CoverageState; signatures: Map<string, string> }>();
  async function signature(path: string) {
    const s = await lstat(join(vault.root, ...path.split("/")), { bigint: true });
    if (s.isSymbolicLink()) throw new DomainError("PERSONAL_JOURNAL_INTEGRITY", 503);
    return `${s.dev}:${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`;
  }
  async function remember(hostId: string, paths: string[]) {
    const value = cache.get(hostId);
    if (!value) return;
    for (const path of paths) value.signatures.set(path, await signature(path));
  }
  async function allUnlocked(hostId: string) {
    if (!hosts.some((h) => h.id === hostId)) throw new DomainError("PERSONAL_HOST_UNKNOWN", 404);
    const prior = cache.get(hostId);
    if (prior) {
      try {
        await vault.safeExistingPath(`.atlas/personal/coverage/${hostId}`);
        let changed = false;
        const entries = [...prior.signatures];
        for (let i = 0; i < entries.length; i += 24)
          await Promise.all(
            entries.slice(i, i + 24).map(async ([path, expected]) => {
              if ((await signature(path)) !== expected) changed = true;
            }),
          );
        if (!changed) return prior.state;
      } catch {
        /* Revalidate the complete journal after any identity change. */
      }
      cache.delete(hostId);
    }
    const records: CoverageEvent[] = [];
    const signatures = new Map<string, string>();
    let bytes = 0,
      files = 0;
    async function walk(folder: string, depth: number) {
      if (depth > 3) throw new DomainError("PERSONAL_JOURNAL_INTEGRITY", 503);
      let entries: import("node:fs").Dirent[];
      try {
        entries = await readdir(await vault.safePath(folder), { withFileTypes: true });
        signatures.set(folder, await signature(folder));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
        throw e;
      }
      for (let index = 0; index < entries.length; index += 24) {
        await Promise.all(
          entries.slice(index, index + 24).map(async (e) => {
            const p = `${folder}/${e.name}`;
            if (e.isSymbolicLink()) throw new DomainError("PERSONAL_JOURNAL_INTEGRITY", 503);
            if (e.isDirectory()) {
              await walk(p, depth + 1);
              return;
            }
            if (!e.name.endsWith(".json")) return;
            if (++files > 100000) throw new DomainError("PERSONAL_JOURNAL_LIMIT", 503);
            const path = await vault.safeExistingPath(p),
              stat = await lstat(path);
            bytes += stat.size;
            if (stat.size > 32768 || bytes > 134217728)
              throw new DomainError("PERSONAL_JOURNAL_LIMIT", 503);
            const raw = await readFile(path, "utf8");
            signatures.set(p, await signature(p));
            let ev: z.infer<typeof eventSchema>;
            try {
              ev = eventSchema.parse(JSON.parse(raw));
            } catch {
              throw new DomainError("PERSONAL_JOURNAL_INTEGRITY", 503);
            }
            if (
              ev.data.host_id !== hostId ||
              folder !== `.atlas/personal/coverage/${hostId}/${ev.data.session_key}` ||
              ev.entity_key !== `${ev.data.session_key}:${ev.data.session_revision}` ||
              e.name !== `${sha256(`${ev.actor_id}:${ev.request_key}`)}.json`
            )
              throw new DomainError("PERSONAL_JOURNAL_INTEGRITY", 503);
            records.push({ ...ev, digest: sha256(raw) });
          }),
        );
      }
    }
    await walk(`.atlas/personal/coverage/${hostId}`, 0);
    const heads = new Map<string, CoverageEvent>();
    const groups = new Map<string, CoverageEvent[]>();
    for (const r of records) {
      const group = groups.get(r.entity_key) ?? [];
      group.push(r);
      groups.set(r.entity_key, group);
    }
    for (const [entity, group] of groups) {
      const byDigest = new Map(group.map((r) => [r.digest, r])),
        used = new Set(group.map((r) => r.previous_event_sha256));
      for (const r of group) {
        const previous = r.previous_event_sha256 ? byDigest.get(r.previous_event_sha256) : null;
        if (
          r.revision === 1
            ? r.previous_event_sha256 !== null
            : !previous || previous.revision + 1 !== r.revision
        )
          throw new DomainError("PERSONAL_JOURNAL_INTEGRITY", 503);
      }
      const latest = group.filter((r) => !used.has(r.digest));
      if (latest.length !== 1 || group.filter((r) => r.revision === 1).length !== 1)
        throw new DomainError("PERSONAL_JOURNAL_CONFLICT", 503);
      heads.set(entity, latest[0]!);
    }
    const state = { records, heads, bytes, files };
    cache.set(hostId, { state, signatures });
    return state;
  }
  async function list(hostId: string) {
    return vault.withLock(() => allUnlocked(hostId));
  }
  async function append(
    actor: LocalActor,
    data: CoverageData,
    expected: number,
    requestKey: string,
  ) {
    if (!/^[A-Za-z0-9._:-]{16,200}$/.test(requestKey))
      throw new DomainError("INVALID_REQUEST_KEY", 400);
    data = dataSchema.parse(data);
    return vault.withLock(async () =>
      appendUnlocked(await allUnlocked(data.host_id), actor, data, expected, requestKey),
    );
  }
  async function appendUnlocked(
    c: CoverageState,
    actor: LocalActor,
    data: CoverageData,
    expected: number,
    requestKey: string,
  ) {
    const entity = `${data.session_key}:${data.session_revision}`,
      payload = sha256(canonical({ data, expected }));
    const prior = c.records.find((r) => r.actor_id === actor.id && r.request_key === requestKey);
    if (prior) {
      if (prior.payload_sha256 !== payload) throw new DomainError("REQUEST_CONFLICT");
      return prior;
    }
    const old = c.heads.get(entity);
    if ((old?.revision ?? 0) !== expected) throw new DomainError("REVISION_CONFLICT");
    const record = eventSchema.parse({
      format_version: 1,
      entity_key: entity,
      revision: expected + 1,
      previous_event_sha256: old?.digest ?? null,
      request_key: requestKey,
      payload_sha256: payload,
      actor_id: actor.id,
      at: new Date().toISOString(),
      data,
    });
    const raw = canonical(record);
    if (
      Buffer.byteLength(raw) > 32768 ||
      c.files >= 100000 ||
      c.bytes + Buffer.byteLength(raw) > 134217728
    )
      throw new DomainError("PERSONAL_JOURNAL_LIMIT", 503);
    // Reserve admission synchronously before independent writes may yield.
    c.bytes += Buffer.byteLength(raw);
    c.files++;
    try {
      await vault.writeExclusive(
        `.atlas/personal/coverage/${data.host_id}/${data.session_key}/${sha256(`${actor.id}:${requestKey}`)}.json`,
        raw,
      );
    } catch (error) {
      cache.delete(data.host_id);
      throw error;
    }
    const result = { ...record, digest: sha256(raw) };
    c.records.push(result);
    c.heads.set(entity, result);
    await remember(data.host_id, [
      `.atlas/personal/coverage/${data.host_id}`,
      `.atlas/personal/coverage/${data.host_id}/${data.session_key}`,
      `.atlas/personal/coverage/${data.host_id}/${data.session_key}/${sha256(`${actor.id}:${requestKey}`)}.json`,
    ]);
    return result;
  }
  async function discover(actor: LocalActor, hostId: string, items: CoverageData[]) {
    return vault.withLock(async () => {
      const c = await allUnlocked(hostId),
        out: CoverageEvent[] = [],
        pending: CoverageData[] = [];
      const seen = new Set<string>();
      for (const item of items) {
        const data = dataSchema.parse(item);
        if (seen.has(data.session_key)) throw new DomainError("PERSONAL_SESSION_CONFLICT", 409);
        seen.add(data.session_key);
        for (const previous of [...c.heads.values()]) {
          if (
            previous.data.session_key === data.session_key &&
            previous.data.session_revision !== data.session_revision &&
            ["pending", "failed", "reviewing"].includes(previous.data.outcome)
          ) {
            await appendUnlocked(
              c,
              actor,
              {
                ...previous.data,
                outcome: "superseded",
                reason_code: "new_owner_revision",
                lease_expires_at: 0,
              },
              previous.revision,
              `supersede:${sha256(`${previous.entity_key}:${data.session_revision}`)}`,
            );
          }
        }
        const old = c.heads.get(`${data.session_key}:${data.session_revision}`);
        if (old && old.data.locator_id !== data.locator_id)
          throw new DomainError("PERSONAL_SESSION_CONFLICT", 409);
        if (old) out.push(old);
        else pending.push(data);
      }
      for (let i = 0; i < pending.length; i += 8) {
        const batch = await Promise.allSettled(
          pending
            .slice(i, i + 8)
            .map((data) =>
              appendUnlocked(
                c,
                actor,
                data,
                0,
                `discover:${sha256(`${data.session_key}:${data.session_revision}`)}`,
              ),
            ),
        );
        for (const result of batch) {
          if (result.status === "rejected") {
            cache.delete(hostId);
            throw result.reason;
          }
          out.push(result.value);
        }
      }
      return out;
    });
  }
  async function reconcile(actor: LocalActor, hostId: string, locators: string[]) {
    return vault.withLock(async () => {
      const c = await allUnlocked(hostId),
        present = new Set(locators);
      for (const previous of [...c.heads.values()]) {
        if (
          !present.has(previous.data.locator_id) &&
          ["pending", "failed", "reviewing"].includes(previous.data.outcome)
        )
          await appendUnlocked(
            c,
            actor,
            {
              ...previous.data,
              outcome: "source_unavailable",
              reason_code: "source_missing",
              lease_expires_at: 0,
            },
            previous.revision,
            `missing:${sha256(`${previous.entity_key}:${previous.revision}`)}`,
          );
      }
    });
  }
  return { list, append, discover, reconcile };
}
