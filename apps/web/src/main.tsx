import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import { App } from "./app/App.js";
import "./styles/global.css";
import "./styles/graph.css";
import "./styles/local-domain.css";
import "./styles/personal.css";
import { AuthProvider } from "./auth/AuthProvider.js";
import { useQuery } from "@tanstack/react-query";
import { LocalApp } from "./app/LocalApp.js";
function RuntimeApp() {
  const runtime = useQuery({
    queryKey: ["runtime"],
    queryFn: async ({ signal }) => {
      const r = await fetch("/api/v1/runtime", { signal, cache: "no-store" });
      if (!r.ok) throw Error("Local app could not be reached.");
      const value: unknown = await r.json();
      if (
        typeof value !== "object" ||
        value === null ||
        !("mode" in value) ||
        !["local", "cloud"].includes(String(value.mode))
      )
        throw Error("Invalid app mode");
      return value.mode;
    },
  });
  if (runtime.isPending) return <p role="status">Opening ATLAS…</p>;
  if (runtime.isError)
    return (
      <div role="alert">
        <p>{runtime.error.message}</p>
        <button type="button" onClick={() => void runtime.refetch()}>
          Retry
        </button>
      </div>
    );
  return runtime.data === "local" ? (
    <LocalApp />
  ) : (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 10000 } },
});
createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RuntimeApp />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
