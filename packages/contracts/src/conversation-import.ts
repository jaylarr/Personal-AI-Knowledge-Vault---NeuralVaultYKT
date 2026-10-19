import { z } from "zod";
export const conversationExportSchema = z
  .object({
    format: z.literal("atlas-selected-conversation-v1"),
    turns: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            role: z.enum(["user", "assistant", "system", "tool"]),
            timestamp: z.string().datetime().nullable(),
            text: z.string().max(2097152),
          })
          .strict(),
      )
      .max(1000),
  })
  .strict();
