# Nursing Home Tracking Software

React + Firebase app with two RBAC-gated portals:

- **Nursing Portal** (mobile-first) — per-visit vitals, medication checklist, concerns, signature capture.
- **Pharmacy Admin Portal** (desktop) — patient CRUD, real-time dashboard, PDF/CSV reports.

This repository currently contains **Phase A** (data layer + auth scaffold).
Portal UIs land in **Phase B** once the schema and rules are approved.

**Multi-tenant**: the app supports multiple pharmacy locations
(e.g. Beyond Pharmacy Surrey + Abbotsford). Each pharmacy admin sees only
their own patients/visits/logs. Nurses can be affiliated with one or more
pharmacies via the `nurseAffiliations/{nurseId}` doc, so a single nurse can
receive visits from any of their affiliated stores.

Firebase project: `nursing-home-software-bynd`.

## Firestore schema

Flat collections so reports and dashboards query with simple composite indexes.

### `users/{uid}`
```ts
{ email, displayName, role: 'nurse' | 'pharmacy', pharmacyId?, createdAt }
```
`role` and `pharmacyId` mirror custom claims for UI. **Security rules never
trust these fields** — they read `request.auth.token.role` and
`request.auth.token.pharmacyId`.

### `pharmacies/{pharmacyId}`
```ts
{ name, address, createdAt }
```
Pharmacy directory. Read by any signed-in user; written only via Admin SDK.

### `nurseAffiliations/{nurseUid}`
```ts
{ nurseId, pharmacyIds: string[], updatedAt }
```
Lists which pharmacies a nurse is allowed to receive visits from. Server-managed
via the `setNurseAffiliations` callable — pharmacy admins can only add/remove
**their own** `pharmacyId` from this list.

### `patients/{patientId}`
```ts
{
  pharmacyId,                                   // tenant-scope
  firstName, lastName, dob, address, phone,
  monitoring: { requires_bg, requires_bp, requires_insulin, requires_meds },
  medications: [{ id, name, dose, schedule }],  // inline — small N, history lives in logs
  active, createdAt, createdBy
}
```

### `visits/{visitId}`
```ts
{
  pharmacyId,                                   // tenant-scope
  patientId, nurseId,
  scheduledDate, completedAt?,
  status: 'scheduled' | 'in_progress' | 'completed' | 'missed',
  signatureUrl?,      // Cloud Storage download URL
  notes, createdAt
}
```
Pharmacy schedules visits in advance; nurses only update
`status`/`signatureUrl`/`completedAt`/`notes` on their own visits.

### `logs/{logId}` — unified, discriminated by `type`
Denormalized top-level fields (`pharmacyId`, `visitId`, `patientId`, `nurseId`,
`type`, `createdAt`) keep indexes small; variant-only fields live in `data`.
```ts
{ pharmacyId, visitId, patientId, nurseId, type, createdAt, data }
```
| `type`        | `data` shape                                                                    |
| ------------- | ------------------------------------------------------------------------------- |
| `vitals`      | `{ bpSystolic, bpDiastolic, bloodGlucose, insulinUnits }`                        |
| `medication`  | `{ medicationId, medicationName, taken, reasonNotTaken?, scheduledTime }`        |
| `concern`     | `{ message, acknowledged, acknowledgedBy?, acknowledgedAt? }`                    |

**Why one collection:** the pharmacy dashboard uses a single `onSnapshot`
across today's logs; reports run per-patient date-range queries. Splitting
would force three listeners and three index sets.

## Security rules (summary)

All non-user collections enforce **pharmacy-scoped isolation** via
`pharmacyId == request.auth.token.pharmacyId` for pharmacy admins, and via
`nurseAffiliated(resource.data.pharmacyId)` for nurses.

