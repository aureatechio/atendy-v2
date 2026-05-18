import { redirect } from "next/navigation";
import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";
import { canAccessAdmin } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const snapshot = await getAuthSnapshot();

  if (!canAccessAdmin(snapshot)) {
    redirect("/");
  }

  return <>{children}</>;
}
