import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

export function SettingsShell({ children }: { children: ReactNode }) {
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
        <div className="settings-content">{children}</div>
      </div>
    </div>
  );
}
