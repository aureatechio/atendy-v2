import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AlertType } from "@/lib/types";
import {
  canAccessAlertForCliente,
  type AlertVisibilityProfile,
} from "@/lib/alerts/visibility";
import {
  computeReminderUntil,
  type AlertAction,
  type AlertNotificationState,
  type ReminderOption,
} from "@/lib/alerts/notifications";

export interface AlertAuthContext {
  admin: SupabaseClient;
  user: User;
  profile: AlertVisibilityProfile;
}

export interface AlertClienteRow {
  id: string;
  nomecliente: string | null;
  nome: string | null;
  responsavel_atendimento: string | null;
  assigned_to: string | null;
}

export interface AlertStageRow {
  id: string;
  name: string | null;
  slug: string | null;
  color: string | null;
}

export interface AlertTaskRow {
  id: string;
  title: string | null;
}

export interface AlertRecordRow {
  id: string;
  type: AlertType | null;
  status: "warning" | "overdue";
  fired_at: string;
  deadline: string;
  last_seen_at: string;
  snoozed_until: string | null;
  cliente: AlertClienteRow | null;
  stage: AlertStageRow | null;
  task: AlertTaskRow | null;
}

export interface AlertNotificationRow {
  id: string;
  alert_id: string;
  user_id: string;
  state: AlertNotificationState;
  first_shown_at: string | null;
  last_shown_at: string | null;
  next_toast_at: string | null;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertActionLogInsert {
  alert_id: string;
  notification_id?: string | null;
  actor_user_id: string;
  action: AlertAction;
  previous_state?: AlertNotificationState | null;
  next_state?: AlertNotificationState | null;
  metadata?: Record<string, unknown>;
}

export const ALERT_SELECT = `id, type, status, fired_at, deadline, last_seen_at, snoozed_until,
  cliente:clientes_cadastro!inner(id, nomecliente, nome, responsavel_atendimento, assigned_to),
  stage:client_pipeline_stages(id, name, slug, color),
  task:production_tasks(id, title)`;

const NOTIFICATION_CHUNK_SIZE = 500;

interface ProfileRow {
  id: string;
  role: AlertVisibilityProfile["role"];
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function getAlertAuthContext(): Promise<
  | { ok: true; context: AlertAuthContext }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  if (!profile) {
    return { ok: false, status: 403, error: "Profile not found" };
  }

  return {
    ok: true,
    context: {
      admin,
      user,
      profile: profile as ProfileRow,
    },
  };
}

export function canAccessAlertRecord(
  profile: AlertVisibilityProfile,
  alert: AlertRecordRow,
) {
  return Boolean(
    alert.cliente && canAccessAlertForCliente(profile, alert.cliente),
  );
}

export async function fetchAccessibleAlertById(
  context: AlertAuthContext,
  alertId: string,
): Promise<
  | { ok: true; alert: AlertRecordRow }
  | { ok: false; status: number; error: string }
> {
  const { data, error } = await context.admin
    .from("sla_alerts")
    .select(ALERT_SELECT)
    .eq("id", alertId)
    .is("resolved_at", null)
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: error.message };
  if (!data) return { ok: false, status: 404, error: "Alert not found" };

  const alert = data as unknown as AlertRecordRow;
  if (!canAccessAlertRecord(context.profile, alert)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, alert };
}

async function insertAlertActionLogs(
  admin: SupabaseClient,
  logs: AlertActionLogInsert[],
) {
  if (logs.length === 0) return null;
  for (const chunk of chunkArray(logs, NOTIFICATION_CHUNK_SIZE)) {
    const { error } = await admin.from("alert_action_logs").insert(
      chunk.map((log) => ({
        alert_id: log.alert_id,
        notification_id: log.notification_id ?? null,
        actor_user_id: log.actor_user_id,
        action: log.action,
        previous_state: log.previous_state ?? null,
        next_state: log.next_state ?? null,
        metadata: log.metadata ?? {},
      })),
    );
    if (error) return error;
  }
  return null;
}

