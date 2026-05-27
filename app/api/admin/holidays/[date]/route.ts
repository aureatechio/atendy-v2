import { NextResponse } from "next/server";
import { createAuditOperationId, getAuditActor, logAuditEvent } from "@/lib/audit/logger";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAccess } from "@/lib/auth/requireAdmin";
import { updateHolidaySchema } from "@/lib/sla/validation";

const holidayColumns = "date, description, scope, created_at";
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(request: Request, { params }: { params: Promise<{ date: string }> }) {
  const access = await requireAdminAccess();
  if (access.error) return access.error;

  const { date } = await params;
  if (!dateRegex.test(date)) {
    return NextResponse.json({ error: "Data invalida (YYYY-MM-DD)." }, { status: 400 });
  }

  const parsed = updateHolidaySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados invalidos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const operationId = createAuditOperationId();
  const [actor, context] = await Promise.all([getAuditActor(access.user), getAuditRequestContext()]);
  const { data: beforeHoliday } = await admin.from("business_holidays").select(holidayColumns).eq("date", date).maybeSingle();
  const { data, error } = await admin
    .from("business_holidays")
    .update(parsed.data)
    .eq("date", date)
    .select(holidayColumns)
    .single();

  if (error || !data) {
    await logAuditEvent({
      action: "settings.holiday_updated",
      actor,
      before: beforeHoliday ?? null,
      context,
      entityType: "business_holiday",
      errorMessage: error?.message ?? "Nao foi possivel atualizar o feriado.",
      metadata: { date },
      operationId,
      status: "failure",
    });
    return NextResponse.json({ error: error?.message ?? "Nao foi possivel atualizar o feriado." }, { status: 400 });
  }

  await logAuditEvent({
    action: "settings.holiday_updated",
    actor,
    after: data,
    before: beforeHoliday ?? null,
    context,
    entityType: "business_holiday",
    metadata: { date },
    operationId,
  });

  return NextResponse.json({ holiday: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ date: string }> }) {
  const access = await requireAdminAccess();
  if (access.error) return access.error;

  const { date } = await params;
  if (!dateRegex.test(date)) {
    return NextResponse.json({ error: "Data invalida (YYYY-MM-DD)." }, { status: 400 });
  }

  const admin = createAdminClient();
  const operationId = createAuditOperationId();
  const [actor, context] = await Promise.all([getAuditActor(access.user), getAuditRequestContext()]);
  const { data: beforeHoliday } = await admin.from("business_holidays").select(holidayColumns).eq("date", date).maybeSingle();
  const { error } = await admin.from("business_holidays").delete().eq("date", date);

  if (error) {
    await logAuditEvent({
      action: "settings.holiday_deleted",
      actor,
      before: beforeHoliday ?? null,
      context,
      entityType: "business_holiday",
      errorMessage: error.message,
      metadata: { date },
      operationId,
      status: "failure",
    });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAuditEvent({
    action: "settings.holiday_deleted",
    actor,
    before: beforeHoliday ?? null,
    context,
    entityType: "business_holiday",
    metadata: { date },
    operationId,
  });

  return NextResponse.json({ ok: true });
}
