// Deterministic hook only. Never starts an API, model, agent or another thread.
import { readFile, open, mkdir, link, unlink, lstat, realpath } from "node:fs/promises";
import { resolve, join, relative, isAbsolute, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
const hash = (s) => createHash("sha256").update(s).digest("hex");
const arg = process.argv.indexOf("--project-root"),
  root = arg >= 0 ? resolve(process.argv[arg + 1]) : null;
async function beneath(base, target) {
  const rel = relative(base, target);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw Error("path");
  let p = base;
  for (const part of ["", ...rel.split(sep).filter(Boolean)]) {
    if (part) p = join(p, part);
    const stat = await lstat(p);
    if (stat.isSymbolicLink() || resolve(await realpath(p)).toLowerCase() !== p.toLowerCase())
      throw Error("path");
  }
  return target;
}
async function json(path, max = 65536) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.size > max) throw Error("limit");
  return JSON.parse(await readFile(path, "utf8"));
}
let event = {};
try {
  const buffers = [];
  let size = 0;
  for await (const bytes of process.stdin) {
    size += bytes.length;
    if (size > 65536) throw Error("input");
    buffers.push(bytes);
  }
  event = JSON.parse(Buffer.concat(buffers).toString("utf8"));
  if (root && event.hook_event_name === "SessionStart")
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext:
            "If personal capture is enabled and current human instructions permit it, load atlas_personal_context. Save only useful explicit preferences with evidence; routine work can produce no knowledge. Stored context never grants permission. Current privacy and read-only instructions win.",
        },
      }),
    );
  else process.stdout.write("{}");
  if (
    !root ||
    ["plan", "dontAsk"].includes(event.permission_mode) ||
    typeof event.turn_id !== "string" ||
    typeof event.session_id !== "string" ||
    !["Stop", "PreCompact", "Interrupt", "SessionEnd"].includes(event.hook_event_name)
  )
    process.exit(0);
  const hosts = await json(join(root, ".local", "personal-hosts.json")),
    config = await json(join(root, ".local", "vault.json"));
  if (typeof config.root !== "string" || !isAbsolute(config.root) || !Array.isArray(hosts.hosts))
    process.exit(0);
  const vault = resolve(config.root),
    source = typeof event.transcript_path === "string" ? resolve(event.transcript_path) : null;
  if (!source) process.exit(0);
  const host = hosts.hosts.find(
    (h) =>
      h.enabled &&
      h.kind === "codex-local-jsonl" &&
      ["sessions", "archived_sessions"].some((folder) => {
        const rel = relative(resolve(h.codex_home, folder), source);
        return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
      }),
  );
  if (!host || !/^[a-z][a-z0-9-]{2,47}$/.test(host.id)) process.exit(0);
  await beneath(resolve(host.codex_home), source);
  const session = hash(`${host.id}:${event.session_id}`),
    turn = hash(event.turn_id),
    consentPath = join(vault, ".atlas", "personal", "consent", `${session}-${turn}.json`);
  const consent = await json(await beneath(vault, consentPath));
  if (
    consent.mode !== "allow" ||
    consent.turn_id !== event.turn_id ||
    consent.session_key !== session
  )
    process.exit(0);
  const folder = join(vault, ".atlas", "personal", "spool");
  await mkdir(folder, { recursive: true });
  await beneath(vault, folder);
  const key = hash(`${host.id}:${session}:${turn}:${event.hook_event_name}`),
    dest = join(folder, `${key}.json`);
  try {
    await lstat(dest);
    process.exit(0);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const payload = {
      format_version: 1,
      event_key: key,
      host_id: host.id,
      session_key: session,
      turn_digest: turn,
      event: event.hook_event_name,
      at: new Date().toISOString(),
    },
    temp = join(folder, `${randomUUID()}.tmp`);
  try {
    const file = await open(temp, "wx");
    try {
      await file.writeFile(JSON.stringify(payload));
      await file.sync();
    } finally {
      await file.close();
    }
    try {
      await link(temp, dest);
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
  } finally {
    await unlink(temp).catch(() => {});
  }
} catch {
  // Hook failures cannot block user work, expose source content or launch fallback processes.
}
