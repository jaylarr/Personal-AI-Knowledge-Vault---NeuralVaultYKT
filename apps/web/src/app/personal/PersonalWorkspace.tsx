import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
const Profile = lazy(() =>
  import("./PersonalProfile.js").then((m) => ({ default: m.PersonalProfile })),
);
const Skills = lazy(() =>
  import("./PersonalSkills.js").then((m) => ({ default: m.PersonalSkills })),
);
const Coverage = lazy(() =>
  import("./PersonalCoverage.js").then((m) => ({ default: m.PersonalCoverage })),
);
const Candidates = lazy(() =>
  import("./PersonalCandidates.js").then((m) => ({ default: m.PersonalCandidates })),
);
export function PersonalWorkspace() {
  const { pathname } = useLocation();
  return (
    <div className="personal-workspace">
      <Suspense fallback={<p role="status">Opening personal workspace…</p>}>
        {pathname === "/skills" ? (
          <Skills />
        ) : pathname === "/coverage" ? (
          <Coverage />
        ) : pathname === "/personal/review" ? (
          <Candidates />
        ) : (
          <Profile />
        )}
      </Suspense>
    </div>
  );
}
