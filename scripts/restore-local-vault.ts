import { resolve } from "node:path";
import { restoreLocalVault } from "@atlas/core/local-domain";
const args = process.argv.slice(2),
  input = args[args.indexOf("--package") + 1],
  destination = args[args.indexOf("--destination") + 1];
if (!args.includes("--package") || !args.includes("--destination") || !input || !destination)
  throw Error(
    "Usage: --package <complete backup folder> --destination <nonexistent restore folder>",
  );
process.stdout.write(
  JSON.stringify(await restoreLocalVault(resolve(input), resolve(destination))) + "\n",
);
