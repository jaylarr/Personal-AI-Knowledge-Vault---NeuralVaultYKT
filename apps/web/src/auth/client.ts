import { z } from "@atlas/contracts";
import { createManagedAuth } from "./managed-sdk.mjs";

const baseUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;
const responseSchema = z.object({
  data: z.unknown().optional(),
  error: z.unknown().nullable().optional(),
});
const sessionSchema = z.object({
  user: z.object({ email: z.string().email() }),
  session: z.unknown(),
});
const tokenSchema = z.object({ token: z.string().min(1) });

function buildClient(url: string) {
  const sdk = createManagedAuth(url);
  return {
    getSession: async () => {
      const result = responseSchema.parse(await sdk.getSession());
      return { error: result.error, data: result.data ? sessionSchema.parse(result.data) : null };
    },
    signIn: {
      email: async (input: { email: string; password: string }) =>
        responseSchema.parse(await sdk.signIn(input)),
    },
    signUp: {
      email: async (input: { email: string; password: string; name: string }) =>
        responseSchema.parse(await sdk.signUp(input)),
    },
    signOut: async () => responseSchema.parse(await sdk.signOut()),
    token: async () => {
      const result = responseSchema.parse(await sdk.token());
      return { error: result.error, data: result.data ? tokenSchema.parse(result.data) : null };
    },
  };
}
export const authClient = baseUrl ? buildClient(baseUrl) : null;
