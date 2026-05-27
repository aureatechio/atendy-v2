"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, LayoutDashboard, MoveRight, ShoppingBag, UsersRound } from "lucide-react";
import { useState } from "react";

type CsNavLink = {
  href: "/cs" | "/cs/forca-tarefa" | "/cs/compras-pagas" | "/cs/movimentacoes";
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const csLinks: CsNavLink[] = [
  { href: "/cs", label: "Visão geral", icon: LayoutDashboard },
  { href: "/cs/movimentacoes", label: "Movimentações", icon: MoveRight },
  { href: "/cs/forca-tarefa", label: "Força-Tarefa", icon: UsersRound },
  { href: "/cs/compras-pagas", label: "Vendas CRM", icon: ShoppingBag },
];

const SIDEBAR_COOKIE = "sidebar:cs";

function persistState(value: boolean) {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${SIDEBAR_COOKIE}=${value ? "collapsed" : "expanded"}; path=/; max-age=${oneYear}; samesite=lax`;
}

export function CsSidebar({ initialCollapsed = false }: { initialCollapsed?: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      persistState(next);
      return next;
    });
  }

  return (
    <aside className="cs-sidebar" data-collapsed={collapsed ? "true" : "false"}>
      <div className="cs-sidebar-header">
        {!collapsed ? (
          <div className="cs-sidebar-title">
            <span className="cs-sidebar-title-eyebrow">Área restrita</span>
            <strong>Gestão CS</strong>
          </div>
        ) : null}
        <button
          type="button"
          className="cs-sidebar-toggle"
          onClick={toggle}
          aria-label={collapsed ? "Expandir menu CS" : "Recolher menu CS"}
          title={collapsed ? "Expandir menu CS" : "Recolher menu CS"}
        >
          {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
        </button>
      </div>

      <nav className="cs-sidebar-nav" aria-label="Navegação CS">
        {csLinks.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/cs" ? pathname === "/cs" : pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`cs-sidebar-link ${isActive ? "is-active" : ""}`}
              title={collapsed ? label : undefined}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
