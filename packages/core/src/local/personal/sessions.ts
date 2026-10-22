import { open, readdir, lstat, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join, sep, relative, isAbsolute } from "node:path";
import {
  personalExportSchema,
  personalSourceRefSchema,
  type PersonalHost,
  type PersonalSourceRef,
} from "@atlas/contracts";
import { DomainError, sha256, canonical } from "../transactions.js";
import { personalSecret } from "./policy.js";

export type OwnerInput = { id: string; turn: string | null; text: string; terminal: string };
export type SessionRead = {
  session_key: string;
  revision: string;
  locator_id: string;
  signature: string;
  version: string;
  messages: OwnerInput[];
  terminal: boolean;
  subagent: boolean;
  excluded: boolean;
  repository_digest: string | null;
};
export const injectedInput = (text: string) =>
  /^\s*(?:# AGENTS\.md|<environment_context>|<permissions|<external_codex|<skill>|<instructions>|<INSTRUCTIONS>)/i.test(
    text,
  );
export async function safeExternal(root: string, target: string) {
  const base = resolve(root),
    absolute = resolve(target),
    rel = relative(base, absolute);
  if (rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel))
    throw new DomainError("PERSONAL_PATH_DENIED", 403);
  // Full realpath resolves every ancestor, including Windows junctions.
  const [canonicalBase, canonicalTarget] = await Promise.all([realpath(base), realpath(absolute)]);
  if (
    resolve(canonicalBase).toLowerCase() !== base.toLowerCase() ||
    resolve(canonicalTarget).toLowerCase() !== absolute.toLowerCase()
  )
    throw new DomainError("PERSONAL_PATH_DENIED", 403);
  return absolute;
}
async function boundedBytes(root: string, path: string, max: number) {
  const safe = await safeExternal(root, path),
    before = await lstat(safe);
  if (!before.isFile() || before.size > max) throw new DomainError("PERSONAL_SOURCE_LIMIT", 413);
  const file = await open(safe, "r");
  try {
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const r = await file.read(bytes, offset, Math.min(65536, bytes.length - offset), offset);
      if (!r.bytesRead) break;
      offset += r.bytesRead;
    }
    const after = await file.stat();
    if (offset !== bytes.length || before.ino !== after.ino || after.size < before.size)
      throw new DomainError("PERSONAL_SOURCE_CHANGED");
    return {
      bytes,
      signature: sha256(`${before.dev}:${before.ino}:${before.size}:${before.mtimeMs}`),
    };
  } finally {
    await file.close();
  }
}
async function nativeLines(root: string, path: string, consume: (line: string) => void) {
  const safe = await safeExternal(root, path),
    before = await lstat(safe);
  if (!before.isFile() || before.size > 268435456)
    throw new DomainError("PERSONAL_SOURCE_LIMIT", 413);
  const file = await open(safe, "r"),
    started = performance.now();
  let pending = Buffer.alloc(0),
    offset = 0,
    complete = false;
  try {
    while (offset < before.size) {
      if (performance.now() - started > 2000) throw new DomainError("PERSONAL_SOURCE_LIMIT", 413);
      const chunk = Buffer.alloc(Math.min(65536, before.size - offset));
      const result = await file.read(chunk, 0, chunk.length, offset);
      if (!result.bytesRead) throw new DomainError("PERSONAL_SOURCE_CHANGED", 409);
      offset += result.bytesRead;
      pending = Buffer.concat([pending, chunk.subarray(0, result.bytesRead)]);
      let start = 0,
        newline = pending.indexOf(10);
      while (newline >= 0) {
        if (newline - start > 8388608) throw new DomainError("PERSONAL_SOURCE_LIMIT", 413);
        consume(pending.subarray(start, newline).toString("utf8"));
        complete = true;
        start = newline + 1;
        newline = pending.indexOf(10, start);
      }
      pending = pending.subarray(start);
      if (pending.length > 8388608) throw new DomainError("PERSONAL_SOURCE_LIMIT", 413);
    }
    const after = await file.stat();
    if (
      before.ino !== after.ino ||
      after.size < before.size ||
      (after.size === before.size && after.mtimeMs !== before.mtimeMs)
    )
      throw new DomainError("PERSONAL_SOURCE_CHANGED", 409);
    if (!complete) throw new DomainError("PERSONAL_FORMAT_UNSUPPORTED", 415);
    return sha256([before.dev, before.ino, before.size, before.mtimeMs].join(":"));
  } finally {
    await file.close();
  }
}
export function createSessionAdapter(hosts: PersonalHost[]) {
  const sessionLocators = new Map<string, string>();
  const locators = new Map<string, { host: string; path: string; exportSession?: string }>();
  const host = (id: string) => {
    const h = hosts.find((x) => x.id === id && x.enabled);
    if (!h) throw new DomainError("PERSONAL_HOST_DISABLED", 403);
    return h;
  };
  async function inventory(hostId: string) {
    const h = host(hostId),
      files: string[] = [];
    let limited = false;
    async function walk(root: string, folder: string, depth: number) {
      if (depth > 8) throw new DomainError("PERSONAL_SCAN_LIMIT", 413);
      let es: import("node:fs").Dirent[];
      try {
        es = await readdir(await safeExternal(root, folder), { withFileTypes: true });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
        throw e;
      }
      for (const e of es) {
        if (files.length >= 10000) {
          limited = true;
          break;
        }
        if (e.isSymbolicLink()) continue;
        const p = join(folder, e.name);
        if (e.isDirectory()) await walk(root, p, depth + 1);
        else if (e.isFile() && e.name.endsWith(".jsonl")) files.push(p);
      }
    }
    if (h.kind === "selected-export") {
      if (!h.export_path) throw new DomainError("PERSONAL_EXPORT_REQUIRED", 400);
      const { bytes } = await boundedBytes(h.codex_home, h.export_path, 2097152),
        v = personalExportSchema.parse(JSON.parse(bytes.toString("utf8")));
      if (v.host_id !== h.id) throw new DomainError("PERSONAL_HOST_MISMATCH", 400);
      const ids = v.sessions.map((s) => s.native_session_id);
      if (new Set(ids).size !== ids.length) throw new DomainError("PERSONAL_EXPORT_DUPLICATE", 400);
      const entries = v.sessions.map((s) => {
        const locator = sha256(`${h.id}:${h.export_path}:${s.native_session_id}`);
        locators.set(locator, {
          host: h.id,
          path: h.export_path!,
          exportSession: s.native_session_id,
        });
        return locator;
      });
      return { entries, complete: true };
    }
    await walk(h.codex_home, join(h.codex_home, "sessions"), 0);
    await walk(h.codex_home, join(h.codex_home, "archived_sessions"), 0);
    files.sort();
    const entries = files.map((path) => {
      const locator = sha256(`${h.id}:${path.toLowerCase()}`);
      locators.set(locator, { host: h.id, path });
      return locator;
    });
    return { entries, complete: !limited };
  }
  async function read(hostId: string, locator: string): Promise<SessionRead> {
    const h = host(hostId);
    let item = locators.get(locator);
    if (!item) {
      await inventory(hostId);
      item = locators.get(locator);
    }
    if (!item || item.host !== h.id) throw new DomainError("PERSONAL_SOURCE_UNAVAILABLE", 404);
    let bytes = Buffer.alloc(0),
      signature = "";
    try {
      if (h.kind === "selected-export")
        ({ bytes, signature } = await boundedBytes(
          h.codex_home,
          item.path,
          h.kind === "selected-export" ? 2097152 : 268435456,
        ));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        throw new DomainError("PERSONAL_SOURCE_UNAVAILABLE", 404);
      throw e;
    }
    const messages: OwnerInput[] = [],
      terminals = new Map<string, string>();
    let id = "",
      version = "",
      subagent = false,
      excluded = false,
      cwd = "";
    if (h.kind === "selected-export") {
      const parsed = personalExportSchema.parse(JSON.parse(bytes.toString("utf8"))),
        s = parsed.sessions.find((x) => x.native_session_id === item!.exportSession);
      if (parsed.host_id !== h.id) throw new DomainError("PERSONAL_FORMAT_UNSUPPORTED", 415);
      if (!s) throw new DomainError("PERSONAL_SOURCE_UNAVAILABLE", 404);
      id = s.native_session_id;
      version = s.source_version;
      for (const m of s.messages) {
        if (Buffer.byteLength(m.text) > 65536) throw new DomainError("PERSONAL_SOURCE_LIMIT", 413);
        messages.push({
          id: m.message_id,
          turn: m.turn_id,
          text: m.text,
          terminal: m.terminal_state,
        });
      }
    } else {
      // Read only complete JSONL records at the snapshot boundary. No reasoning/tool bodies enter output.
      let supported = false,
        retainedBytes = 0;
      signature = await nativeLines(h.codex_home, item.path, (line) => {
        let e: Record<string, any>;
        try {
          e = JSON.parse(line);
        } catch {
          throw new DomainError("PERSONAL_FORMAT_UNSUPPORTED", 415);
        }
        const p = e.payload;
        if (e.type === "session_meta") {
          id = p?.id;
          version = p?.cli_version;
          subagent = typeof p?.source === "object" && p.source !== null;
          cwd = typeof p?.cwd === "string" ? p.cwd : "";
        }
        if (e.type !== "event_msg") return;
        if (p?.type === "task_complete" || p?.type === "turn_aborted")
          terminals.set(p.turn_id, p.type === "task_complete" ? "completed" : "aborted");
        if (p?.type === "item_completed" && p.item?.type === "UserMessage") {
          supported = true;
          if (typeof p.item.id !== "string" || !Array.isArray(p.item.content))
            throw new DomainError("PERSONAL_FORMAT_UNSUPPORTED", 415);
          const text = p.item.content
            .filter((c: { type?: string }) => c.type === "text")
            .map((c: { text?: unknown }) => (typeof c.text === "string" ? c.text : ""))
            .join("\n");
          retainedBytes += Buffer.byteLength(text);
          if (retainedBytes > 8388608 || messages.length >= 5000)
            throw new DomainError("PERSONAL_SOURCE_LIMIT", 413);
          messages.push({
            id: p.item.id,
            turn: typeof p.turn_id === "string" ? p.turn_id : null,
            text,
            terminal: "open",
          });
        }
      });
      if (!supported && !subagent) throw new DomainError("PERSONAL_FORMAT_UNSUPPORTED", 415);
      for (const m of messages) m.terminal = m.turn ? (terminals.get(m.turn) ?? "open") : "open";
    }
    if (typeof id !== "string" || !id || id.length > 128 || typeof version !== "string")
      throw new DomainError("PERSONAL_FORMAT_UNSUPPORTED", 415);
    const unique = new Map<string, OwnerInput>();
    for (const m of messages) {
      if (!m.id || m.id.length > 128 || (m.turn && m.turn.length > 128))
        throw new DomainError("PERSONAL_FORMAT_UNSUPPORTED", 415);
      if (injectedInput(m.text) || !m.text.trim()) continue;
      // Explicit retention restrictions exclude the revision; never persist their text.
      if (
        /(?:do not|don't|never)\s+(?:save|store|remember|retain|capture|record|modify|write)\b|read.only/i.test(
          m.text,
        )
      )
        excluded = true;
      const previous = unique.get(m.id);
      if (previous && previous.text !== m.text)
        throw new DomainError("PERSONAL_DUPLICATE_MESSAGE", 415);
      unique.set(m.id, m);
    }
    const human = [...unique.values()];
    const revision = sha256(
      canonical(
        human.map((m) => ({
          id: m.id,
          turn: m.turn,
          text_sha256: sha256(m.text),
          terminal: m.terminal,
        })),
      ),
    );
    const sessionKey = sha256(`${h.id}:${id}`);
    sessionLocators.set(sessionKey, locator);
    return {
      session_key: sessionKey,
      revision,
      locator_id: locator,
      signature,
      version,
      messages: human,
      terminal: human.length > 0 && human.every((m) => m.terminal !== "open"),
      subagent,
      excluded,
      repository_digest: cwd ? sha256(resolve(cwd).toLowerCase()) : null,
    };
  }
  async function verify(ref: PersonalSourceRef) {
    const v = personalSourceRefSchema.parse(ref),
      items = await inventory(v.host_id);
    let found: SessionRead | undefined;
    const known = sessionLocators.get(v.session_key);
    for (const locator of known ? [known] : items.entries) {
      let x: SessionRead;
      try {
        x = await read(v.host_id, locator);
      } catch {
        continue;
      }
      if (x.session_key === v.session_key) {
        found = x;
        break;
      }
    }
    if (!found || found.excluded || found.subagent)
      throw new DomainError("PERSONAL_SOURCE_CHANGED");
    let verifiedLength = found.messages.length;
    if (found.revision !== v.session_revision) {
      const hash = createHash("sha256").update("[");
      let prefixMatches = false;
      for (const [index, message] of found.messages.entries()) {
        if (index) hash.update(",");
        hash.update(
          canonical({
            id: message.id,
            turn: message.turn,
            text_sha256: sha256(message.text),
            terminal: message.terminal,
          }),
        );
        if (hash.copy().update("]").digest("hex") === v.session_revision) {
          prefixMatches = true;
          verifiedLength = index + 1;
          break;
        }
      }
      if (!prefixMatches) throw new DomainError("PERSONAL_SOURCE_CHANGED", 409);
    }
    const m = found.messages
        .slice(0, verifiedLength)
        .find((x) => x.id === v.message_id && x.turn === v.turn_id),
      points = Array.from(m?.text ?? "");
    const quote = points.slice(v.start_codepoint, v.end_codepoint).join("");
    if (
      !m ||
      v.end_codepoint > points.length ||
      !quote ||
      personalSecret.test(m.text) ||
      sha256(quote) !== v.quote_sha256
    )
      throw new DomainError("PERSONAL_EVIDENCE_INVALID", 400);
    return { quote, session: found };
  }
  return { host, inventory, read, verify };
}
