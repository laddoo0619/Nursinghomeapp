import {
  collection,
  doc,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import type { LogEntry, Patient, UserDoc, Visit } from "./types";

function makeConverter<T extends DocumentData>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (value: T) => value,
    fromFirestore: (snap: QueryDocumentSnapshot) => snap.data() as T,
  };
}

export const userConverter = makeConverter<UserDoc>();
export const patientConverter = makeConverter<Patient>();
export const visitConverter = makeConverter<Visit>();
export const logConverter = makeConverter<LogEntry>();

export const usersCol = () => collection(db, "users").withConverter(userConverter);
export const userDoc = (uid: string) => doc(db, "users", uid).withConverter(userConverter);

export const patientsCol = () => collection(db, "patients").withConverter(patientConverter);
export const patientDoc = (id: string) => doc(db, "patients", id).withConverter(patientConverter);

export const visitsCol = () => collection(db, "visits").withConverter(visitConverter);
export const visitDoc = (id: string) => doc(db, "visits", id).withConverter(visitConverter);

export const logsCol = () => collection(db, "logs").withConverter(logConverter);
export const logDoc = (id: string) => doc(db, "logs", id).withConverter(logConverter);
