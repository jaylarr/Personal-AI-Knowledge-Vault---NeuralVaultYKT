import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "./client.js";
import { useAuth } from "./AuthProvider.js";

export function AuthPanel({ bound = false }: { bound?: boolean }) {
  if (!authClient) return null;
  return <ConfiguredAuth bound={bound} />;
}
function ConfiguredAuth({ bound }: { bound: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const { user, setUser, pending: restoring, restoreError } = useAuth();
  const [busy, setPending] = useState(false);
  const pending = busy || restoring;
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const cache = useQueryClient();
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authClient) return;
    setPending(true);
    setMessage("");
    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({ email, password, name: email.split("@")[0] || "Owner" })
          : await authClient.signIn.email({ email, password });
      setPassword("");
      if (result.error) {
        setMessage("Authentication failed. Check your details or email verification requirements.");
        return;
      }
      const session = await authClient.getSession();
      setUser(session.data?.user ? { email: session.data.user.email } : null);
      if (!session.data?.user)
        setMessage("Account created. Check your email if verification is required, then sign in.");
    } catch {
      setMessage("Authentication service could not be reached.");
    } finally {
      setPending(false);
    }
  }
  async function checkConnection() {
    if (!authClient) return;
    setPending(true);
    setMessage("");
    try {
      const token = await authClient.token();
      if (!token.data?.token) throw new Error("Session unavailable");
      const response = await fetch("/api/v1/auth/check", {
        method: "POST",
        headers: { Authorization: `Bearer ${token.data.token}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("Check failed");
      const body = (await response.json()) as { receipt: { id: string } | null };
      if (!body.receipt) throw new Error("Receipt missing");
      setReceipt(body.receipt.id);
      setMessage("Authentication and database write verified. Vault setup is still required.");
    } catch {
      setMessage(
        "Connection check failed. Sign in again or retry when the services are available.",
      );
    } finally {
      setPending(false);
    }
  }
  async function signOut() {
    if (!authClient) return;
    setPending(true);
    setMessage("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed");
      cache.clear();
      setUser(null);
      setPassword("");
      setReceipt(null);
    } catch {
      setMessage("Sign out failed. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="auth-panel" aria-labelledby="auth-title">
      <h3 id="auth-title">{user ? "Signed in" : "Connect your account"}</h3>
      {user ? (
        <>
          <p data-testid="signed-in-user">{user.email}</p>
          <p className="auth-description">
            {bound
              ? "Your account has access to this workspace."
              : "Sign-in verifies your identity. Vault access requires a separately bound owner."}
          </p>
          <div className="auth-actions">
            {!bound && (
              <button type="button" disabled={pending} onClick={() => void checkConnection()}>
                Test database connection
              </button>
            )}
            <button type="button" disabled={pending} onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={pending}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              minLength={8}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending}
            />
          </label>
          <div className="auth-actions">
            <button type="submit" disabled={pending}>
              {pending ? "Please wait…" : mode === "sign-up" ? "Create account" : "Sign in"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                setMessage("");
              }}
            >
              {mode === "sign-in" ? "Create an account" : "Use existing account"}
            </button>
          </div>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      {!message && restoreError && <p role="status">{restoreError}</p>}
      {receipt && (
        <p className="receipt" data-testid="verification-receipt">
          Verification receipt: {receipt}
        </p>
      )}
    </section>
  );
}
