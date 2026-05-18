import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { SiteShell } from "@/components/layout/site-shell";
import { AuthProvider } from "@/hooks/use-auth";
import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";
import { getProtectedAuthRedirect } from "@/lib/auth/guards";

async function getCurrentPathname() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-atendy-pathname") ?? "/";
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [snapshot, pathname] = await Promise.all([getAuthSnapshot(), getCurrentPathname()]);
  const authRedirect = getProtectedAuthRedirect(snapshot, pathname);

  if (authRedirect) {
    redirect(authRedirect as Route);
  }

  return (
    <AuthProvider initialAuth={snapshot}>
      <SiteShell>{children}</SiteShell>
    </AuthProvider>
  );
}