export async function materializeAlertNotifications(
  admin: SupabaseClient,
  userId: string,
  alertIds: string[],
  now = new Date(),
): Promise<{ notifications: Map<string, AlertNotificationRow>; error: string | null }> {
  const uniqueAlertIds = [...new Set(alertIds)];
  const notifications = new Map<string, AlertNotificationRow>();
  if (uniqueAlertIds.length === 0) {
    return { notifications, error: null };
  }

  for (const alertIdChunk of chunkArray(uniqueAlertIds, NOTIFICATION_CHUNK_SIZE)) {
    const { data: existing, error: existingError } = await admin
      .from("alert_notifications")
      .select("*")
      .eq("user_id", userId)
      .in("alert_id", alertIdChunk);

    if (existingError) {
      return { notifications, error: existingError.message };
    }

    for (const row of ((existing as AlertNotificationRow[] | null) ?? [])) {
      notifications.set(row.alert_id, row);
    }
  }

  const missingAlertIds = uniqueAlertIds.filter((id) => !notifications.has(id));
  if (missingAlertIds.length > 0) {
    const createdRows: AlertNotificationRow[] = [];
    for (const missingChunk of chunkArray(missingAlertIds, NOTIFICATION_CHUNK_SIZE)) {
      const { data: created, error: createdError } = await admin
        .from("alert_notifications")
        .insert(
          missingChunk.map((alertId) => ({
            alert_id: alertId,
            user_id: userId,
            state: "pending",
          })),
        )
        .select("*");

      if (createdError) {
        return { notifications, error: createdError.message };
      }
      createdRows.push(...((created as AlertNotificationRow[] | null) ?? []));
    }

    for (const row of createdRows) {
      notifications.set(row.alert_id, row);
    }

    const logError = await insertAlertActionLogs(
      admin,
      createdRows.map((row) => ({
        alert_id: row.alert_id,
        notification_id: row.id,
        actor_user_id: userId,
        action: "notification_created",
        previous_state: null,
        next_state: "pending",
      })),
    );
    if (logError) return { notifications, error: logError.message };
  }

  const nowIso = now.toISOString();
  const dueSnoozed = [...notifications.values()].filter((row) => {
    if (row.state !== "snoozed" || !row.snoozed_until) return false;
    return new Date(row.snoozed_until).getTime() <= now.getTime();
  });

  if (dueSnoozed.length > 0) {
    const reopenedRows: AlertNotificationRow[] = [];
    for (const dueChunk of chunkArray(dueSnoozed, NOTIFICATION_CHUNK_SIZE)) {
      const { data: reopened, error: reopenError } = await admin
        .from("alert_notifications")
        .update({
          state: "pending",
          snoozed_until: null,
          next_toast_at: null,
          updated_at: nowIso,
        })
        .in(
          "id",
          dueChunk.map((row) => row.id),
        )
        .select("*");

      if (reopenError) return { notifications, error: reopenError.message };
      reopenedRows.push(...((reopened as AlertNotificationRow[] | null) ?? []));
    }

    for (const row of reopenedRows) {
      notifications.set(row.alert_id, row);
    }

    const logError = await insertAlertActionLogs(
      admin,
      reopenedRows.map((row) => ({
        alert_id: row.alert_id,
        notification_id: row.id,
        actor_user_id: userId,
        action: "auto_reopened",
        previous_state: "snoozed",
        next_state: "pending",
      })),
    );
    if (logError) return { notifications, error: logError.message };
  }

  return { notifications, error: null };
}

export async function ensureAlertNotification(
  admin: SupabaseClient,
  userId: string,
  alertId: string,
  now = new Date(),
) {
  const { notifications, error } = await materializeAlertNotifications(
    admin,
    userId,
    [alertId],
    now,
  );
  return { notification: notifications.get(alertId) ?? null, error };
}

export async function remindAlertForUser(
  context: AlertAuthContext,
  alert: AlertRecordRow,
  reminder: ReminderOption,
  now = new Date(),
) {
  const { notification, error } = await ensureAlertNotification(
    context.admin,
    context.user.id,
    alert.id,
    now,
  );
  if (error) return { ok: false as const, status: 500, error };
  if (!notification) {
    return { ok: false as const, status: 500, error: "Notification not found" };
  }

  const previousState = notification.state;
  const snoozedUntil = computeReminderUntil(reminder, now).toISOString();
  const { data, error: updateError } = await context.admin
    .from("alert_notifications")
    .update({
      state: "snoozed",
      snoozed_until: snoozedUntil,
      next_toast_at: snoozedUntil,
      updated_at: now.toISOString(),
    })
    .eq("id", notification.id)
    .select("*")
    .single();

  if (updateError) {
    return { ok: false as const, status: 500, error: updateError.message };
  }

  const updated = data as AlertNotificationRow;
  const logError = await insertAlertActionLogs(context.admin, [
    {
      alert_id: alert.id,
      notification_id: updated.id,
      actor_user_id: context.user.id,
      action: "reminded",
      previous_state: previousState,
      next_state: "snoozed",
      metadata: {
        reminder,
        snoozedUntil,
        alertType: alert.type ?? "stage_sla",
        alertStatus: alert.status,
        clienteId: alert.cliente?.id ?? null,
        clienteNome: alert.cliente?.nomecliente ?? alert.cliente?.nome ?? null,
      },
    },
  ]);
  if (logError) {
    return { ok: false as const, status: 500, error: logError.message };
  }

  return { ok: true as const, notification: updated, snoozedUntil };
}

