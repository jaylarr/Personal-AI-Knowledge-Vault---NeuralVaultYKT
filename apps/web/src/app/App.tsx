import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Circle,
  Database,
  FileText,
  Layers3,
  LoaderCircle,
  Network,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { ownerSessionSchema, type SetupCode } from "@atlas/contracts";
import { useAuth } from "../auth/AuthProvider.js";
import { authorizedRequest } from "../lib/authorized.js";
const WorkspaceManager = lazy(() =>
  import("./WorkspaceManager.js").then((module) => ({ default: module.WorkspaceManager })),
);
import { getReadiness } from "../lib/api.js";
const AuthPanel = lazy(() =>
  import("../auth/AuthPanel.js").then((module) => ({ default: module.AuthPanel })),
);

const labels: Partial<Record<SetupCode, string>> = {
  DATABASE_NOT_CONFIGURED: "Connect the dedicated Neon database",
  WORKER_DATABASE_NOT_CONFIGURED: "Configure the ingestion worker",
  AUTH_NOT_CONFIGURED: "Connect managed authentication",
  OWNER_NOT_BOUND: "Bind your owner identity",
  STORAGE_NOT_CONFIGURED: "Connect private source storage",
  LIVE_SETUP_NOT_VERIFIED: "Verify the connected installation",
};
const navigation = [
  { to: "/", label: "Workspace", icon: Layers3 },
  { to: "/inbox", label: "Inbox", icon: FileText },
  { to: "/graph", label: "Knowledge graph", icon: Network },
  { to: "/memory", label: "Memory", icon: BookOpen },
  { to: "/agents", label: "Agents", icon: Sparkles },
];

export function App() {
  const auth = useAuth();
  const owner = useQuery({
    queryKey: ["owner", auth.user?.email],
    enabled: Boolean(auth.user),
    queryFn: async ({ signal }) =>
      ownerSessionSchema.parse(await authorizedRequest("/me", { signal })),
    staleTime: 0,
  });
  const location = useLocation();
  const current = navigation.find((entry) => entry.to === location.pathname)?.label ?? "Setup";
  const readiness = useQuery({
    queryKey: ["readiness"],
    queryFn: ({ signal }) => getReadiness(signal),
  });
  const services = useQuery({
    queryKey: ["neon-services"],
    queryFn: async () => {
      const response = await fetch("/api/v1/setup/services", {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("Service check unavailable");
      return response.json() as Promise<{ database: string; auth: string; storage: string }>;
    },
  });
  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Workspace navigation">
        <NavLink to="/" className="brand" aria-label="ATLAS home">
          <span className="brand-mark">
            <Network size={20} />
          </span>
          <span>
            ATLAS<span className="brand-subtitle">Personal knowledge</span>
          </span>
        </NavLink>
        <div className="workspace-label">
          <span className="owner-mark">A</span>
          <span>
            Your workspace<small>Local installation</small>
          </span>
        </div>
        <span className="section-label">WORKSPACE</span>
        <nav>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <Icon size={17} />
              <span>{label}</span>
              {to === "/" && <ChevronRight size={14} />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={17} />
          <p>
            Knowledge you own.
            <br />
            <span>Shared on your terms.</span>
          </p>
        </div>
        <NavLink className="nav-item setup-link" to="/setup">
          <Settings2 size={17} />
          <span>Installation setup</span>
        </NavLink>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <div className="breadcrumb">
            Your workspace
            <ChevronRight size={13} />
            <span>{current}</span>
          </div>
          <span className="local-status">
            <span />
            Local
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <section className="main-heading">
            <div>
              <p className="eyebrow">PERSONAL KNOWLEDGE</p>
              <h1>{current === "Workspace" ? "Your knowledge workspace" : current}</h1>
              <p className="intro">Keep your sources, decisions, and useful context together.</p>
            </div>
            <span className="phase-label">{owner.data ? "WORKSPACE" : "INSTALLATION SETUP"}</span>
          </section>
          {auth.user && owner.isPending && <p role="status">Checking workspace access…</p>}
          {auth.user && owner.isError && <p role="status">{owner.error.message}</p>}
          {auth.user && owner.data && !owner.isError ? (
            <Suspense fallback={<p role="status">Loading workspace…</p>}>
              <WorkspaceManager workspaceId={owner.data.workspace.id} />
            </Suspense>
          ) : (
            <div className="content-grid">
              <section className="setup-card" aria-labelledby="setup-title">
                <div className="card-icon">
                  <Database size={23} />
                </div>
                <p className="eyebrow">START WITH THE FOUNDATION</p>
                <h2 id="setup-title">Connect your knowledge vault</h2>
                {services.data && (
                  <p className="service-summary" role="status">
                    PostgreSQL: {services.data.database} · Auth: {services.data.auth}
                    {" · Originals: "}
                    {services.data.storage}
                  </p>
                )}
                <p className="card-description">
                  Your workspace will be available after the dedicated database, authentication, and
                  private storage are connected.
                </p>
                <div className="setup-status" role="status">
                  {readiness.isPending ? (
                    <>
                      <LoaderCircle size={16} className="spin" />
                      Checking local service…
                    </>
                  ) : readiness.isError ? (
                    <>
                      <Circle size={14} />
                      Local service is unavailable
                    </>
                  ) : (
                    <>
                      <Circle size={14} />
                      Setup required
                    </>
                  )}
                </div>
                {readiness.isError ? (
                  <div className="connection-error">
                    <p>The local API could not be reached. Start the API and try again.</p>
                    <button type="button" onClick={() => void readiness.refetch()}>
                      <RefreshCw size={15} />
                      Check connection
                    </button>
                  </div>
                ) : (
                  readiness.data && (
                    <ol className="setup-list">
                      {readiness.data.codes.map((code, index) => (
                        <li key={code}>
                          <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                          <span>{labels[code]}</span>
                          <span className="pending-label">Pending</span>
                        </li>
                      ))}
                    </ol>
                  )
                )}
                <div className="card-footer">
                  <ShieldCheck size={16} />
                  <span>No knowledge has been loaded into this installation.</span>
                </div>
                <Suspense fallback={<p role="status">Loading account connection…</p>}>
                  <AuthPanel />
                </Suspense>
              </section>
              <aside className="context-panel" aria-label="How your vault works">
                <p className="eyebrow">BUILT AROUND YOUR WORK</p>
                <h2>Useful beyond one session.</h2>
                <div className="workflow-item">
                  <span>
                    <FileText size={17} />
                  </span>
                  <div>
                    <h3>Keep the original</h3>
                    <p>Save notes and documentation with their source history intact.</p>
                  </div>
                </div>
                <div className="workflow-item">
                  <span>
                    <Sparkles size={17} />
                  </span>
                  <div>
                    <h3>Let your agents organize</h3>
                    <p>Connected agents suggest memories and relationships for review.</p>
                  </div>
                </div>
                <div className="workflow-item">
                  <span>
                    <Check size={17} />
                  </span>
                  <div>
                    <h3>Bring context forward</h3>
                    <p>Approved knowledge becomes available to future authorized sessions.</p>
                  </div>
                </div>
                <div className="processing-note">
                  <h3>You control the sharing.</h3>
                  <p>New notes wait in the Inbox until an authorized agent processes them.</p>
                </div>
                <NavLink to="/setup" className="text-link">
                  Installation setup
                  <ArrowUpRight size={15} />
                </NavLink>
              </aside>
            </div>
          )}
          <footer className="workspace-footer">
            <span>ATLAS / PERSONAL KNOWLEDGE WORKSPACE</span>
            <span>Foundation in development</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
