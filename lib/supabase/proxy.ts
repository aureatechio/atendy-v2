import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/env";

const publicRoutes = ["/login", "/forgot-password", "/reset-password", "/auth/callback"];
const adminRoutes = ["/admin"];

function isPublicRoute(pathname: string) {
  return publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isAdminRoute(pathname: string) {
  return adminRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    const { name, value, ...options } = cookie;
    to.cookies.set(name, value, options);
  });
}

function redirectWithCookies(request: NextRequest, response: NextResponse, pathname: string, params?: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  Object.entries(params ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));

  const redirect = NextResponse.redirect(url);
  copyCookies(response, redirect);
  return redirect;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabasePublicKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (!user) {
    if (isPublicRoute(pathname)) {
      return supabaseResponse;
    }

    const redirectTo = `${pathname}${request.nextUrl.search}`;
    return redirectWithCookies(request, supabaseResponse, "/login", { redirectTo });
  }

  const { data: profile } = await supabase.from("profiles").select("id, role, status").eq("id", user.id).maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return redirectWithCookies(request, supabaseResponse, "/login", { error: "profile_missing" });
  }

  if (profile.status === "blocked") {
    await supabase.auth.signOut();
    return redirectWithCookies(request, supabaseResponse, "/login", { error: "blocked" });
  }

  if (profile.status !== "active") {
    if (isPublicRoute(pathname)) {
      return supabaseResponse;
    }

    return redirectWithCookies(request, supabaseResponse, "/login", { error: "pending" });
  }

  if (isPublicRoute(pathname) && pathname !== "/reset-password") {
    return redirectWithCookies(request, supabaseResponse, "/");
  }

  if (isAdminRoute(pathname) && !["admin", "supervisor"].includes(profile.role)) {
    return redirectWithCookies(request, supabaseResponse, "/");
  }

  return supabaseResponse;
}
