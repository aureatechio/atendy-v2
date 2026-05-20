import { NextResponse } from "next/server";
import { GET as getAlerts } from "@/app/api/alerts/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** @deprecated mantido por compatibilidade — use `/api/alerts`. */
export async function GET() {
  const res = await getAlerts();
  if (!res.ok) return res;
  const body = (await res.json()) as { alerts?: unknown[] };
  return NextResponse.json({ alerts: body.alerts ?? [] });
}
