import { AlertTriangle } from "lucide-react";
import { CsMovimentacoesDashboard } from "@/components/cs/cs-movimentacoes-dashboard";
import { getCsStageMovements, type CsMovementsSearchParams } from "@/lib/api/cs-movimentacoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<CsMovementsSearchParams>;
};

export default async function CsMovimentacoesPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};

  try {
    const data = await getCsStageMovements(params);
    return <CsMovimentacoesDashboard initialData={data} />;
  } catch (error) {
    console.error("Failed to fetch CS stage movements from Supabase.", error);
    return (
      <div className="space-y-4">
        <Card className="panel-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--danger)]">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <CardTitle>Não foi possível carregar as movimentações</CardTitle>
                <p className="mt-1 text-xs ds-text-muted">
                  A visão depende do histórico de mudança de etapas em produção.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm ds-text-muted">
              Verifique a conexão, a sessão atual e as permissões da tabela <code>task_history</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
}
