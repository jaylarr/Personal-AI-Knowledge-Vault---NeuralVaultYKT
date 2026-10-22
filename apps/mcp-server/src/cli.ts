import { callPersonal, personalOperations, type PersonalOperation } from "./personal-client.js";
// Same scoped workflow for agents whose current MCP tool inventory predates registration.
import { readFile } from "node:fs/promises";
import { localCheckpointInputSchema, localContextInputSchema } from "@atlas/contracts";
import { loadMcpConfig } from "./config.js";
import { createWorkflow } from "./workflow.js";
try {
  const [action, path, input] = process.argv.slice(2);
  if (action === "personal") {
    if (!input) throw Error("Personal JSON input path required");
    const payload = JSON.parse(await readFile(input, "utf8")) as {
      operation: string;
      input: unknown;
    };
    if (!Object.hasOwn(personalOperations, payload.operation))
      throw Error("Unknown personal operation");
    process.stdout.write(
      JSON.stringify(
        await callPersonal(
          loadMcpConfig(process.env),
          payload.operation as PersonalOperation,
          payload.input,
        ),
      ) + "\n",
    );
    process.exit(0);
  }
  if (!path) throw Error("Absolute repository path required");
  const workflow = createWorkflow(loadMcpConfig(process.env));
  const value =
    action === "start"
      ? await workflow.start(path)
      : action === "context"
        ? await workflow.context(
            path,
            input?.toLowerCase().endsWith(".json")
              ? localContextInputSchema.parse(JSON.parse(await readFile(input, "utf8")))
              : { query: input ?? "" },
          )
        : action === "save" && input
          ? await workflow.save(
              path,
              localCheckpointInputSchema.parse(JSON.parse(await readFile(input, "utf8"))),
            )
          : undefined;
  if (!value) throw Error("Use start, context or save with a JSON checkpoint path");
  process.stdout.write(`${JSON.stringify(value)}\n`);
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : "ATLAS failed"}\n`);
  process.exitCode = 1;
}
