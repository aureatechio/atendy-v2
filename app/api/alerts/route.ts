import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Alert, AlertType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RawRow {
  id: string;
  type: AlertType | null;
  status: "warning" | "overdue";
  fired_at: string;
  deadline: string;
  last_seen_at: string;
  snoozed_until: string | null;
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
  task: {
    id: string;
    title: string | null;
  } | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("sla_alerts")
    .select(
      `id, type, status, fired_at, deadline, last_seen_at, snoozed_until,
       cliente:clientes_cadastro!inner(id, nomecliente, nome, responsavel_atendimento),
       stage:client_pipeline_stages(id, name, slug, color),
       task:production_tasks(id, title)`,
    )
    .is("resolved_at", null)
    .or(`snoozed_until.is.null,snoozed_until.lt.${nowIso}`)
    .order("status", { ascending: false })
    .order("fired_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data as unknown as RawRow[]) ?? [];
  const profileIds = [
    ...new Set(
      rows
        .map((r) => r.cliente?.responsavel_atendimento)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id,full_name").in("id", profileIds)
    : { data: [] };
  const profileById = new Map(
    ((profiles as ProfileRow[] | null) ?? []).map((profile) => [
      profile.id,
      profile,
    ]),
  );

  const alerts: Alert[] = rows
    .filter((r) => r.cliente)
    .map((r) => {
      const responsavelId = r.cliente!.responsavel_atendimento;
      const responsavel = responsavelId
        ? profileById.get(responsavelId) ?? null
        : null;

      return {
        id: r.id,
        type: (r.type ?? "stage_sla") as AlertType,
        status: r.status,
        firedAt: r.fired_at,
        deadline: r.deadline,
        lastSeenAt: r.last_seen_at,
        snoozedUntil: r.snoozed_until,
        cliente: {
          id: r.cliente!.id,
          nome: r.cliente!.nomecliente ?? r.cliente!.nome ?? "Sem nome",
          responsavelId,
          responsavelNome: responsavel?.full_name ?? null,
        },
        stage: r.stage
          ? {
              id: r.stage.id,
              name: r.stage.name ?? r.stage.slug ?? "",
              slug: r.stage.slug ?? "",
              color: r.stage.color ?? "#64748b",
            }
          : null,
        task: r.task
          ? {
              id: r.task.id,
              title: r.task.title,
            }
          : null,
      };
    });

  return NextResponse.json({ alerts });
}
