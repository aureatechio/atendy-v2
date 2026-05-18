import { NextResponse } from "next/server";
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
  const { data, error } = await admin
    .from("business_holidays")
    .update(parsed.data)
    .eq("date", date)
    .select(holidayColumns)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Nao foi possivel atualizar o feriado." }, { status: 400 });
  }

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
  const { error } = await admin.from("business_holidays").delete().eq("date", date);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
