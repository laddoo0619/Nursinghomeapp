import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

export function ForbiddenPage() {
  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-semibold">No access</h1>
        <p className="text-slate-600">
          Your account does not have a role assigned yet. Contact a pharmacy administrator.
        </p>
        <button
          onClick={() => signOut(auth)}
          className="bg-slate-800 text-white rounded px-3 py-2"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
