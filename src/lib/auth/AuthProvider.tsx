import { createContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { auth } from "../firebase";

export type Role = "nurse" | "pharmacy";

export type AuthState = {
  user: User | null;
  role: Role | null;
  claimsReady: boolean;
  loading: boolean;
};

export const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  claimsReady: false,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [claimsReady, setClaimsReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onIdTokenChanged fires on sign-in, sign-out, AND token refresh — so
    // updated custom claims propagate without a reload.
    const unsub = onIdTokenChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setRole(null);
        setClaimsReady(true);
        setLoading(false);
        return;
      }
      const token = await nextUser.getIdTokenResult();
      const claimed = token.claims.role;
      setRole(claimed === "nurse" || claimed === "pharmacy" ? claimed : null);
      setClaimsReady(true);
      setLoading(false);
    });
    return unsub;
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, role, claimsReady, loading }),
    [user, role, claimsReady, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
