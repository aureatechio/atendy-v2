"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronsLeft,
  ChevronsRight,
  FileSearch,
  Home,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  VenetianMask,
  Workflow,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SlaBell } from "@/components/layout/sla-bell";
import { useAuth } from "@/hooks/use-auth";

type LinkRequirement = "admin" | "csAccess" | "settingsAccess" | "auditAccess" | "dev";

type SiteRoute =
  | "/"
  | "/funil"
  | "/funil/v1"
  | "/clientes"
  | "/alertas"
  | "/auditoria"
  | "/admin/users"
  | "/impersonar"
  | "/configuracoes"
  | "/cs"
  | "/perfil";

type NavLink = {
  href: SiteRoute;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  requires?: LinkRequirement;
  children?: Array<{ href: SiteRoute; label: string }>;
};

const links: NavLink[] = [
  { href: "/", label: "Dashboard", icon: Home },
  {
    href: "/funil",
    label: "Funil de Produção",
    icon: Workflow,
    children: [
      { href: "/funil", label: "Funil" },
      { href: "/funil/v1", label: "Funil detalhado" },
    ],
  },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/alertas", label: "Alertas", icon: Bell },
  { href: "/cs", label: "Gestão CS", icon: Sparkles, requires: "csAccess" },
  { href: "/auditoria", label: "Auditoria", icon: FileSearch, requires: "auditAccess" },
  { href: "/admin/users", label: "Usuários", icon: ShieldCheck, requires: "admin" },
  { href: "/impersonar", label: "Impersonar", icon: VenetianMask, requires: "dev" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, requires: "settingsAccess" },
];

const publicRoutes = ["/login", "/forgot-password", "/reset-password", "/auth/callback"];

const SIDEBAR_COOKIE = "sidebar:main";

function getPageMeta(pathname: string) {
  if (pathname.startsWith("/configuracoes")) {
    return {
      title: "Configurações",
      trail: "Configurações",
    };
  }

  if (pathname.startsWith("/perfil")) {
    return {
      title: "Meu perfil",
      trail: "Perfil",
    };
  }

  if (pathname.startsWith("/auditoria")) {
    return {
      title: "Auditoria",
      trail: "Auditoria",
    };
  }

  if (pathname.startsWith("/admin")) {
    return {
      title: "Usuários e Acessos",
      trail: "Admin",
    };
  }

  if (pathname.startsWith("/cs")) {
    return {
      title: "Gestão CS",
      trail: "CS",
    };
  }

  if (pathname === "/funil/v1") {
    return {
      title: "Funil Detalhado",
      trail: "Funil / Detalhado",
    };
  }

  if (pathname?.startsWith("/funil")) {
    return {
      title: "Funil de Produção",
      trail: "Funil",
    };
  }

  if (pathname?.startsWith("/clientes")) {
    return {
      title: "Clientes",
      trail: "Clientes",
    };
  }

  if (pathname?.startsWith("/alertas")) {
    return {
      title: "Alertas",
      trail: "Alertas",
    };
  }

  if (pathname === "/cs/compras-pagas") {
    return {
      title: "Compras Pagas",
      trail: "CS / Compras Pagas",
    };
  }

  if (pathname?.startsWith("/cs")) {
    return {
      title: "Gestão CS",
      trail: "CS",
    };
  }

  return {
    title: "Dashboard",
    trail: "Visão geral",
  };
}

