import { expect, it } from "vitest";
import { previewDirectory, conversationExportSchema } from "@atlas/contracts";
import { parseN8nExport, parseSelectedConversation, sha256 } from "@atlas/core/local-domain";

it("inventories an inert supplied workflow without executing code or exposing credential references/pin data", () => {
  const workflow = {
      name: "Fictional offline example",
      nodes: [
        { name: "Receive", type: "n8n-nodes-base.manualTrigger", typeVersion: 1 },
        {
          name: "Keep text",
          type: "n8n-nodes-base.set",
          typeVersion: 3,
          credentials: {
            fictional: { id: "private-reference-id", name: "Private reference name" },
          },
          parameters: { jsCode: "throw Error('must never execute')" },
        },
      ],
      connections: { Receive: { main: [[{ node: "Keep text", type: "main", index: 0 }]] } },
      pinData: { "Keep text": [{ fictional: "must not enter context" }] },
    },
    bytes = Buffer.from(JSON.stringify(workflow)),
    before = sha256(bytes),
    parsed = parseN8nExport(bytes);
  expect(parsed.nodes).toBe(2);
  expect(parsed.connections).toBe(1);
  expect(parsed.text).toContain("n8n-nodes-base.set");
  for (const withheld of [
    "private-reference-id",
    "Private reference name",
    "must not enter context",
    "must never execute",
  ])
    expect(parsed.text).not.toContain(withheld);
  expect(sha256(bytes)).toBe(before);
  expect(() =>
    parseN8nExport(
      Buffer.from(
        JSON.stringify({
          ...workflow,
          connections: { Unknown: { main: [[{ node: "Receive" }]] } },
        }),
      ),
    ),
  ).toThrow();
  expect(() =>
    parseN8nExport(
      Buffer.from(
        JSON.stringify({ ...workflow, extra: { password: "fictional_password_canary_123456" } }),
      ),
    ),
  ).toThrow("N8N_EXPORT_REQUIRES_SECRET_REMOVAL");
});
it("previews only explicit bounded text selections and excludes hidden/build/unsafe paths", () => {
  const selected = previewDirectory([
    { path: "Chosen/notes/brief.md", bytes: 100 },
    { path: "Chosen/.env", bytes: 20 },
    { path: "Chosen/node_modules/package/readme.md", bytes: 100 },
    { path: "Chosen/dist/output.txt", bytes: 30 },
    { path: "../outside.txt", bytes: 10 },
    { path: "Chosen/secret.txt:stream", bytes: 10 },
    { path: "Chosen/photo.png", bytes: 100 },
  ]);
  expect(selected.accepted).toEqual([{ path: "Chosen/notes/brief.md", bytes: 100 }]);
  expect(selected.rejected).toHaveLength(6);
  expect(
    previewDirectory(Array.from({ length: 101 }, (_, i) => ({ path: `Chosen/${i}.txt`, bytes: 1 })))
      .accepted,
  ).toHaveLength(100);
});
it("retains only explicitly selected attributed conversation turns and rejects unsupported archives", () => {
  const value = conversationExportSchema.parse({
      format: "atlas-selected-conversation-v1",
      turns: [
        {
          id: "u1",
          role: "user",
          timestamp: "2026-10-17T00:00:00.000Z",
          text: "A fictional observation.",
        },
        {
          id: "a1",
          role: "assistant",
          timestamp: null,
          text: "A fictional unverified suggestion. 🧠",
        },
        { id: "omit", role: "user", timestamp: null, text: "Omitted private canary." },
      ],
    }),
    bytes = Buffer.from(JSON.stringify(value)),
    selected = parseSelectedConversation(bytes, ["u1", "a1"]);
  expect(selected.text).toContain("assistant · time unknown");
  expect(selected.text).not.toContain("Omitted private canary");
  expect(selected.bytes.toString()).not.toContain("Omitted private canary");
  expect(selected.export_sha256).toBe(sha256(bytes));
  expect(bytes.toString()).toContain("Omitted private canary");
  expect(() => parseSelectedConversation(bytes, [])).toThrow();
  expect(() => parseSelectedConversation(bytes, ["absent"])).toThrow();
  expect(() => parseSelectedConversation(Buffer.from("{}"), ["u1"])).toThrow();
});
