import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { DEFAULT_ADMIN_EMAIL } from "@/lib/auth";

export type AdminActivityInput = {
  adminId: string;
  adminEmail?: string | null;
  adminName?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  details?: string | Record<string, unknown> | null;
  /** Extra inboxes (e.g. client affected) */
  alsoNotifyEmails?: string[];
};

function notifyInbox(): string {
  return (
    process.env.ADMIN_NOTIFY_EMAIL ||
    process.env.ADMIN_EMAIL ||
    DEFAULT_ADMIN_EMAIL
  )
    .trim()
    .toLowerCase();
}

function detailsText(details?: string | Record<string, unknown> | null): string {
  if (details == null) return "";
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

/**
 * Record admin panel action: DB activity log + in-app notification + email.
 * Never throws — failures are logged only so admin flows keep working.
 */
export async function recordAdminActivity(input: AdminActivityInput): Promise<void> {
  const detailsStr = detailsText(input.details);
  const when = new Date().toISOString();

  try {
    await prisma.adminActivityLog.create({
      data: {
        adminId: input.adminId,
        action: input.action,
        entity: input.entity || null,
        entityId: input.entityId || null,
        details: detailsStr || null,
      },
    });
  } catch (e) {
    console.error("[admin-activity:log]", e);
  }

  const title = `Admin: ${input.action}`;
  const body = [
    input.adminName || input.adminEmail || "Admin",
    input.entity ? `on ${input.entity}` : "",
    input.entityId ? `(${input.entityId})` : "",
    detailsStr ? `— ${detailsStr.slice(0, 280)}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // In-app notification for the acting admin
  try {
    await prisma.notification.create({
      data: {
        userId: input.adminId,
        title,
        body: body.slice(0, 500),
        type: "ADMIN_ACTIVITY",
      },
    });
  } catch (e) {
    console.error("[admin-activity:notify]", e);
  }

  const to = new Set<string>();
  const primary = notifyInbox();
  if (primary.includes("@")) to.add(primary);
  if (input.adminEmail && input.adminEmail.includes("@")) to.add(input.adminEmail.toLowerCase());
  for (const e of input.alsoNotifyEmails || []) {
    if (e && e.includes("@")) to.add(e.trim().toLowerCase());
  }

  const subject = `[Hama Construction] ${input.action}${input.entity ? ` — ${input.entity}` : ""}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#0f172a">Admin activity</h2>
      <p><strong>Action:</strong> ${escapeHtml(input.action)}</p>
      <p><strong>Admin:</strong> ${escapeHtml(input.adminName || "")} &lt;${escapeHtml(input.adminEmail || "")}&gt;</p>
      ${input.entity ? `<p><strong>Entity:</strong> ${escapeHtml(input.entity)} ${input.entityId ? `(${escapeHtml(input.entityId)})` : ""}</p>` : ""}
      ${detailsStr ? `<pre style="background:#f8fafc;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap">${escapeHtml(detailsStr)}</pre>` : ""}
      <p style="color:#64748b;font-size:12px">Time: ${when}</p>
      <p style="color:#64748b;font-size:12px">Hama Construction — Building innovation through quality and trust.</p>
    </div>`;
  const text = `Admin activity: ${input.action}\nAdmin: ${input.adminEmail}\nEntity: ${input.entity || "-"} ${input.entityId || ""}\n${detailsStr}\n${when}`;

  for (const recipient of to) {
    try {
      await sendEmail({ to: recipient, subject, html, text });
    } catch (e) {
      console.error("[admin-activity:email]", recipient, e);
    }
  }
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
