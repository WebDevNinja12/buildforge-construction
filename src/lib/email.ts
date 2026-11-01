/**
 * Optional email via Resend (RESEND_API_KEY).
 * Falls back to console log when not configured — never blocks app flows.
 */

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    "Hama Construction <onboarding@resend.dev>";

  if (!key) {
    console.log("[email:skipped]", opts.to, opts.subject);
    return { ok: false, skipped: true as const };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[email:fail]", res.status, t);
      return { ok: false, error: t };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email:error]", e);
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

export function quoteReceivedHtml(name: string) {
  return `<p>Hi ${name},</p>
<p>Thank you for requesting a quote from <strong>Hama Construction</strong>.</p>
<p>Our team will review your project details and contact you shortly.</p>
<p><em>Building innovation through quality and trust.</em></p>`;
}

export function contactReceivedHtml(name: string) {
  return `<p>Hi ${name},</p>
<p>We received your message and will respond as soon as possible.</p>
<p>— Hama Construction</p>`;
}
