import { resolve } from "node:path";
import { createLocalVault } from "@atlas/core/local-vault";
import { createLocalStore, backupLocalVault } from "@atlas/core/local-domain";
const args = process.argv.slice(2),
  vault = args[args.indexOf("--vault") + 1],
  destination = args[args.indexOf("--destination") + 1];
if (!args.includes("--vault") || !args.includes("--destination") || !vault || !destination)
  throw Error("Usage: --vault <absolute vault> --destination <new backup folder>");
const store = createLocalStore(createLocalVault(resolve(vault), "backup-cli"));
try {
  process.stdout.write(JSON.stringify(await backupLocalVault(store, resolve(destination))) + "\n");
} finally {
  store.close();
}
