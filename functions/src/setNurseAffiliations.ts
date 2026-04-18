import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();

type Action = "add" | "remove";
type Payload = { nurseUid: string; action: Action };

export const setNurseAffiliations = onCall<Payload>(async (request) => {
  const caller = request.auth;
  if (!caller) {
    throw new HttpsError("unauthenticated", "Sign-in required.");
  }
  if (caller.token.role !== "pharmacy") {
    throw new HttpsError("permission-denied", "Only pharmacy admins can manage nurse affiliations.");
  }

  const callerPharmacyId = caller.token.pharmacyId;
  if (typeof callerPharmacyId !== "string" || !callerPharmacyId) {
    throw new HttpsError(
      "failed-precondition",
      "Caller is missing pharmacyId claim.",
    );
  }

  const { nurseUid, action } = request.data ?? {};
  if (typeof nurseUid !== "string" || !nurseUid) {
    throw new HttpsError("invalid-argument", "nurseUid is required.");
  }
  if (action !== "add" && action !== "remove") {
    throw new HttpsError("invalid-argument", "action must be 'add' or 'remove'.");
  }

  // Verify the target user is actually a nurse.
  const nurse = await getAuth().getUser(nurseUid);
  if (nurse.customClaims?.role !== "nurse") {
    throw new HttpsError("failed-precondition", "Target user is not a nurse.");
  }

  // Caller may only mutate THEIR pharmacy's entry in the affiliation list.
  const ref = getFirestore().doc(`nurseAffiliations/${nurseUid}`);
  const update =
    action === "add"
      ? {
          nurseId: nurseUid,
          pharmacyIds: FieldValue.arrayUnion(callerPharmacyId),
          updatedAt: FieldValue.serverTimestamp(),
        }
      : {
          nurseId: nurseUid,
          pharmacyIds: FieldValue.arrayRemove(callerPharmacyId),
          updatedAt: FieldValue.serverTimestamp(),
        };
  await ref.set(update, { merge: true });

  return { ok: true, nurseUid, action, pharmacyId: callerPharmacyId };
});
