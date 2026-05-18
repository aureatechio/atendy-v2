import { AlertTriangle } from "lucide-react";
import { getFunilDados } from "@/lib/api/funil";
import { FunilDashboard } from "@/components/dashboard/funil-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunilData } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FunilPage({
  searchParams,
}: {
  searchParams?: Promise<{
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const isFull = params?.view === "full";
  let data: FunilData;

  try {
    data = await getFunilDados();
  } catch (error) {
    console.error("Failed to fetch funil data from Supabase.", error);
    return <FunilErrorState isFull={isFull} />;
  }

  if (isFull) {
    return (
      <div className="mx-0">
        <FunilDashboard initialData={data} />
      </div>
    );
  }

  return <FunilDashboard initialData={data} />;
}

function FunilErrorState({ isFull }: { isFull: boolean }) {
  return (
    <div className={isFull ? "mx-0" : "space-y-4"}>
      <Card className="panel-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--danger)]">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <CardTitle>Não foi possível carregar o funil</CardTitle>
              <p className="mt-1 text-xs ds-text-muted">Os dados do Funil de Produção agora vêm apenas do Supabase.</p>
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
