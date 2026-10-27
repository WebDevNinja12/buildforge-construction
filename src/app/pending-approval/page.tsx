import Link from "next/link";
import { Clock, Shield } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PendingApprovalPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN" || session.status === "APPROVED") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-construction-dark">Pending approval</h1>
        <p className="mt-3 text-construction-gray text-sm leading-relaxed">
          Thanks for registering, <strong>{session.name}</strong>. An admin will review your account.
          If no action is taken within <strong>12 hours</strong>, the system will grant access automatically.
        </p>
        <div className="mt-6 p-4 bg-slate-50 rounded-xl text-left text-sm text-slate-600 space-y-2">
          <p className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary-600" /> Full dashboard access unlocks after approval.</p>
          <p>You can still browse public pages (Home, About, Services listings, Contact).</p>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/" className="bg-primary-600 text-white font-semibold py-2.5 rounded-xl hover:bg-primary-700">
            Back to home
          </Link>
          <Link href="/dashboard" className="text-sm text-primary-600 hover:underline">
            Check approval status
          </Link>
        </div>
      </div>
    </div>
  );
}
