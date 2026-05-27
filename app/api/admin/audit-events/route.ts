import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAccess } from "@/lib/auth/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const auditColumns =
  "id,actor_user_id,actor_email_snapshot,actor_role_snapshot,actor_source,action,entity_type,entity_id,cliente_id,status,before,after,diff,metadata,operation_id,request_path,user_agent,error_message,created_at";
const clienteColumns = "id,code,nomecliente,nome,email,company_cnpj,whatsapp";
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ClienteSummary = {
  code: string | null;
  company_cnpj: string | null;
  email: string | null;
  id: string;
  nome: string | null;
  nomecliente: string | null;
  whatsapp: string | null;
};

type AuditRow = {
  action: string;
  actor_email_snapshot: string | null;
  actor_role_snapshot: string | null;
  actor_source: string;
  actor_user_id: string | null;
  after: unknown;
  before: unknown;
  cliente_id: string | null;
  created_at: string;
  diff: unknown;
  entity_id: string | null;
  entity_type: string;
  error_message: string | null;
  id: string;
  metadata: unknown;
  operation_id: string | null;
  request_path: string | null;
  status: string;
  user_agent: string | null;
};

function cleanSearch(value: string) {
  return value.replace(/[%,()]/g, " ").trim();
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(1, Math.floor(parsed)), max);
}

function dateStart(value: string | null) {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00.000-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dateEnd(value: string | null) {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : `${value}T23:59:59.999-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function resolveClienteIds(admin: ReturnType<typeof createAdminClient>, raw: string) {
  const value = raw.trim();
  if (!value) return { ids: null as string[] | null, matches: [] as ClienteSummary[] };
  if (uuidRegex.test(value)) return { ids: [value], matches: [] as ClienteSummary[] };

  const term = cleanSearch(value);
  const digits = digitsOnly(value);
  if (!term && !digits) return { ids: [] as string[], matches: [] as ClienteSummary[] };

  const filters = [
    term ? `code.ilike.%${term}%` : null,
    term ? `nomecliente.ilike.%${term}%` : null,
    term ? `nome.ilike.%${term}%` : null,
    term ? `email.ilike.%${term}%` : null,
    term ? `company_cnpj.ilike.%${term}%` : null,
    digits ? `whatsapp.ilike.%${digits}%` : null,
  ].filter(Boolean);

  const { data, error } = await admin
    .from("clientes_cadastro")
    .select(clienteColumns)
    .or(filters.join(","))
    .limit(50);

  if (error) throw new Error(error.message);
  const matches = ((data ?? []) as ClienteSummary[]);
  return { ids: matches.map((cliente) => cliente.id), matches };
}

export async function GET(request: Request) {
  const access = await requireAdminAccess({ capability: "auditArea" });
  if (access.error) return access.error;

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1, 10_000);
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 25, 100);
  const from = dateStart(url.searchParams.get("from"));
  const to = dateEnd(url.searchParams.get("to"));
  const action = cleanSearch(url.searchParams.get("action") ?? "");
  const actor = cleanSearch(url.searchParams.get("actor") ?? "");
  const operationId = url.searchParams.get("operation_id")?.trim() ?? "";
  const clienteSearch = url.searchParams.get("cliente")?.trim() ?? "";

  const admin = createAdminClient();
  let clienteMatches: ClienteSummary[] = [];
  let clienteIds: string[] | null = null;

  try {
    if (clienteSearch) {
      const resolved = await resolveClienteIds(admin, clienteSearch);
      clienteIds = resolved.ids;
      clienteMatches = resolved.matches;
      if (clienteIds && clienteIds.length === 0) {
        return NextResponse.json({
          clienteMatches,
          events: [],
          page,
          pageSize,
          total: 0,
        });
      }
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel resolver cliente." },
      { status: 400 },
    );
  }

  const fromIndex = (page - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;
  let query = admin
    .from("audit_events")
    .select(auditColumns, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(fromIndex, toIndex);

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  if (action) query = query.ilike("action", `%${action}%`);
  if (uuidRegex.test(operationId)) query = query.eq("operation_id", operationId);
  if (clienteIds?.length) query = query.in("cliente_id", clienteIds);
  if (actor) {
    query = uuidRegex.test(actor)
      ? query.eq("actor_user_id", actor)
      : query.or(`actor_email_snapshot.ilike.%${actor}%,actor_role_snapshot.ilike.%${actor}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as AuditRow[]);
  const ids = Array.from(new Set(rows.map((row) => row.cliente_id).filter((id): id is string => Boolean(id))));
  const { data: clientes } = ids.length
    ? await admin.from("clientes_cadastro").select(clienteColumns).in("id", ids)
    : { data: [] };
  const clienteById = new Map(((clientes ?? []) as ClienteSummary[]).map((cliente) => [cliente.id, cliente]));

  return NextResponse.json({
    clienteMatches,
    events: rows.map((row) => ({
      ...row,
      actor: {
        email: row.actor_email_snapshot,
        id: row.actor_user_id,
        role: row.actor_role_snapshot,
        source: row.actor_source,
      },
      cliente: row.cliente_id ? (clienteById.get(row.cliente_id) ?? null) : null,
    })),
    page,
    pageSize,
    total: count ?? 0,
  });
}
