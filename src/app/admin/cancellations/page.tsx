export default function AdminCancellationsPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-construction-dark">Cancellations & refunds</h1>
      <p className="text-sm text-slate-500">
        Cancelled reservations appear under Reservations with status CANCELLED. Process refunds from Payments
        (reject/approve proof) and record deducted percentages in the activity log. Category cancellation
        percentages are configured under Settings.
      </p>
    </div>
  );
}
