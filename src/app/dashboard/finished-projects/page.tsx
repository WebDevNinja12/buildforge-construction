import { redirect } from "next/navigation";

/** Finished projects are managed by admin only. Clients view the public gallery. */
export default function FinishedProjectsUserRedirect() {
  redirect("/projects");
}
