import { redirect } from "next/navigation";
import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";
import { canAccessCS } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { ForcaTarefaPanel } from "@/components/cs/forca-tarefa-panel";

type StageOption = {
  id: string;
  name: string;
  slug: string;
  color: string;
  order_index: number;
};

type AttendantOption = {
  id: string;
  full_name: string;
};

export default async function ForcaTarefaPage() {
  const snapshot = await getAuthSnapshot();
  if (!canAccessCS(snapshot)) {
    redirect("/");
  }

  const supabase = await createClient();

  const [stagesRes, attendantsRes] = await Promise.all([
    supabase
      .from("client_pipeline_stages")
      .select("id, name, slug, color, order_index, is_final, is_active")
      .eq("is_active", true)
      .eq("is_final", false)
      .order("order_index", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name, role, status")
      .eq("role", "attendant")
      .eq("status", "active")
      .order("full_name", { ascending: true }),
  ]);

  const stages: StageOption[] = (stagesRes.data ?? []).map((s) => ({
    id: s.id as string,
    name: (s.name as string) ?? (s.slug as string),
    slug: s.slug as string,
    color: (s.color as string) ?? "#64748b",
    order_index: Number(s.order_index ?? 0),
  }));

  const attendants: AttendantOption[] = (attendantsRes.data ?? []).map((p) => ({
    id: p.id as string,
    full_name: (p.full_name as string) ?? "Sem nome",
  }));

  return (
    <div className="forca-tarefa">
      <header className="forca-tarefa-header">
        <h2>Força-Tarefa</h2>
        <p>Selecione um lote de clientes parados e distribua manualmente entre atendentes.</p>
      </header>

      <ForcaTarefaPanel stages={stages} attendants={attendants} />
    </div>
  );
}
