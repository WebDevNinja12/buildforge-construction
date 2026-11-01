export default function AdminSettingsPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-construction-dark">Settings</h1>
      <p className="text-sm text-slate-500">
        Configure required document types per category, installment rules, payment frequencies, cancellation
        percentages, and default reservation durations. Defaults are applied automatically when no DB override
        exists; category defaults are stored in CategoryDefault and RequiredDocumentType tables.
      </p>
      <ul className="text-sm list-disc pl-5 text-slate-600 space-y-1">
        <li>House hold default: 14 days</li>
        <li>Hotel: 7 days · Land: 5 days · Tools: 48h · Workers: 12h</li>
        <li>Installment required documents load from defaults until you seed RequiredDocumentType rows</li>
      </ul>
    </div>
  );
}
