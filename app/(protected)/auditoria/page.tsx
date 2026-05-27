import { redirect } from "next/navigation";
import { AuditEventsView } from "@/components/audit/audit-events-view";
import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";
import { canAccessAudit } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const snapshot = await getAuthSnapshot();

  if (!canAccessAudit(snapshot)) {
    redirect("/");
  }

  return <AuditEventsView />;
}
