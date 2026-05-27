import { redirect } from "next/navigation";
import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";
import { roleHasCapability } from "@/lib/auth/capabilities";
import { ImpersonationPanel } from "@/components/admin/impersonation-panel";

export const dynamic = "force-dynamic";

export default async function ImpersonarPage() {
  const snapshot = await getAuthSnapshot();

  if (snapshot.status !== "active" || !roleHasCapability(snapshot.profile.role, "impersonate")) {
    redirect("/");
  }

  return <ImpersonationPanel currentUserId={snapshot.user.id} />;
}
