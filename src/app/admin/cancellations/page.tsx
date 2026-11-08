import Link from "next/link";

export default function AdminCancellationsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Cancellations & refunds</h1>
      <p className="text-sm text-slate-500 max-w-2xl">
        Clients can cancel their own plans from the dashboard plan card. Admins can cancel any active
        plan from{" "}
        <Link href="/admin/reservations" className="text-primary-700 font-semibold underline">
          Reservations
        </Link>{" "}
        or{" "}
        <Link href="/admin/installments" className="text-primary-700 font-semibold underline">
          Installments
        </Link>
        . Cancelled items show status CANCELLED. Process refunds from Payments and review the activity
        log for deducted percentages. Category cancellation fees are set under Settings.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Link
          href="/admin/reservations"
          className="bg-white border rounded-2xl p-4 shadow-sm hover:border-primary-300"
        >
          <p className="font-semibold text-construction-dark">Cancel a reservation / plan</p>
          <p className="text-xs text-slate-500 mt-1">Accept holds or cancel pending & confirmed plans</p>
        </Link>
        <Link
          href="/admin/installments"
          className="bg-white border rounded-2xl p-4 shadow-sm hover:border-primary-300"
        >
          <p className="font-semibold text-construction-dark">Cancel an installment plan</p>
          <p className="text-xs text-slate-500 mt-1">Open installment list and use Cancel plan</p>
        </Link>
      </div>
    </div>
  );
}
