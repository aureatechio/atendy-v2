import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Alert, AlertType } from "@/lib/types";
import {
  ALERT_SELECT,
  canAccessAlertRecord,
  getAlertAuthContext,
  materializeAlertNotifications,
  type AlertRecordRow,
} from "@/lib/alerts/server";
import {
  isNotificationVisible,
  shouldToastNotification,
} from "@/lib/alerts/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

interface ProfileRow {
  id: string;
  full_name: string | null;
}

async function fetchAlertsPage(
  admin: SupabaseClient,
  from: number,
  to: number,
) {
  return admin
    .from("sla_alerts")
    .select(ALERT_SELECT)
    .is("resolved_at", null)
    .order("status", { ascending: false })
    .order("fired_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);
}

export async function GET() {
  const auth = await getAlertAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { admin, profile, user } = auth.context;
  const now = new Date();
  const rows: AlertRecordRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchAlertsPage(
      admin,
      from,
      from + PAGE_SIZE - 1,
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const page = ((data as unknown as AlertRecordRow[]) ?? []);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const visibleRows = rows.filter((row) => canAccessAlertRecord(profile, row));
  const { notifications, error: notificationError } =
    await materializeAlertNotifications(
      admin,
      user.id,
      visibleRows.map((row) => row.id),
      now,
    );
  if (notificationError) {
    return NextResponse.json({ error: notificationError }, { status: 500 });
  }

  const activeRows = visibleRows.filter((row) => {
    const notification = notifications.get(row.id);
    return notification ? isNotificationVisible(notification, now) : false;
  });

  const profileIds = [
    ...new Set(
      activeRows
        .flatMap((r) => [
          r.cliente?.responsavel_atendimento,
          r.cliente?.assigned_to,
        ])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: profiles } = profileIds.length
    ? await admin.from("profiles").select("id,full_name").in("id", profileIds)
    : { data: [] };
  const profileById = new Map(
    ((profiles as ProfileRow[] | null) ?? []).map((profile) => [
      profile.id,
      profile,
    ]),
  );

  const alerts: Alert[] = activeRows
    .filter((r) => r.cliente)
    .map((r) => {
      const notification = notifications.get(r.id)!;
      const responsavelAtendimentoId = r.cliente!.responsavel_atendimento;
      const assignedToId = r.cliente!.assigned_to;
      const responsavelId = responsavelAtendimentoId ?? assignedToId;
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
        snoozedUntil: notification.snoozed_until,
        cliente: {
          id: r.cliente!.id,
          nome: r.cliente!.nomecliente ?? r.cliente!.nome ?? "Sem nome",
          responsavelId,
          responsavelNome: responsavel?.full_name ?? null,
        },
        assignment: {
          responsavelAtendimentoId,
          assignedToId,
        },
        notification: {
          id: notification.id,
          state: notification.state,
          snoozedUntil: notification.snoozed_until,
          lastShownAt: notification.last_shown_at,
          nextToastAt: notification.next_toast_at,
          shouldToast: shouldToastNotification(notification, now),
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
