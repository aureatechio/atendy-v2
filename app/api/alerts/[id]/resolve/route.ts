import { NextResponse } from "next/server";
import {
  fetchAccessibleAlertById,
  getAlertAuthContext,
  resolveAlertForUser,
} from "@/lib/alerts/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await getAlertAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const alert = await fetchAccessibleAlertById(auth.context, id);
  if (!alert.ok) {
    return NextResponse.json({ error: alert.error }, { status: alert.status });
  }

  const result = await resolveAlertForUser(auth.context, alert.alert);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
