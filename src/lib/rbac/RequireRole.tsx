import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import type { Role } from "../auth/AuthProvider";

export function RequireRole({ allow, children }: { allow: Role[]; children: JSX.Element }) {
  const { user, role, loading, claimsReady } = useAuth();
  const location = useLocation();

  if (loading || !claimsReady) {
    return <div className="p-6 text-slate-500">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!role || !allow.includes(role)) {
    return <Navigate to="/forbidden" replace />;
  }
  return children;
}
