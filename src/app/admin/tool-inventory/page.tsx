import { AdminToolsClient } from "../tools/ToolsClient";

export const dynamic = "force-dynamic";

/** Alias of /admin/tools in case that segment fails to register. */
export default function AdminToolInventoryPage() {
  return (
    <div className="space-y-4">
      <AdminToolsClient />
    </div>
  );
}
