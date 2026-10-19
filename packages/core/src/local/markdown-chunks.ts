import { localChunkSchema, type LocalChunk } from "@atlas/contracts";
import { sha256 } from "./transactions.js";

// Offsets always refer to the original normalized Unicode code points. Blocks
// influence boundaries only; they never add markers or rewrite source text.
export function markdownChunks(sourceId: string, versionId: string, text: string): LocalChunk[] {
  const blocks: { text: string; heading: string[] }[] = [];
  let pending = "",
    headings: string[] = [],
    blockHeading: string[] = [];
  let fence: { char: string; length: number } | undefined;
  const flush = () => {
    if (pending) blocks.push({ text: pending, heading: [...blockHeading] });
    pending = "";
    blockHeading = [...headings];
  };
  for (const match of text.matchAll(/[^\n]*(?:\n|$)/g)) {
    const line = match[0];
    if (!line) continue;
    const marker = /^ {0,3}(`{3,}|~{3,})(.*?)(?:\n)?$/.exec(line);
    if (fence) {
      pending += line;
      if (
        marker &&
        marker[1]?.[0] === fence.char &&
        marker[1].length >= fence.length &&
        !marker[2]?.trim()
      ) {
        fence = undefined;
        flush();
      }
      continue;
    }
    if (marker) {
      flush();
      fence = { char: marker[1]![0]!, length: marker[1]!.length };
      pending = line;
      continue;
    }
    const heading = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:\n)?$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1]!.length;
      headings = headings.slice(0, level - 1);
      headings[level - 1] = heading[2]!.trim().replace(/[ \t]+#+[ \t]*$/, "");
      blockHeading = headings.filter(Boolean);
    }
    pending += line;
    if (!line.trim()) flush();
  }
  flush();
  const groups: { text: string; heading: string[] }[] = [];
  for (const block of blocks) {
    const previous = groups.at(-1),
      bytes = Buffer.byteLength(block.text);
    if (
      previous &&
      Buffer.byteLength(previous.text) < 400 &&
      Buffer.byteLength(previous.text) + bytes <= 800 &&
      JSON.stringify(previous.heading) === JSON.stringify(block.heading)
    ) {
      previous.text += block.text;
      continue;
    }
    // Oversized indivisible paragraphs/fences must still respect the hard cap.
    // Split only between complete code points, retaining every byte of text.
    let part = "",
      units = 0;
    for (const point of block.text) {
      const cost = Buffer.byteLength(point);
      if (units + cost > 800) {
        groups.push({ text: part, heading: block.heading });
        part = "";
        units = 0;
      }
      part += point;
      units += cost;
    }
    if (part) groups.push({ text: part, heading: block.heading });
  }
  let offset = 0;
  return groups.map((group, sequence) => {
    const start = offset,
      end = start + Array.from(group.text).length;
    offset = end;
    const digest = sha256(group.text),
      h = sha256(`${versionId}:local-text-v2:${sequence}:${start}:${end}:${digest}`);
    return localChunkSchema.parse({
      id: `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`,
      source_id: sourceId,
      source_version_id: versionId,
      sequence,
      heading_path: group.heading,
      start_offset: start,
      end_offset: end,
      text_sha256: digest,
      estimated_units: Buffer.byteLength(group.text),
      text: group.text,
    });
  });
}
