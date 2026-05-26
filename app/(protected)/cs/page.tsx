import Link from "next/link";
import { UsersRound, BarChart3, ShoppingBag, MoveRight } from "lucide-react";

export default function CsHomePage() {
  return (
    <div className="cs-home">
      <header className="cs-home-header">
        <h2>Centro de Operações CS</h2>
        <p>Ferramentas estratégicas para a liderança de Customer Success/Experience.</p>
      </header>

      <div className="cs-home-grid">
        <Link href="/cs/movimentacoes" className="cs-home-card">
          <div className="cs-home-card-icon">
            <MoveRight />
          </div>
          <div>
            <strong>Movimentações</strong>
            <p>Monitorar mudanças de etapa por período, com fluxo de origem e destino por cliente.</p>
          </div>
        </Link>

        <Link href="/cs/forca-tarefa" className="cs-home-card">
          <div className="cs-home-card-icon">
            <UsersRound />
          </div>
          <div>
            <strong>Força-Tarefa</strong>
            <p>Redistribuir lotes de clientes parados entre as atendentes para destravar gargalos.</p>
          </div>
        </Link>

        <Link href="/cs/compras-pagas" className="cs-home-card">
          <div className="cs-home-card-icon">
            <ShoppingBag />
          </div>
          <div>
            <strong>Compras Pagas</strong>
            <p>Visão do CRM com as compras pagas para apoio em dúvidas operacionais.</p>
          </div>
        </Link>

        <div className="cs-home-card is-soon" aria-disabled="true">
          <div className="cs-home-card-icon">
            <BarChart3 />
          </div>
          <div>
            <strong>Relatórios &amp; SLA</strong>
            <p>Em breve — visão consolidada de carga por atendente, SLA agregado e gargalos por etapa.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
