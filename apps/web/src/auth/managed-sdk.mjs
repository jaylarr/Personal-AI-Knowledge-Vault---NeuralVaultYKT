// Isolate the prerelease SDK's invalid published declaration files at this runtime boundary.
// client.ts validates every result before application code consumes it.
import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react/adapters";

export function createManagedAuth(baseUrl) {
  const client = createAuthClient(baseUrl, { adapter: BetterAuthReactAdapter() });
  const resultOf = async (action) => {
    try {
      return await action();
    } catch {
      return { data: null, error: { code: "AUTH_REQUEST_FAILED" } };
    }
  };
  return {
    getSession: () => client.getSession(),
    signIn: (input) => resultOf(() => client.signIn.email(input)),
    signUp: (input) => resultOf(() => client.signUp.email(input)),
    signOut: () => resultOf(() => client.signOut()),
    // This exact SDK release injects the signed set-auth-jwt header into session.token
    // in its getSession success hook. Its dynamic /token action is not functional here.
    token: async () => {
      const result = await client.getSession();
      return {
        data: result.data?.session?.token ? { token: result.data.session.token } : null,
        error: result.error,
      };
    },
  };
}
