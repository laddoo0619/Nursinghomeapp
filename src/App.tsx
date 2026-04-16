import { Navigate, Route, Routes } from "react-router-dom";
import { RequireRole } from "./lib/rbac/RequireRole";
import { useAuth } from "./lib/auth/useAuth";
import { LoginPage } from "./pages/Login";
import { ForbiddenPage } from "./pages/Forbidden";

function RoleHome() {
  const { role, user, loading, claimsReady } = useAuth();
  if (loading || !claimsReady) return <div className="p-6 text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role === "nurse") return <Navigate to="/nurse" replace />;
  if (role === "pharmacy") return <Navigate to="/pharmacy" replace />;
  return <Navigate to="/forbidden" replace />;
}

// Phase A placeholders — portal UIs ship in Phase B.
function NursePlaceholder() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Nursing Portal</h1>
      <p className="text-slate-600">UI lands in Phase B.</p>
    </div>
  );
}
function PharmacyPlaceholder() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Pharmacy Portal</h1>
      <p className="text-slate-600">UI lands in Phase B.</p>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleHome />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route
        path="/nurse/*"
        element={
          <RequireRole allow={["nurse"]}>
            <NursePlaceholder />
          </RequireRole>
        }
      />
      <Route
        path="/pharmacy/*"
        element={
          <RequireRole allow={["pharmacy"]}>
            <PharmacyPlaceholder />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
