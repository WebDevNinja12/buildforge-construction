import { AdminToolsClient } from "./ToolsClient";

export const dynamic = "force-dynamic";

export default function AdminToolsPage() {
  return (
    <div className="space-y-4">
      <AdminToolsClient />
    </div>
  );
}
