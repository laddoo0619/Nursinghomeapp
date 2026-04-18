import { createContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import { auth } from "../firebase";
import { nurseAffiliationDoc } from "../firestore/converters";

export type Role = "nurse" | "pharmacy";

export type AuthState = {
  user: User | null;
  role: Role | null;
  pharmacyId: string | null;
  affiliatedPharmacyIds: string[];
  claimsReady: boolean;
  loading: boolean;
};

export const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  pharmacyId: null,
  affiliatedPharmacyIds: [],
  claimsReady: false,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [affiliatedPharmacyIds, setAffiliatedPharmacyIds] = useState<string[]>([]);
  const [claimsReady, setClaimsReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onIdTokenChanged fires on sign-in, sign-out, AND token refresh — so
    // updated custom claims propagate without a reload.
    const unsub = onIdTokenChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setRole(null);
        setPharmacyId(null);
        setAffiliatedPharmacyIds([]);
        setClaimsReady(true);
        setLoading(false);
        return;
      }
      const token = await nextUser.getIdTokenResult();
      const claimedRole = token.claims.role;
      const claimedPharmacy = token.claims.pharmacyId;
      const nextRole =
        claimedRole === "nurse" || claimedRole === "pharmacy" ? claimedRole : null;
      setRole(nextRole);
      setPharmacyId(typeof claimedPharmacy === "string" ? claimedPharmacy : null);

      if (nextRole === "nurse") {
        try {
          const snap = await getDoc(nurseAffiliationDoc(nextUser.uid));
          setAffiliatedPharmacyIds(snap.exists() ? snap.data().pharmacyIds ?? [] : []);
        } catch {
          setAffiliatedPharmacyIds([]);
        }
      } else {
        setAffiliatedPharmacyIds([]);
      }

      setClaimsReady(true);
      setLoading(false);
    });
    return unsub;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      role,
      pharmacyId,
      affiliatedPharmacyIds,
      claimsReady,
      loading,
    }),
    [user, role, pharmacyId, affiliatedPharmacyIds, claimsReady, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
