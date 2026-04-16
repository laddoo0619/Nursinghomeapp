import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyDRzTH2QPeTsYjujmHPCM_wnvbRS0KN1LM",
  authDomain: "nursing-home-software-bynd.firebaseapp.com",
  projectId: "nursing-home-software-bynd",
  storageBucket: "nursing-home-software-bynd.firebasestorage.app",
  messagingSenderId: "654149117461",
  appId: "1:654149117461:web:416a68ddd936490792d01c",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
