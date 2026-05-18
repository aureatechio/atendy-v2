import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { getFunilDados } from "@/lib/api/funil";
import { FunilDashboard } from "@/components/dashboard/funil-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunilData } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Funil de Produção — Vista detalhada",
};

export default async function FunilV1Page() {
  let data: FunilData;

  try {
    data = await getFunilDados();
  } catch (error) {
    console.error("Failed to fetch funil data from Supabase.", error);
    return (
      <div className="space-y-4">
        <Card className="panel-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--danger)]">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <CardTitle>Não foi possível carregar o funil</CardTitle>
                <p className="mt-1 text-xs ds-text-muted">
                  Os dados do Funil de Produção agora vêm apenas do Supabase.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm ds-text-muted">
              Verifique a conexão, as variáveis de ambiente do Supabase e as permissões das tabelas de produção.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="fv2-detalhes-header">
        <Link href="/funil" className="cliente-back">
          <ArrowLeft className="h-4 w-4" /> Voltar ao funil
        </Link>
        <span className="fv2-header-eyebrow">Vista detalhada</span>
        <h1 className="fv2-header-headline">Funil de Produção — Detalhes</h1>
        <p className="fv2-header-sub">
          Visão lateral completa do funil com KPIs, etapas e detalhamento por estágio.
        </p>
      </header>
      <FunilDashboard initialData={data} />
    </div>
  );
}
