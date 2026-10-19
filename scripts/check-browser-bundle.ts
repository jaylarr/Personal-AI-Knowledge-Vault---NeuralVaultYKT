import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve("apps/web/dist/assets");
const forbidden = [
  "DATABASE_URL",
  "WORKER_DATABASE_URL",
  "AWS_SECRET_ACCESS_KEY",
  "ATLAS_AGENT_TOKEN",
  "@atlas/core",
  "node:crypto",
  "node:fs",
  "OPENAI_API_KEY",
];
try {
  const files = (await readdir(directory)).filter((name) => name.endsWith(".js"));
  if (!files.length) throw new Error("Browser build missing");
  for (const name of files) {
    const content = await readFile(resolve(directory, name), "utf8");
    if (forbidden.some((value) => content.includes(value)))
      throw new Error("Server-only marker found");
  }
  process.stdout.write(
    `Checked ${files.length} browser JavaScript bundle(s); no server-only markers found.\n`,
  );
} catch {
  process.stderr.write(
    "Browser bundle boundary verification failed. Inspect the build without printing secret values.\n",
  );
  process.exitCode = 1;
}
