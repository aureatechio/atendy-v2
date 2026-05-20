import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_HOURS = 24;
const MAX_HOURS = 24 * 30;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let hours = DEFAULT_HOURS;
  try {
    const body = (await req.json()) as { hours?: unknown } | null;
    if (body && typeof body.hours === "number" && Number.isFinite(body.hours)) {
      hours = Math.min(Math.max(1, Math.floor(body.hours)), MAX_HOURS);
    }
  } catch {
    /* body opcional */
  }

  const snoozedUntil = new Date(Date.now() + hours * 3_600_000).toISOString();

  const { error } = await supabase
    .from("sla_alerts")
    .update({ snoozed_until: snoozedUntil })
    .eq("id", id)
    .is("resolved_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, snoozedUntil });
}
