import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();

type Role = "nurse" | "pharmacy";
type Payload = { uid: string; role: Role };

function isRole(value: unknown): value is Role {
  return value === "nurse" || value === "pharmacy";
}

export const setUserRole = onCall<Payload>(async (request) => {
  const caller = request.auth;
  if (!caller) {
    throw new HttpsError("unauthenticated", "Sign-in required.");
  }
  if (caller.token.role !== "pharmacy") {
    throw new HttpsError("permission-denied", "Only pharmacy admins can assign roles.");
  }

  const callerPharmacyId = caller.token.pharmacyId;
  if (typeof callerPharmacyId !== "string" || !callerPharmacyId) {
    throw new HttpsError(
      "failed-precondition",
      "Caller is missing pharmacyId claim. Bootstrap or migrate this account.",
    );
  }

  const { uid, role } = request.data ?? {};
  if (typeof uid !== "string" || !uid) {
    throw new HttpsError("invalid-argument", "uid is required.");
  }
  if (!isRole(role)) {
    throw new HttpsError("invalid-argument", "role must be 'nurse' or 'pharmacy'.");
  }

  const auth = getAuth();
  const user = await auth.getUser(uid);

  // Pharmacy admins can only assign roles within their own pharmacy.
  // Block re-roling a user already bound to a different pharmacy.
  const existingPharmacyId = (user.customClaims ?? {}).pharmacyId;
  if (
    typeof existingPharmacyId === "string" &&
    existingPharmacyId &&
    existingPharmacyId !== callerPharmacyId
  ) {
    throw new HttpsError(
      "permission-denied",
      "Cannot modify a user that belongs to another pharmacy.",
    );
  }

  // Pharmacy role inherits caller's pharmacyId (single-pharmacy scope per admin).
  // Nurse role gets no pharmacyId claim — affiliations live in nurseAffiliations/{uid}.
  const baseClaims = { ...(user.customClaims ?? {}) };
  if (role === "pharmacy") {
    baseClaims.role = "pharmacy";
    baseClaims.pharmacyId = callerPharmacyId;
  } else {
    baseClaims.role = "nurse";
    delete baseClaims.pharmacyId;
  }
  await auth.setCustomUserClaims(uid, baseClaims);

  // Mirror to users/{uid} for UI use. Rules never trust this field.
  const mirror: Record<string, unknown> = {
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    role,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (role === "pharmacy") {
    mirror.pharmacyId = callerPharmacyId;
  } else {
    mirror.pharmacyId = FieldValue.delete();
  }
  await getFirestore().doc(`users/${uid}`).set(mirror, { merge: true });

  return { ok: true, uid, role, pharmacyId: role === "pharmacy" ? callerPharmacyId : null };
});
