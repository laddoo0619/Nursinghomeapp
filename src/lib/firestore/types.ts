import type { Timestamp } from "firebase/firestore";

export type Role = "nurse" | "pharmacy";

export type UserDoc = {
  email: string;
  displayName: string;
  role: Role;
  pharmacyId?: string;
  createdAt: Timestamp;
};

export type Pharmacy = {
  name: string;
  address: string;
  createdAt: Timestamp;
};

export type NurseAffiliation = {
  nurseId: string;
  pharmacyIds: string[];
  updatedAt: Timestamp;
};

export type Medication = {
  id: string;
  name: string;
  dose: string;
  schedule: string;
};

export type MonitoringFlags = {
  requires_bg: boolean;
  requires_bp: boolean;
  requires_insulin: boolean;
  requires_meds: boolean;
};

export type Patient = {
  pharmacyId: string;
  firstName: string;
  lastName: string;
  dob: string;
  address: string;
  phone: string;
  monitoring: MonitoringFlags;
  medications: Medication[];
  active: boolean;
  createdAt: Timestamp;
  createdBy: string;
};

export type VisitStatus = "scheduled" | "in_progress" | "completed" | "missed";

export type Visit = {
  pharmacyId: string;
  patientId: string;
  nurseId: string;
  scheduledDate: Timestamp;
  completedAt?: Timestamp;
  status: VisitStatus;
  signatureUrl?: string;
  notes: string;
  createdAt: Timestamp;
};

export type LogType = "vitals" | "medication" | "concern";

export type VitalsData = {
  bpSystolic?: number;
  bpDiastolic?: number;
  bloodGlucose?: number;
  insulinUnits?: number;
};

export type MedicationLogData = {
  medicationId: string;
  medicationName: string;
  taken: boolean;
  reasonNotTaken?: string;
  scheduledTime: string;
};

export type ConcernData = {
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Timestamp;
};

export type LogData = VitalsData | MedicationLogData | ConcernData;

export type LogEntry =
  | {
      pharmacyId: string;
      visitId: string;
      patientId: string;
      nurseId: string;
      type: "vitals";
      createdAt: Timestamp;
      data: VitalsData;
    }
  | {
      pharmacyId: string;
      visitId: string;
      patientId: string;
      nurseId: string;
      type: "medication";
      createdAt: Timestamp;
      data: MedicationLogData;
    }
  | {
      pharmacyId: string;
      visitId: string;
      patientId: string;
      nurseId: string;
      type: "concern";
      createdAt: Timestamp;
      data: ConcernData;
    };
