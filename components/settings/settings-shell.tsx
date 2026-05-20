"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";
import { CalendarRange, ShieldCheck, SlidersHorizontal, Workflow } from "lucide-react";

type SettingsSection = {
  href: Route;
  label: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  available: boolean;
};

const sections: SettingsSection[] = [
  {
    href: "/configuracoes/etapas",
    label: "Etapas e SLAs",
    description: "Etapas, subetapas, cores e prazos do funil.",
    icon: Workflow,
    available: true,
  },
  {
    href: "/configuracoes/feriados" as Route,
    label: "Feriados",
    description: "Calendário que afeta o cálculo de SLA.",
    icon: CalendarRange,
    available: false,
  },
  {
    href: "/configuracoes/usuarios" as Route,
    label: "Usuários e Acessos",
    description: "Equipes, papéis e permissões.",
    icon: ShieldCheck,
    available: false,
  },
];

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="settings-shell">
      <header className="settings-header">
        <div className="settings-header-icon">
          <SlidersHorizontal />
        </div>
        <div>
          <p className="auth-eyebrow">Configurações</p>
          <h2>Personalize o Atendy</h2>
          <p>Ajuste etapas, calendários, equipes e o restante do comportamento do sistema.</p>
        </div>
      </header>

      <div className="settings-body">
        <aside className="settings-nav" aria-label="Seções de configurações">
          {sections.map(({ href, label, description, icon: Icon, available }) => {
            const isActive = available && (pathname === href || pathname.startsWith(`${href}/`));
            const className = `settings-nav-item${isActive ? " is-active" : ""}${available ? "" : " is-disabled"}`;
            const content = (
              <>
                <span className="settings-nav-item-icon">
                  <Icon />
                </span>
                <span className="settings-nav-item-text">
                  <span className="settings-nav-item-label">{label}</span>
                  <span className="settings-nav-item-description">{description}</span>
                </span>
              </>
            );

            if (!available) {
              return (
                <span key={href} className={className} aria-disabled>
                  {content}
                  <span className="settings-nav-item-badge">Em breve</span>
                </span>
              );
            }

            return (
              <Link key={href} href={href} className={className}>
                {content}
              </Link>
            );
          })}
        </aside>

        <div className="settings-content">{children}</div>
      </div>
    </div>
  );
}
