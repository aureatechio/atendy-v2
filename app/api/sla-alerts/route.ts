import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SlaAlert } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RawRow {
  id: string;
  status: "warning" | "overdue";
  fired_at: string;
  deadline: string;
  last_seen_at: string;
  cliente: {
    id: string;
    nomecliente: string | null;
    nome: string | null;
    responsavel_atendimento: string | null;
  } | null;
  stage: {
    id: string;
    name: string | null;
    slug: string | null;
    color: string | null;
  } | null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("sla_alerts")
    .select(
      `id, status, fired_at, deadline, last_seen_at,
       cliente:clientes_cadastro!inner(id, nomecliente, nome, responsavel_atendimento),
       stage:client_pipeline_stages!inner(id, name, slug, color)`,
    )
    .is("resolved_at", null)
    .order("status", { ascending: false }) // overdue (o) > warning (w)
    .order("fired_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data as unknown as RawRow[]) ?? [];
  const alerts: SlaAlert[] = rows
    .filter((r) => r.cliente && r.stage)
    .map((r) => ({
      id: r.id,
      status: r.status,
      firedAt: r.fired_at,
      deadline: r.deadline,
      lastSeenAt: r.last_seen_at,
      cliente: {
        id: r.cliente!.id,
        nome: r.cliente!.nomecliente ?? r.cliente!.nome ?? "Sem nome",
        responsavelId: r.cliente!.responsavel_atendimento,
      },
      stage: {
        id: r.stage!.id,
        name: r.stage!.name ?? r.stage!.slug ?? "",
        slug: r.stage!.slug ?? "",
        color: r.stage!.color ?? "#64748b",
      },
    }));

  return NextResponse.json({ alerts });
}
