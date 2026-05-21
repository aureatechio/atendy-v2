import { roleHasCapability } from "@/lib/auth/capabilities";
import type { AuthSnapshot } from "@/lib/auth/session";

export function buildLoginRedirect(pathname = "/") {
  const redirectTo = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/";
  return `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
}

export function getProtectedAuthRedirect(snapshot: AuthSnapshot, pathname = "/") {
  if (snapshot.status === "active") {
    return null;
  }

  if (snapshot.status === "anonymous") {
    return buildLoginRedirect(pathname);
  }

  return `/login?error=${snapshot.status}`;
}

export function canAccessAdmin(snapshot: AuthSnapshot) {
  return snapshot.status === "active" && roleHasCapability(snapshot.profile.role, "adminArea");
}

export function canAccessCS(snapshot: AuthSnapshot) {
  return snapshot.status === "active" && roleHasCapability(snapshot.profile.role, "csArea");
}
