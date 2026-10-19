import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
type User = { email: string };
const AuthContext = createContext<{
  user: User | null;
  pending: boolean;
  restoreError: string;
  setUser: (user: User | null) => void;
}>({ user: null, pending: true, restoreError: "", setUser: () => {} });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setCurrentUser] = useState<User | null>(null),
    [pending, setPending] = useState(Boolean(import.meta.env.VITE_NEON_AUTH_URL));
  const cache = useQueryClient();
  const [restoreError, setRestoreError] = useState("");
  const setUser = (next: User | null) => {
    void cache.cancelQueries();
    cache.clear();
    setRestoreError("");
    setCurrentUser(next);
  };
  useEffect(() => {
    let active = true;
    void import("./client.js")
      .then(({ authClient }) => authClient?.getSession())
      .then((result) => {
        if (active) {
          setCurrentUser(result?.data?.user ?? null);
          if (result?.error)
            setRestoreError("Could not restore your session. Try signing in again.");
          setPending(false);
        }
      })
      .catch(() => {
        if (active) {
          setPending(false);
          setRestoreError("Authentication could not be reached. Try signing in again.");
        }
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <AuthContext.Provider value={{ user, pending, restoreError, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
