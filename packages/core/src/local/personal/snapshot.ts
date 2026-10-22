import { watch, type FSWatcher } from "node:fs";
import { lstat } from "node:fs/promises";
import { join } from "node:path";
import type { createLocalVault } from "../../local-vault.js";

// Derived only. Every hit validates identities/timestamps; watcher failures fall back to a full scan.
export function createPersonalSnapshot(vault: ReturnType<typeof createLocalVault>) {
  let watcher: FSWatcher | undefined,
    healthy = false,
    dirty = true;
  let cached: Awaited<ReturnType<typeof vault.snapshot>> | undefined;
  const signatures = new Map<string, string>();
  const events = new Set<string>();
  async function signature(path: string) {
    const s = await lstat(join(vault.root, ...path.split("/")), { bigint: true });
    if (s.isSymbolicLink()) throw Error("changed parent");
    return `${s.dev}:${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`;
  }
  async function batches<T>(items: T[], fn: (item: T) => Promise<void>) {
    for (let i = 0; i < items.length; i += 24) await Promise.all(items.slice(i, i + 24).map(fn));
  }
  function start() {
    if (watcher) return;
    try {
      watcher = watch(vault.root, { recursive: true }, (_event, value) => {
        const path = value?.toString().replaceAll("\\", "/");
        if (path && (path === ".atlas" || path.startsWith(".atlas/") || path.endsWith(".tmp")))
          return;
        if (path) events.add(path);
        else dirty = true;
      });
      healthy = true;
      watcher.unref();
      watcher.on("error", () => {
        healthy = false;
        dirty = true;
        watcher?.close();
        watcher = undefined;
      });
    } catch {
      healthy = false;
    }
  }
  async function read() {
    await new Promise<void>((r) => setImmediate(r));
    if (cached && healthy && !dirty) {
      try {
        await vault.safeExistingPath("Owner");
        let changed = false;
        await batches([...signatures], async ([path, expected]) => {
          if ((await signature(path)) !== expected) changed = true;
        });
        const unknown = [...events].some((path) => !signatures.has(path));
        events.clear();
        if (!changed && !dirty && !unknown) return cached;
      } catch {
        dirty = true;
      }
    }
    await vault.initialize();
    start();
    dirty = false;
    events.clear();
    const value = await vault.snapshot(),
      paths = new Set<string>([""]);
    for (const note of value.notes) {
      const parts = note.path.split("/");
      for (let i = 1; i <= parts.length; i++) paths.add(parts.slice(0, i).join("/"));
    }
    signatures.clear();
    await batches([...paths], async (path) => {
      signatures.set(path, await signature(path));
    });
    cached = value;
    return value;
  }
  return {
    read,
    close() {
      watcher?.close();
      watcher = undefined;
      healthy = false;
      cached = undefined;
    },
  };
}
