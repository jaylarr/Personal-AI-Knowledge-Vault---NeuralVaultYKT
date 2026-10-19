export type DirectoryCandidate = { path: string; bytes: number };
const ignored = new Set([
  ".git",
  ".atlas",
  ".obsidian",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".local",
  "vendor",
]);
export function previewDirectory(files: DirectoryCandidate[]) {
  const accepted: DirectoryCandidate[] = [],
    rejected: { path: string; reason: string }[] = [];
  let total = 0;
  for (const file of files) {
    const parts = file.path.replaceAll("\\", "/").split("/");
    let reason = "";
    if (
      parts.length > 12 ||
      parts.some(
        (p) => !p || p === ".." || p === "." || p.startsWith(".") || ignored.has(p.toLowerCase()),
      ) ||
      /[:<>"|?*\0]/.test(file.path)
    )
      reason = "Excluded folder or unsafe path";
    else if (!/\.(?:md|txt)$/i.test(file.path))
      reason = "Only Markdown and text files are selected";
    else if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > 2097152)
      reason = "File exceeds the 2 MiB text limit";
    else if (accepted.length >= 100 || total + file.bytes > 10485760)
      reason = "Selection exceeds 100 files or 10 MiB";
    if (reason) rejected.push({ path: file.path, reason });
    else {
      accepted.push(file);
      total += file.bytes;
    }
  }
  return { accepted, rejected, total_bytes: total };
}
