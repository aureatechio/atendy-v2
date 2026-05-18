"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LogOut, ShieldCheck, UserRound, Workflow } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

type NavLink = {
  href: "/" | "/funil" | "/admin/users";
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  adminOnly?: boolean;
};

const links: NavLink[] = [
  { href: "/", label: "Compras Pagas", icon: Home },
  { href: "/funil", label: "Funil de Produção", icon: Workflow },
  { href: "/admin/users", label: "Usuários", icon: ShieldCheck, adminOnly: true },
];

const publicRoutes = ["/login", "/forgot-password", "/reset-password", "/auth/callback"];

function getPageMeta(pathname: string) {
  if (pathname.startsWith("/admin")) {
    return {
      title: "Usuários e Acessos",
      trail: "Admin",
    };
  }

  if (pathname === "/funil") {
    return {
      title: "Funil de Produção",
      trail: "Funil",
    };
  }

  return {
    title: "Compras Pagas",
    trail: "Compras",
  };
}

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, profile, user, isAuthenticated, isPending, isBlocked, isSupervisor, signOut } = useAuth();
  const { title, trail } = getPageMeta(pathname || "/");
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname?.startsWith(`${route}/`));
  const visibleLinks = links.filter((link) => !link.adminOnly || isSupervisor);

  useEffect(() => {
    if (isPublicRoute || loading || isAuthenticated) {
      return;
    }

    const error = isBlocked ? "blocked" : isPending ? "pending" : user && !profile ? "profile_missing" : "session_expired";

    void signOut().finally(() => {
      router.replace(`/login?error=${error}`);
      router.refresh();
    });
  }, [isPublicRoute, isAuthenticated, isBlocked, isPending, loading, profile, router, signOut, user]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading || !isAuthenticated) {
    return (
      <main className="auth-page">
        <section className="auth-card panel-card">
          <div className="auth-card-header">
            <div className="auth-card-brand">Atendy</div>
            <h2>{loading ? "Carregando Atendy" : "Redirecionando para o login"}</h2>
            <p>
              {loading
                ? "Preparando seu ambiente de trabalho."
                : "Sua sessao nao esta ativa. Voce sera levado para entrar novamente."}
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="page-shell">
      <div className="app-shell">
        <aside className="app-sidebar">
          <div className="app-sidebar-brand">
            <div className="app-sidebar-brand-icon">A</div>
            <div>
              <div className="app-sidebar-brand-title">Atendy Relatórios</div>
              <div className="app-sidebar-brand-subtitle">Dashboard</div>
            </div>
          </div>

          <nav className="app-sidebar-nav" aria-label="Navegação principal">
            {visibleLinks.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));
              return (
                <Link key={href} href={href} className={`app-sidebar-link ${isActive ? "is-active" : ""}`}>
                  <Icon />
                  <span>{label}</span>
                  {label.includes("Funil") ? <span className="app-sidebar-link-badge">Novo</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className="app-sidebar-footer">
            <div className="app-sidebar-user" role="presentation">
              <div className="app-sidebar-user-avatar">
                {(profile?.full_name ?? user?.email ?? "AT")
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="app-sidebar-user-name">{profile?.full_name ?? "Usuario Atendy"}</p>
                <p className="app-sidebar-user-email">{user?.email}</p>
              </div>
              <UserRound className="app-sidebar-link-icon" aria-hidden />
            </div>
          </div>
        </aside>

        <main className="app-main">
          <header className="app-header">
            <div className="app-header-content">
              <p className="app-header-breadcrumb">
                <Link href="/">Dashboard</Link>
                <span className="app-header-breadcrumb-sep">/</span>
                <span>{trail}</span>
              </p>
              <h1 className="app-header-title">{title}</h1>
            </div>
            <div className="app-header-actions">
              <span className="app-role-pill">{profile?.role}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut />
                Sair
              </Button>
            </div>
          </header>

          <section className={`app-content${pathname?.startsWith("/funil") ? " app-content--wide" : ""}`}>{children}</section>
        </main>
      </div>
    </div>
  );
}
