import { NextResponse } from "next/server";

/** Simple downloadable installment agreement template (HTML printable as PDF) */
export async function GET() {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Hama Construction — Installment Agreement</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#0f172a;line-height:1.5}
  h1{font-size:1.4rem} h2{font-size:1.1rem;margin-top:1.5rem}
  .muted{color:#64748b;font-size:.9rem}
  .sign{margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:32px}
  .line{border-bottom:1px solid #94a3b8;height:40px;margin-top:24px}
</style></head><body>
  <p class="muted">Hama Construction · Building innovation through quality and trust</p>
  <h1>Installment Payment Agreement (Template)</h1>
  <p>This template is for the client to complete, sign, and upload under Installment Documents.</p>
  <h2>1. Parties</h2>
  <p>Client name: _______________________________</p>
  <p>Email / phone: _______________________________</p>
  <p>Provider: Hama Construction</p>
  <h2>2. Property / service</h2>
  <p>Description: _______________________________</p>
  <p>Total price: _______________________________</p>
  <h2>3. Payment terms</h2>
  <p>Deposit: __________ &nbsp; Frequency: __________ &nbsp; Plan deadline: __________</p>
  <p>The client agrees to pay each installment on or before the due date. Late payments may incur the category grace rules and cancellation deductions published on the platform.</p>
  <h2>4. Documents</h2>
  <p>The client confirms that all supporting documents submitted are true and accurate.</p>
  <h2>5. Cancellation</h2>
  <p>Cancellation may attract a deduction percentage set by category and stage of the plan.</p>
  <div class="sign">
    <div><p>Client signature</p><div class="line"></div><p class="muted">Date</p><div class="line"></div></div>
    <div><p>Hama Construction</p><div class="line"></div><p class="muted">Date</p><div class="line"></div></div>
  </div>
  <p class="muted" style="margin-top:48px">Print or save as PDF, sign, then upload as "Signed installment agreement".</p>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hama-installment-agreement.html"',
    },
  });
}