function persistSidebarState(value: boolean) {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${SIDEBAR_COOKIE}=${value ? "collapsed" : "expanded"}; path=/; max-age=${oneYear}; samesite=lax`;
}

export function SiteShell({
  children,
  initialSidebarCollapsed = false,
  newAssignmentsCount = 0,
  impersonation = null,
}: {
  children: ReactNode;
  initialSidebarCollapsed?: boolean;
  newAssignmentsCount?: number;
  impersonation?: { returnToName: string } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    loading,
    profile,
    user,
    isAuthenticated,
    isPending,
    isBlocked,
    isSupervisor,
    isCsAccess,
    isSettingsAccess,
    isAuditAccess,
    isDev,
    signOut,
  } =
    useAuth();
  const [stoppingImpersonation, setStoppingImpersonation] = useState(false);
  const { title, trail } = getPageMeta(pathname || "/");
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname?.startsWith(`${route}/`));
  const [collapsed, setCollapsed] = useState(initialSidebarCollapsed);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      persistSidebarState(next);
      return next;
    });
  }

  const visibleLinks = links.filter((link) => {
    if (!link.requires) return true;
    if (link.requires === "admin") return isSupervisor;
    if (link.requires === "csAccess") return isCsAccess;
    if (link.requires === "settingsAccess") return isSettingsAccess;
    if (link.requires === "auditAccess") return isAuditAccess;
    if (link.requires === "dev") return isDev;
    return false;
  });

  async function stopImpersonation() {
    setStoppingImpersonation(true);
    await fetch("/api/admin/impersonate/stop", { method: "POST" });
    window.location.assign("/");
  }

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
      <div className="app-shell" data-sidebar-collapsed={collapsed ? "true" : "false"}>
        <aside className="app-sidebar" data-collapsed={collapsed ? "true" : "false"}>
          <div className="app-sidebar-brand">
            <div className="app-sidebar-brand-icon">A</div>
            <div className="app-sidebar-brand-text">
              <div className="app-sidebar-brand-title">Atendy Relatórios</div>
              <div className="app-sidebar-brand-subtitle">Dashboard</div>
            </div>
            <button
              type="button"
              className="app-sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
            </button>
          </div>

          <nav className="app-sidebar-nav" aria-label="Navegação principal">
            {visibleLinks.map(({ href, label, icon: Icon, children }) => {
              const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));
              const showAssignmentsBadge = href === "/clientes" && newAssignmentsCount > 0;

              if (children) {
                return (
                  <div key={href} className="app-sidebar-group">
                    <Link
                      href={href}
                      className={`app-sidebar-link app-sidebar-group-header ${isActive ? "is-active" : ""}`}
                      title={collapsed ? label : undefined}
                    >
                      <Icon />
                      <span>{label}</span>
                      <span className="app-sidebar-link-badge">Novo</span>
                    </Link>
                    <div className="app-sidebar-group-children">
                      {children.map((child) => {
                        const isChildActive = pathname === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`app-sidebar-sublink ${isChildActive ? "is-active" : ""}`}
                          >
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={href}
                  href={href}
                  className={`app-sidebar-link ${isActive ? "is-active" : ""}`}
                  title={collapsed ? label : undefined}
                >
                  <Icon />
                  <span>{label}</span>
                  {showAssignmentsBadge ? (
                    <span
                      className="app-sidebar-link-count"
                      title={`${newAssignmentsCount} novo(s) cliente(s) hoje`}
                    >
                      {newAssignmentsCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="app-sidebar-footer">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="app-sidebar-signout"
              title="Sair da conta"
            >
              <LogOut />
              <span>Sair</span>
            </Button>
          </div>
        </aside>

        <main className="app-main">
          {impersonation ? (
            <div className="impersonation-banner" role="status">
              <VenetianMask aria-hidden />
              <span>
                Você está logado como <strong>{profile?.full_name ?? user?.email ?? "outro usuário"}</strong>.
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={stopImpersonation}
                disabled={stoppingImpersonation}
                className="impersonation-banner-action"
              >
                {stoppingImpersonation ? "Voltando..." : `Voltar para ${impersonation.returnToName}`}
              </Button>
            </div>
          ) : null}
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
              <SlaBell />
              <Link href="/perfil" className="app-header-user" title="Meu perfil">
                <div className="app-header-user-avatar">
                  {profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt="" />
                  ) : (
                    (profile?.full_name ?? user?.email ?? "AT")
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()
                  )}
                </div>
                <div className="app-header-user-info">
                  <span className="app-header-user-name">{profile?.full_name ?? "Usuário"}</span>
                  <span className="app-header-user-role">{profile?.role}</span>
                </div>
              </Link>
            </div>
          </header>

          <section className={`app-content${pathname?.startsWith("/funil") || pathname?.startsWith("/clientes") || pathname?.startsWith("/configuracoes") || pathname?.startsWith("/cs") || pathname?.startsWith("/alertas") || pathname?.startsWith("/perfil") ? " app-content--wide" : ""}`}>{children}</section>
        </main>
      </div>
    </div>
  );
}
