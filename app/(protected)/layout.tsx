import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { SiteShell } from "@/components/layout/site-shell";
import { AuthProvider } from "@/hooks/use-auth";
import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";
import { getProtectedAuthRedirect } from "@/lib/auth/guards";
import { getNewAssignmentsTodayCount } from "@/lib/api/notifications";

async function getCurrentPathname() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-atendy-pathname") ?? "/";
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [snapshot, pathname, cookieStore] = await Promise.all([
    getAuthSnapshot(),
    getCurrentPathname(),
    cookies(),
  ]);
  const authRedirect = getProtectedAuthRedirect(snapshot, pathname);

  if (authRedirect) {
    redirect(authRedirect as Route);
  }

  const sidebarCollapsed = cookieStore.get("sidebar:main")?.value === "collapsed";
  const newAssignmentsCount =
    snapshot.status === "active" && snapshot.profile.role === "attendant"
      ? await getNewAssignmentsTodayCount(snapshot.user.id)
      : 0;

  return (
    <AuthProvider initialAuth={snapshot}>
      <SiteShell
        initialSidebarCollapsed={sidebarCollapsed}
        newAssignmentsCount={newAssignmentsCount}
      >
        {children}
      </SiteShell>
    </AuthProvider>
  );
}
