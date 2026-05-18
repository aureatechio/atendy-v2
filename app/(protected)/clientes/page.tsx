import { AlertTriangle } from "lucide-react";
import { ClientesDashboard } from "@/components/cliente/clientes-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClientesDados } from "@/lib/api/clientes";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  try {
    const data = await getClientesDados();
    return <ClientesDashboard initialData={data} />;
  } catch (error) {
    console.error("Failed to fetch clientes data from Supabase.", error);
    return (
      <Card className="panel-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--danger)]">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <CardTitle>Não foi possível carregar os clientes</CardTitle>
              <p className="mt-1 text-xs ds-text-muted">Os dados da lista vêm do Supabase.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm ds-text-muted">
            Verifique a conexão, as variáveis de ambiente do Supabase e as permissões das tabelas de clientes.
          </p>
        </CardContent>
      </Card>
    );
  }
}
