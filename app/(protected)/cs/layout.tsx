import { redirect } from "next/navigation";
import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";
import { canAccessCS } from "@/lib/auth/guards";

export default async function CsLayout({ children }: { children: React.ReactNode }) {
  const snapshot = await getAuthSnapshot();

  if (!canAccessCS(snapshot)) {
    redirect("/");
  }

  return <>{children}</>;
}