export async function snoozeAlertForUserUntil(
  context: AlertAuthContext,
  alert: AlertRecordRow,
  snoozedUntil: string,
  metadata: Record<string, unknown>,
  now = new Date(),
) {
  const { notification, error } = await ensureAlertNotification(
    context.admin,
    context.user.id,
    alert.id,
    now,
  );
  if (error) return { ok: false as const, status: 500, error };
  if (!notification) {
    return { ok: false as const, status: 500, error: "Notification not found" };
  }

  const previousState = notification.state;
  const { data, error: updateError } = await context.admin
    .from("alert_notifications")
    .update({
      state: "snoozed",
      snoozed_until: snoozedUntil,
      next_toast_at: snoozedUntil,
      updated_at: now.toISOString(),
    })
    .eq("id", notification.id)
    .select("*")
    .single();

  if (updateError) {
    return { ok: false as const, status: 500, error: updateError.message };
  }

  const updated = data as AlertNotificationRow;
  const logError = await insertAlertActionLogs(context.admin, [
    {
      alert_id: alert.id,
      notification_id: updated.id,
      actor_user_id: context.user.id,
      action: "reminded",
      previous_state: previousState,
      next_state: "snoozed",
      metadata: {
        ...metadata,
        snoozedUntil,
        alertType: alert.type ?? "stage_sla",
        alertStatus: alert.status,
        clienteId: alert.cliente?.id ?? null,
        clienteNome: alert.cliente?.nomecliente ?? alert.cliente?.nome ?? null,
      },
    },
  ]);
  if (logError) {
    return { ok: false as const, status: 500, error: logError.message };
  }

  return { ok: true as const, notification: updated, snoozedUntil };
}

export async function resolveAlertForUser(
  context: AlertAuthContext,
  alert: AlertRecordRow,
  now = new Date(),
) {
  const { notification, error } = await ensureAlertNotification(
    context.admin,
    context.user.id,
    alert.id,
    now,
  );
  if (error) return { ok: false as const, status: 500, error };
  if (!notification) {
    return { ok: false as const, status: 500, error: "Notification not found" };
  }

  const nowIso = now.toISOString();
  const { error: alertError } = await context.admin
    .from("sla_alerts")
    .update({ resolved_at: nowIso, resolved_by: context.user.id })
    .eq("id", alert.id)
    .is("resolved_at", null);

  if (alertError) {
    return { ok: false as const, status: 500, error: alertError.message };
  }

  const { error: notificationError } = await context.admin
    .from("alert_notifications")
    .update({
      state: "resolved",
      snoozed_until: null,
      next_toast_at: null,
      updated_at: nowIso,
    })
    .eq("alert_id", alert.id);

  if (notificationError) {
    return { ok: false as const, status: 500, error: notificationError.message };
  }

  const logError = await insertAlertActionLogs(context.admin, [
    {
      alert_id: alert.id,
      notification_id: notification.id,
      actor_user_id: context.user.id,
      action: "resolved",
      previous_state: notification.state,
      next_state: "resolved",
      metadata: {
        alertType: alert.type ?? "stage_sla",
        alertStatus: alert.status,
        clienteId: alert.cliente?.id ?? null,
        clienteNome: alert.cliente?.nomecliente ?? alert.cliente?.nome ?? null,
      },
    },
  ]);
  if (logError) {
    return { ok: false as const, status: 500, error: logError.message };
  }

  return { ok: true as const };
}

export async function logVisibleAlertEvents(
  context: AlertAuthContext,
  alerts: AlertRecordRow[],
  action: Extract<AlertAction, "toast_shown" | "opened">,
  now = new Date(),
) {
  const alertIds = alerts.map((alert) => alert.id);
  const { notifications, error } = await materializeAlertNotifications(
    context.admin,
    context.user.id,
    alertIds,
    now,
  );
  if (error) return { ok: false as const, status: 500, error };

  if (action === "toast_shown") {
    const notificationIds = [...notifications.values()]
      .filter((row) => alertIds.includes(row.alert_id))
      .map((row) => row.id);
    if (notificationIds.length > 0) {
      const { error: updateError } = await context.admin
        .from("alert_notifications")
        .update({
          first_shown_at: now.toISOString(),
          last_shown_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .in("id", notificationIds)
        .is("first_shown_at", null);

      if (updateError) {
        return { ok: false as const, status: 500, error: updateError.message };
      }

      const { error: lastShownError } = await context.admin
        .from("alert_notifications")
        .update({
          last_shown_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .in("id", notificationIds);

      if (lastShownError) {
        return { ok: false as const, status: 500, error: lastShownError.message };
      }
    }
  }

  const logs: AlertActionLogInsert[] = [];
  for (const alert of alerts) {
    const notification = notifications.get(alert.id);
    if (!notification) continue;
    logs.push({
      alert_id: alert.id,
      notification_id: notification.id,
      actor_user_id: context.user.id,
      action,
      previous_state: notification.state,
      next_state: notification.state,
      metadata: {
        alertType: alert.type ?? "stage_sla",
        alertStatus: alert.status,
        clienteId: alert.cliente?.id ?? null,
        clienteNome: alert.cliente?.nomecliente ?? alert.cliente?.nome ?? null,
      },
    });
  }

  const logError = await insertAlertActionLogs(context.admin, logs);
  if (logError) return { ok: false as const, status: 500, error: logError.message };

  return { ok: true as const };
}
