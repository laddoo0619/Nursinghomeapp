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

  const { uid, role } = request.data ?? {};
  if (typeof uid !== "string" || !uid) {
    throw new HttpsError("invalid-argument", "uid is required.");
  }
  if (!isRole(role)) {
    throw new HttpsError("invalid-argument", "role must be 'nurse' or 'pharmacy'.");
  }

  const auth = getAuth();
  const user = await auth.getUser(uid);

  // Preserve any unrelated claims the user already has.
  const nextClaims = { ...(user.customClaims ?? {}), role };
  await auth.setCustomUserClaims(uid, nextClaims);

  // Mirror to users/{uid} for UI use. Rules never trust this field.
  await getFirestore()
    .doc(`users/${uid}`)
    .set(
      {
        email: user.email ?? "",
        displayName: user.displayName ?? "",
        role,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  return { ok: true, uid, role };
});
