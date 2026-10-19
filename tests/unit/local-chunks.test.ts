import { expect, it } from "vitest";
import { chunkText, sha256 } from "@atlas/core/local-domain";

const source = "00000000-0000-4000-8000-000000000001";
const version = "00000000-0000-4000-8000-000000000002";
it("preserves paragraphs, bounded fences, heading ancestry and exact oversized Unicode spans", () => {
  const fence = `\`\`\`js\n${"# ignored heading\n".repeat(30)}\`\`\`\n`;
  const text = `# C#\n\n${"Intro text.\n".repeat(30)}\n${fence}## Next\n\n${"🧠x".repeat(400)}\n`;
  const chunks = chunkText(source, version, text);
  expect(chunks.map((c) => c.text).join("")).toBe(text);
  expect(chunks.find((c) => c.text.includes("```js"))?.text).toBe(fence);
  expect(chunks.some((c) => c.heading_path.includes("ignored heading"))).toBe(false);
  expect(chunks.at(-1)?.heading_path).toEqual(["C#", "Next"]);
  for (const chunk of chunks) {
    expect(Buffer.byteLength(chunk.text)).toBeLessThanOrEqual(800);
    expect(Array.from(text).slice(chunk.start_offset, chunk.end_offset).join("")).toBe(chunk.text);
    expect(chunk.text_sha256).toBe(sha256(chunk.text));
  }
  expect(chunkText(source, version, text)).toEqual(chunks);
  expect(() => chunkText(source, version, text, "unrecognized-version")).toThrow(
    "PIPELINE_UNSUPPORTED",
  );
});
it("retains the original v1 evidence identity for historical text and PDF versions", () => {
  const text = "Legacy source 🧠.\n";
  const old = chunkText(source, version, text, "local-text-v1");
  expect(chunkText(source, version, text, "pdf-text-v1")).toEqual(old);
  expect(old[0]?.text).toBe(text);
  expect(old[0]?.id).toBe("99ec8204-22fc-542f-a7bf-750831232b7f");
  expect(old[0]?.id).not.toBe(chunkText(source, version, text)[0]?.id);
});
