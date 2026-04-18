/**
 * One-time bootstrap for the two Beyond Pharmacy locations.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *   SURREY_PW='…' ABBOTSFORD_PW='…' \
 *   npx tsx scripts/bootstrap-pharmacies.ts
 *
 * Idempotent: safe to re-run. Existing auth users are reused; pharmacy docs are
 * upserted; custom claims are reset to the canonical pharmacy/role pair.
 *
 * Pointing at the Firebase emulator? Set:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
 *   GCLOUD_PROJECT=nursing-home-software-bynd
 */

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

type PharmacyConfig = {
  id: string;
  email: string;
  displayName: string;
  pharmacyName: string;
  address: string;
  passwordEnv: string;
};

const PHARMACIES: PharmacyConfig[] = [
  {
    id: "surrey",
    email: "info@beyondpharmacy.com",
    displayName: "Beyond Pharmacy Surrey",
    pharmacyName: "Beyond Pharmacy Surrey",
    address: "Surrey, BC",
    passwordEnv: "SURREY_PW",
  },
  {
    id: "abbotsford",
    email: "abby@beyondpharmacy.com",
    displayName: "Beyond Pharmacy Abbotsford",
    pharmacyName: "Beyond Pharmacy Abbotsford",
    address: "Abbotsford, BC",
    passwordEnv: "ABBOTSFORD_PW",
  },
];

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault() });
}

async function ensureAuthUser(cfg: PharmacyConfig): Promise<UserRecord> {
  const auth = getAuth();
  const password = process.env[cfg.passwordEnv];
  try {
    const existing = await auth.getUserByEmail(cfg.email);
    if (password) {
      await auth.updateUser(existing.uid, { password, displayName: cfg.displayName });
    }
    return existing;
  } catch (err: unknown) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
    if (!password) {
      throw new Error(
        `${cfg.email} does not exist yet — set ${cfg.passwordEnv} to create it.`,
      );
    }
    return auth.createUser({
      email: cfg.email,
      password,
      displayName: cfg.displayName,
      emailVerified: true,
    });
  }
}

async function bootstrapOne(cfg: PharmacyConfig): Promise<void> {
  const fs = getFirestore();
  const auth = getAuth();

  const user = await ensureAuthUser(cfg);

  const claims = {
    ...(user.customClaims ?? {}),
    role: "pharmacy" as const,
    pharmacyId: cfg.id,
  };
  await auth.setCustomUserClaims(user.uid, claims);

  await fs.doc(`pharmacies/${cfg.id}`).set(
    {
      name: cfg.pharmacyName,
      address: cfg.address,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await fs.doc(`users/${user.uid}`).set(
    {
      email: cfg.email,
      displayName: cfg.displayName,
      role: "pharmacy",
      pharmacyId: cfg.id,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(`✓ ${cfg.id} → uid=${user.uid} email=${cfg.email}`);
}

async function main(): Promise<void> {
  for (const cfg of PHARMACIES) {
    await bootstrapOne(cfg);
  }
  console.log("\nBootstrap complete. Affected accounts must sign out & in for new claims to take effect.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
