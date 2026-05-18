import Link from "next/link";
import type { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <main className="auth-page">
      <section className="auth-hero" aria-hidden="true">
        <div className="auth-brand-mark">A</div>
        <p className="auth-eyebrow">Atendy Operacao</p>
        <h1>Controle de acesso para relatorios e operacao.</h1>
        <p>
          O Supabase valida a identidade. O Atendy libera a operacao conforme perfil, status e papel
          interno.
        </p>
      </section>

      <section className="auth-card panel-card">
        <div className="auth-card-header">
          <Link href="/login" className="auth-card-brand">
            Atendy
          </Link>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        {children}

        {footer ? <div className="auth-card-footer">{footer}</div> : null}
      </section>
    </main>
  );
}
