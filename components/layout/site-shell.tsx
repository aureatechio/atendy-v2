"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronsLeft,
  ChevronsRight,
  Home,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SlaBell } from "@/components/layout/sla-bell";
import { useAuth } from "@/hooks/use-auth";

type LinkRequirement = "admin" | "csAccess" | "settingsAccess";

type SiteRoute =
  | "/"
  | "/funil"
  | "/funil/v1"
  | "/clientes"
  | "/alertas"
  | "/admin/users"
  | "/cs"
  | "/cs/movimentacoes"
  | "/cs/forca-tarefa"
  | "/cs/compras-pagas"
  | "/configuracoes"
  | "/configuracoes/etapas"
  | "/perfil";

type NavChild = {
  href: SiteRoute;
  label: string;
};

type NavLink = {
  href: SiteRoute;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  requires?: LinkRequirement;
  activePrefix?: string;
  badge?: string;
  children?: NavChild[];
};

const links: NavLink[] = [
  { href: "/", label: "Dashboard", icon: Home },
  {
    href: "/funil",
    label: "Funil de Produção",
    icon: Workflow,
    badge: "Novo",
    children: [
      { href: "/funil", label: "Funil" },
      { href: "/funil/v1", label: "Funil detalhado" },
    ],
  },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/alertas", label: "Alertas", icon: Bell },
  {
    href: "/cs/movimentacoes",
    label: "Gestão CS",
    icon: Sparkles,
    requires: "csAccess",
    activePrefix: "/cs",
    children: [
      { href: "/cs/movimentacoes", label: "Movimentações" },
      { href: "/cs/forca-tarefa", label: "Força Tarefa" },
      { href: "/cs/compras-pagas", label: "Vendas CRM" },
    ],
  },
  { href: "/admin/users", label: "Usuários", icon: ShieldCheck, requires: "admin" },
  {
    href: "/configuracoes/etapas",
    label: "Configurações",
    icon: Settings,
    requires: "settingsAccess",
    activePrefix: "/configuracoes",
    children: [{ href: "/configuracoes/etapas", label: "Etapas e SLAs" }],
  },
];

const publicRoutes = ["/login", "/forgot-password", "/reset-password", "/auth/callback"];

const SIDEBAR_COOKIE = "sidebar:main";

function getPageMeta(pathname: string) {
  if (pathname.startsWith("/configuracoes/etapas")) {
    return {
      title: "Etapas e SLAs",
      trail: "Configurações / Etapas e SLAs",
    };
  }

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

  if (pathname.startsWith("/admin")) {
    return {
      title: "Usuários e Acessos",
      trail: "Admin",
    };
  }

  if (pathname.startsWith("/cs/movimentacoes")) {
    return {
      title: "Movimentações",
      trail: "CS / Movimentações",
    };
  }

  if (pathname.startsWith("/cs/forca-tarefa")) {
    return {
      title: "Força Tarefa",
      trail: "CS / Força Tarefa",
    };
  }

  if (pathname.startsWith("/cs/compras-pagas")) {
    return {
      title: "Vendas CRM",
      trail: "CS / Vendas CRM",
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
}: {
  children: ReactNode;
  initialSidebarCollapsed?: boolean;
  newAssignmentsCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, profile, user, isAuthenticated, isPending, isBlocked, isSupervisor, isCsAccess, isSettingsAccess, signOut } =
    useAuth();
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
    return false;
  });

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
            {visibleLinks.map(({ href, label, icon: Icon, activePrefix, badge, children }) => {
              const isActive =
                pathname === href ||
                (href !== "/" && pathname?.startsWith(`${href}/`)) ||
                (activePrefix ? pathname === activePrefix || pathname?.startsWith(`${activePrefix}/`) : false);
              const showAssignmentsBadge = href === "/clientes" && newAssignmentsCount > 0;

              if (children) {
                const activeChildHref = children
                  .filter((child) => pathname === child.href || pathname?.startsWith(`${child.href}/`))
                  .sort((current, next) => next.href.length - current.href.length)[0]?.href;

                return (
                  <div key={href} className="app-sidebar-group">
                    <Link
                      href={href}
                      className={`app-sidebar-link app-sidebar-group-header ${isActive ? "is-active" : ""}`}
                      title={collapsed ? label : undefined}
                    >
                      <Icon />
                      <span>{label}</span>
                      {badge ? <span className="app-sidebar-link-badge">{badge}</span> : null}
                    </Link>
                    <div className="app-sidebar-group-children">
                      {children.map((child) => {
                        const isChildActive = activeChildHref === child.href;
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