| Collection | Nurse | Pharmacy |
| ---------- | ----- | -------- |
| `users/{uid}` | read own doc | read users in same pharmacy |
| `pharmacies/*` | read | read |
| `nurseAffiliations/*` | read own | read all |
| `patients/*` | read (if affiliated with patient's pharmacy) | read / write own pharmacy only |
| `visits/*`   | read own + affiliated; update limited fields | full within own pharmacy |
| `logs/*`     | read own + affiliated; create with `nurseId == auth.uid` + affiliation | read / acknowledge own pharmacy only |

Deletes are blocked from the client on `logs`, `users`, `pharmacies`, and
`nurseAffiliations`. Role writes happen only via the `setUserRole` Cloud
Function; affiliation writes only via `setNurseAffiliations`.

Storage: `signatures/{visitId}.png` — nurse write if they own the visit,
< 1 MB, `image/png`. Pharmacy read all; nurse read own.

## Composite indexes (`firestore.indexes.json`)

All multi-tenant queries lead with `pharmacyId`:

- `logs`: `(pharmacyId↑, patientId↑, createdAt↓)`,
  `(pharmacyId↑, patientId↑, type↑, createdAt↓)`,
  `(pharmacyId↑, type↑, createdAt↓)`, `(nurseId↑, createdAt↓)`
- `visits`: `(pharmacyId↑, nurseId↑, scheduledDate↑)`,
  `(nurseId↑, scheduledDate↑)` (for nurse cross-pharmacy view),
  `(pharmacyId↑, patientId↑, scheduledDate↓)`,
  `(pharmacyId↑, status↑, scheduledDate↑)`
- `patients`: `(pharmacyId↑, active↑, lastName↑)`

## Custom claims flow

1. Pharmacy admin calls `setUserRole({ uid, role })` (callable).
2. Function sets `{ role, pharmacyId }` custom claims (`pharmacyId` is
   inherited from the caller — admins can only assign within their own
   pharmacy) and mirrors them to `users/{uid}`.
3. To affiliate a nurse with their pharmacy, an admin calls
   `setNurseAffiliations({ nurseUid, action: 'add' | 'remove' })`. Each
   pharmacy can only mutate its own entry in `nurseAffiliations/{uid}.pharmacyIds`.
4. On the client, the `AuthProvider` listens with `onIdTokenChanged` so
   refreshed claims hydrate `role` + `pharmacyId` without a reload, and
   loads `affiliatedPharmacyIds` for nurses on each sign-in.
5. After an out-of-band role change, the client can force a refresh via
   `auth.currentUser.getIdToken(true)`.

## Project layout

```
src/
  lib/
    firebase.ts
    auth/{AuthProvider,useAuth}
    rbac/RequireRole
    firestore/{types,converters}
  pages/{Login,Forbidden}
  App.tsx
  main.tsx
functions/src/{setUserRole,setNurseAffiliations}.ts
scripts/bootstrap-pharmacies.ts
firestore.rules
firestore.indexes.json
storage.rules
firebase.json
.firebaserc
```

## Local setup

```bash
npm install
cd functions && npm install && cd ..
npm run typecheck
npm run dev            # http://localhost:5173
```

## Deploying rules / indexes / functions

```bash
firebase login
firebase deploy --only firestore:rules,firestore:indexes,storage --project nursing-home-software-bynd
firebase deploy --only functions --project nursing-home-software-bynd
```

## Bootstrapping the two pharmacies

Run once per environment to create the Surrey + Abbotsford accounts, set
their `pharmacyId` claims, and seed `pharmacies/{id}` docs:

```bash
# from a trusted machine with a service-account key
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
SURREY_PW='…' ABBOTSFORD_PW='…' \
npx tsx scripts/bootstrap-pharmacies.ts
```

The script is idempotent: existing auth users are reused and claims are
re-applied. Affected accounts must sign out and back in for the new claims
to take effect on the client.

To run against the emulator instead:

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 \
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
GCLOUD_PROJECT=nursing-home-software-bynd \
SURREY_PW='dev' ABBOTSFORD_PW='dev' \
npx tsx scripts/bootstrap-pharmacies.ts
```

After bootstrap, each pharmacy admin can assign `nurse` / `pharmacy` roles
within their own pharmacy from the Pharmacy → Users page (shipped in
Phase B), and add/remove nurses from their roster via the
`setNurseAffiliations` callable.

## Next: Phase B

- Nursing Portal: `/nurse/today`, vitals form, med checklist, concern form,
  signature capture → Cloud Storage → `visit.signatureUrl`.
- Pharmacy Portal: live dashboard (`onSnapshot` on today's logs), patient CRUD,
  report builder (jsPDF + CSV), users page invoking `setUserRole`.
