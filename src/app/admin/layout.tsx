import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const path = h.get("x-pathname") || h.get("x-invoke-path") || "";
  // login page renders without shell (handled below when no session)
  const session = await getSession();

  // Allow login page without admin session — detected by missing session on login path via children only
  // Next.js doesn't expose path reliably here; login page is public and doesn't use this shell when we split.
  // Fallback: if not admin, only allow through when no session (login form will show on /admin/login).
  if (!session) {
    return <>{children}</>;
  }
  if (session.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <AdminShell name={session.name}>{children}</AdminShell>;
}
