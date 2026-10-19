import { conversationExportSchema } from "@atlas/contracts";
import { DomainError, canonical, sha256 } from "../transactions.js";
import { normalized } from "../sources.js";
export function parseSelectedConversation(bytes: Uint8Array, selected: string[]) {
  if (bytes.length > 2097152 || !selected.length || new Set(selected).size !== selected.length)
    throw new DomainError("CONVERSATION_SELECTION_REQUIRED", 400);
  let input: unknown;
  try {
    input = JSON.parse(normalized(bytes));
  } catch {
    throw new DomainError("CONVERSATION_FORMAT_UNSUPPORTED", 415);
  }
  const parsed = conversationExportSchema.safeParse(input);
  if (
    !parsed.success ||
    new Set(parsed.data.turns.map((t) => t.id)).size !== parsed.data.turns.length
  )
    throw new DomainError("CONVERSATION_FORMAT_UNSUPPORTED", 415);
  const turns = parsed.data.turns.filter((t) => selected.includes(t.id));
  if (turns.length !== selected.length)
    throw new DomainError("CONVERSATION_SELECTION_INVALID", 400);
  const original = Buffer.from(canonical({ format: parsed.data.format, turns })),
    text = turns
      .map((t) => `## ${t.role} · ${t.timestamp ?? "time unknown"} · ${t.id}\n\n${t.text}`)
      .join("\n\n");
  if (original.length > 2097152 || Buffer.byteLength(text) > 2097152)
    throw new DomainError("CONVERSATION_SELECTION_TOO_LARGE", 413);
  return {
    bytes: original,
    text,
    export_sha256: sha256(bytes),
    extraction_status: "selected_conversation_turns",
  };
}
