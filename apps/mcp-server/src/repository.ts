import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, resolve } from "node:path";
import { createHash } from "node:crypto";
const exec = promisify(execFile);
export function normalizeRemote(raw: string): string | undefined {
  const s = raw.trim();
  try {
    const u = new URL(
      s.includes("://") ? s : s.replace(/^(?:[^@/:]+@)?([^/:]+):(.+)$/, "ssh://$1/$2"),
    );
    if (
      !["https:", "http:", "ssh:", "git:"].includes(u.protocol) ||
      !u.hostname ||
      !u.pathname ||
      u.pathname === "/"
    )
      return;
    let path = u.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
    if (["github.com", "gitlab.com", "bitbucket.org"].includes(u.hostname.toLowerCase()))
      path = path.toLowerCase();
    return `remote:${u.hostname.toLowerCase()}${u.port ? `:${u.port}` : ""}/${path}`;
  } catch {
    return;
  }
}
export async function identifyRepository(path: string) {
  if (!isAbsolute(path)) throw Error("repository_path must be absolute");
  let folder = await realpath(path);
  if (!(await stat(folder)).isDirectory()) throw Error("Repository directory required");
  let identity: string | undefined;
  const git = async (args: string[]) =>
    (
      await exec("git", ["-C", folder, ...args], {
        timeout: 5000,
        maxBuffer: 16384,
        windowsHide: true,
      })
    ).stdout.trim();
  try {
    folder = await realpath(await git(["rev-parse", "--show-toplevel"]));
    const common = await realpath(resolve(folder, await git(["rev-parse", "--git-common-dir"])));
    identity = `git:${process.platform === "win32" ? common.toLowerCase() : common}`;
    try {
      identity = normalizeRemote(await git(["remote", "get-url", "origin"])) ?? identity;
    } catch {
      /* Local Git repository. */
    }
  } catch {
    /* Non-Git project uses its canonical directory. */
  }
  identity ??= `folder:${process.platform === "win32" ? folder.toLowerCase() : folder}`;
  return {
    repository_digest: createHash("sha256").update(identity).digest("hex"),
    name: basename(folder).slice(0, 120),
    directory: folder,
  };
}
