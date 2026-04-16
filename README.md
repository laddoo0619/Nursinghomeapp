# Nursing Home Tracking Software

React + Firebase app with two RBAC-gated portals:

- **Nursing Portal** (mobile-first) — per-visit vitals, medication checklist, concerns, signature capture.
- **Pharmacy Admin Portal** (desktop) — patient CRUD, real-time dashboard, PDF/CSV reports.

This repository currently contains **Phase A** (data layer + auth scaffold).
Portal UIs land in **Phase B** once the schema and rules are approved.

Firebase project: `nursing-home-software-bynd`.

## Firestore schema

Flat collections so reports and dashboards query with simple composite indexes.

### `users/{uid}`
```ts
{ email, displayName, role: 'nurse' | 'pharmacy', createdAt }
```
`role` mirrors the custom claim for UI. **Security rules never trust this
field** — they read `request.auth.token.role`.

### `patients/{patientId}`
```ts
{
  firstName, lastName, dob, address, phone,
  monitoring: { requires_bg, requires_bp, requires_insulin, requires_meds },
  medications: [{ id, name, dose, schedule }],  // inline — small N, history lives in logs
  active, createdAt, createdBy
}
```

### `visits/{visitId}`
```ts
{
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
Denormalized top-level fields (`visitId`, `patientId`, `nurseId`, `type`,
`createdAt`) keep indexes small; variant-only fields live in `data`.
```ts
{ visitId, patientId, nurseId, type, createdAt, data }
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

| Collection | Nurse | Pharmacy |
| ---------- | ----- | -------- |
| `users/{uid}` | read own doc | read all |
| `patients/*` | read | read / write |
| `visits/*`   | read own; update limited fields on own visits | full |
| `logs/*`     | read own; create with `nurseId == auth.uid` | read all; update (acknowledge) |

Deletes are blocked from the client on `logs` and `users`. Role writes happen
only via the `setUserRole` Cloud Function (Admin SDK).

Storage: `signatures/{visitId}.png` — nurse write if they own the visit,
< 1 MB, `image/png`. Pharmacy read all; nurse read own.

## Composite indexes (`firestore.indexes.json`)

- `logs`: `(patientId↑, createdAt↓)`, `(patientId↑, type↑, createdAt↓)`,
  `(type↑, createdAt↓)`, `(nurseId↑, createdAt↓)`
- `visits`: `(nurseId↑, scheduledDate↑)`, `(patientId↑, scheduledDate↓)`,
  `(status↑, scheduledDate↑)`
- `patients`: `(active↑, lastName↑)`

## Custom claims flow

1. Pharmacy admin calls `setUserRole({ uid, role })` (callable).
2. Function sets the custom claim and mirrors `users/{uid}.role`.
3. On the client, the `AuthProvider` listens with `onIdTokenChanged` so
   refreshed claims hydrate the role context without a reload.
4. After an out-of-band role change, the client can force a refresh via
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
functions/src/setUserRole.ts
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

## Bootstrapping the first pharmacy user

The `setUserRole` callable requires an existing pharmacy caller, so the very
first pharmacy account must be provisioned out of band:

```bash
# from a trusted machine with a service-account key
node -e "require('firebase-admin').initializeApp(); \
  require('firebase-admin').auth().setCustomUserClaims('<uid>', { role: 'pharmacy' })"
```

After that, pharmacy admins can assign `nurse` / `pharmacy` roles from the
Pharmacy → Users page (shipped in Phase B).

## Next: Phase B

- Nursing Portal: `/nurse/today`, vitals form, med checklist, concern form,
  signature capture → Cloud Storage → `visit.signatureUrl`.
- Pharmacy Portal: live dashboard (`onSnapshot` on today's logs), patient CRUD,
  report builder (jsPDF + CSV), users page invoking `setUserRole`.
