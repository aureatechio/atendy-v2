import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";
import { canAccessCS } from "@/lib/auth/guards";
import { CsSidebar } from "@/components/layout/cs-sidebar";

export default async function CsLayout({ children }: { children: React.ReactNode }) {
  const [snapshot, cookieStore] = await Promise.all([getAuthSnapshot(), cookies()]);

  if (!canAccessCS(snapshot)) {
    redirect("/");
  }

  const csSidebarCollapsed = cookieStore.get("sidebar:cs")?.value === "collapsed";

  return (
    <div className="cs-shell" data-sidebar-collapsed={csSidebarCollapsed ? "true" : "false"}>
      <CsSidebar initialCollapsed={csSidebarCollapsed} />
      <div className="cs-content">{children}</div>
    </div>
  );
}
