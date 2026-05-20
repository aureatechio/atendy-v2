import { getFunilDados } from "@/lib/api/funil";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { currencyFormatter } from "@/lib/utils";
import type { FunilData } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let funil: FunilData | null = null;
  try {
    funil = await getFunilDados();
  } catch (error) {
    console.warn("Dashboard: não foi possível carregar funil.", error);
  }

  const totalClientes = funil?.rows.length ?? 0;
  const etapasAtivas = funil?.stages_meta.length ?? 0;
  const valorEmCarteira = funil
    ? Object.values(funil.valor_map).reduce((sum, value) => sum + (value ?? 0), 0)
    : 0;
  const clientesNaoAtribuidos = funil?.rows.filter((row) => !row.a || row.a === "Não atribuído").length ?? 0;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">Visão geral</h2>
        <p className="text-sm ds-text-muted">
          Indicadores rápidos da operação. Use o menu lateral para acessar funil, clientes e ferramentas específicas.
        </p>
      </header>

      <div className="kpi-grid">
        <KpiCard title="Clientes ativos no funil" value={String(totalClientes)} subtitle="não arquivados" />
        <KpiCard title="Etapas configuradas" value={String(etapasAtivas)} subtitle="pipeline de produção" />
        <KpiCard title="Valor em carteira" value={currencyFormatter.format(valorEmCarteira)} subtitle="somatório dos clientes no funil" />
        <KpiCard
          title="Sem responsável"
          value={String(clientesNaoAtribuidos)}
          subtitle="clientes pendentes de atribuição"
        />
      </div>
    </div>
  );
}
