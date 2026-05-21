import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/auth/requireAdmin";
import { createHolidaySchema } from "@/lib/sla/validation";

const holidayColumns = "date, description, scope, created_at";

export async function GET() {
  const access = await requireAdminAccess({ capability: "adminArea" });
  if (access.error) return access.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_holidays")
    .select(holidayColumns)
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Nao foi possivel listar feriados." }, { status: 500 });
  }

  return NextResponse.json({ holidays: data ?? [] });
}

export async function POST(request: Request) {
  const access = await requireAdminAccess();
  if (access.error) return access.error;

  const parsed = createHolidaySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados invalidos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("business_holidays")
    .insert(parsed.data)
    .select(holidayColumns)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Nao foi possivel criar o feriado." }, { status: 400 });
  }

  return NextResponse.json({ holiday: data });
}
