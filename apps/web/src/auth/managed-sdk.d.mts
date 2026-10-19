export function createManagedAuth(baseUrl: string): {
  getSession(): Promise<unknown>;
  signIn(input: { email: string; password: string }): Promise<unknown>;
  signUp(input: { email: string; password: string; name: string }): Promise<unknown>;
  signOut(): Promise<unknown>;
  token(): Promise<unknown>;
};
