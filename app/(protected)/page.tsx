import { getFunilDados } from "@/lib/api/funil";
import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  SemProprietarioMaisNovoCard,
  type SemProprietarioClienteItem,
} from "@/components/dashboard/sem-proprietario-mais-novo-card";
import {
  DistribuicaoEtapasPieCard,
  type EtapaDistribuicaoItem,
} from "@/components/dashboard/distribuicao-etapas-pie-card";
import { SemResponsavelKpiCard } from "@/components/dashboard/sem-responsavel-kpi-card";
import { SlaEstouradoListCard } from "@/components/dashboard/sla-estourado-list-card";
import type { SemResponsavelClienteItem } from "@/components/dashboard/sem-responsavel-drawer";
import type { ResponsavelOption } from "@/components/dashboard/atribuir-responsavel-drawer";
import { buildSlaEstouradoClientes } from "@/lib/dashboard/sla-estourado";
import { currencyFormatter } from "@/lib/utils";
import type { FunilData } from "@/lib/types";

const MAIS_NOVO_STAGE_SLUG = "mais-novo";
const ATRIBUIVEL_ROLES = ["attendant", "producao", "cs_head"] as const;

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let funil: FunilData | null = null;
  try {
    funil = await getFunilDados();
  } catch (error) {
    console.warn("Dashboard: não foi possível carregar funil.", error);
  }

  let responsaveis: ResponsavelOption[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ATRIBUIVEL_ROLES as unknown as string[])
      .eq("status", "active")
      .order("full_name", { ascending: true });
    responsaveis = (data ?? []).map((p) => ({
      id: p.id as string,
      fullName: (p.full_name as string) ?? "Sem nome",
      role: (p.role as string) ?? null,
    }));
  } catch (error) {
    console.warn("Dashboard: não foi possível carregar responsáveis.", error);
  }

  const totalClientes = funil?.rows.length ?? 0;
  const etapasAtivas = funil?.stages_meta.length ?? 0;
  const valorEmCarteira = funil
    ? Object.values(funil.valor_map).reduce((sum, value) => sum + (value ?? 0), 0)
    : 0;
  const clientesNaoAtribuidos = funil
    ? Object.values(funil.clients_map).filter((cliente) => !cliente.responsavelId).length
    : 0;
  const slaEstouradoClientes = funil ? buildSlaEstouradoClientes(funil) : [];

  const slaRank: Record<string, number> = { overdue: 0, warning: 1, ok: 2, none: 3 };
  const maisNovoSemProprietario: SemProprietarioClienteItem[] = funil
    ? funil.rows
        .filter((row) => row.s === MAIS_NOVO_STAGE_SLUG)
        .map((row) => {
          const cliente = funil!.clients_map[row.c];
          if (!cliente || cliente.responsavelId) return null;
          return {
            id: cliente.id,
            nome: cliente.nome,
            segmentoNome: cliente.segmentoNome,
            diasNaEtapa: row.d,
            slaStatus: row.slaStatus ?? "none",
          };
        })
        .filter((item): item is SemProprietarioClienteItem => item !== null)
        .sort((a, b) => {
          const rank = (slaRank[a.slaStatus] ?? 3) - (slaRank[b.slaStatus] ?? 3);
          if (rank !== 0) return rank;
          if (b.diasNaEtapa !== a.diasNaEtapa) return b.diasNaEtapa - a.diasNaEtapa;
          return a.nome.localeCompare(b.nome, "pt-BR");
        })
    : [];

  const semResponsavelClientes: SemResponsavelClienteItem[] = funil
    ? (() => {
        const stageBySlug = new Map(
          funil.stages_meta.map((s) => [s.slug, s] as const),
        );
        const stageOrder = (slug: string) =>
          stageBySlug.get(slug)?.order_index ?? Number.POSITIVE_INFINITY;
        // pega a row "mais relevante" de cada cliente (menor order_index = mais cedo no funil)
        const rowByCliente = new Map<string, (typeof funil.rows)[number]>();
        for (const row of funil.rows) {
          if (!row.c || !row.s) continue;
          const prev = rowByCliente.get(row.c);
          if (!prev || stageOrder(row.s) < stageOrder(prev.s)) {
            rowByCliente.set(row.c, row);
          }
        }
        const items: SemResponsavelClienteItem[] = [];
        for (const cliente of Object.values(funil.clients_map)) {
          if (cliente.responsavelId) continue;
          const row = rowByCliente.get(cliente.id);
          if (!row) continue;
          const stage = stageBySlug.get(row.s);
          if (!stage) continue;
          items.push({
            id: cliente.id,
            nome: cliente.nome,
            segmentoNome: cliente.segmentoNome,
            diasNaEtapa: row.d,
            slaStatus: row.slaStatus ?? "none",
            stageSlug: stage.slug,
            stageName: stage.name,
            stageColor: stage.color,
          });
        }
        return items.sort((a, b) => {
          const rank = (slaRank[a.slaStatus] ?? 3) - (slaRank[b.slaStatus] ?? 3);
          if (rank !== 0) return rank;
          if (b.diasNaEtapa !== a.diasNaEtapa) return b.diasNaEtapa - a.diasNaEtapa;
          return a.nome.localeCompare(b.nome, "pt-BR");
        });
      })()
    : [];

  const distribuicaoEtapas: EtapaDistribuicaoItem[] = funil
    ? (() => {
        const counts = new Map<string, Set<string>>();
        for (const row of funil.rows) {
          if (!row.s || !row.c) continue;
          let set = counts.get(row.s);
          if (!set) {
            set = new Set<string>();
            counts.set(row.s, set);
          }
          set.add(row.c);
        }
        return funil.stages_meta
          .slice()
          .sort((a, b) => a.order_index - b.order_index)
          .map((stage) => ({
            slug: stage.slug,
            nome: stage.name,
            cor: stage.color,
            quantidade: counts.get(stage.slug)?.size ?? 0,
          }))
          .filter((etapa) => etapa.quantidade > 0);
      })()
    : [];

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
        <SemResponsavelKpiCard
          title="Sem responsável"
          value={String(clientesNaoAtribuidos)}
          subtitle="clientes pendentes de atribuição"
          clientes={semResponsavelClientes}
          responsaveis={responsaveis}
        />
      </div>

      <div className="dashboard-secondary-grid">
        <SlaEstouradoListCard clientes={slaEstouradoClientes} />
        <SemProprietarioMaisNovoCard
          clientes={maisNovoSemProprietario}
          responsaveis={responsaveis}
        />
        <DistribuicaoEtapasPieCard etapas={distribuicaoEtapas} />
      </div>
    </div>
  );
}
