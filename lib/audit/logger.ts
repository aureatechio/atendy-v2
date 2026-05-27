import { createAdminClient } from "@/lib/supabase/admin";

export type AuditActorSource = "user" | "system" | "service";
export type AuditEventStatus = "success" | "failure";

export type AuditJsonObject = Record<string, unknown>;

export interface AuditActor {
  id: string | null;
  email: string | null;
  role: string | null;
  source: AuditActorSource;
}

export interface AuditUserIdentity {
  id: string;
  email?: string | null;
}

export interface AuditRequestContext {
  requestPath?: string | null;
  userAgent?: string | null;
}

export interface AuditEventInput {
  action: string;
  actor?: AuditActor | null;
  after?: AuditJsonObject | null;
  before?: AuditJsonObject | null;
  clienteId?: string | null;
  context?: AuditRequestContext | null;
  entityId?: string | null;
  entityType: string;
  errorMessage?: string | null;
  metadata?: AuditJsonObject | null;
  operationId?: string | null;
  status?: AuditEventStatus;
}

export interface AuditEventRow {
  action: string;
  actor_email_snapshot: string | null;
  actor_role_snapshot: string | null;
  actor_source: AuditActorSource;
  actor_user_id: string | null;
  after: unknown;
  before: unknown;
  cliente_id: string | null;
  diff: unknown;
  entity_id: string | null;
  entity_type: string;
  error_message: string | null;
  metadata: unknown;
  operation_id: string | null;
  request_path: string | null;
  status: AuditEventStatus;
  user_agent: string | null;
}

type SupabaseInsertResult = {
  error: { message: string } | null;
};

const REDACTED = "[REDACTED]";
const sensitiveKeyPattern = /(password|token|secret|service_role)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function valuesEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function sanitizeAuditValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditValue(item));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) ? REDACTED : sanitizeAuditValue(item),
    ]),
  );
}

export function buildAuditDiff(
  before: AuditJsonObject | null | undefined,
  after: AuditJsonObject | null | undefined,
) {
  const safeBefore = sanitizeAuditValue(before ?? {}) as AuditJsonObject;
  const safeAfter = sanitizeAuditValue(after ?? {}) as AuditJsonObject;
  const keys = new Set([...Object.keys(safeBefore), ...Object.keys(safeAfter)]);
  const diff: Record<string, { before: unknown; after: unknown }> = {};

  for (const key of keys) {
    const beforeValue = safeBefore[key] ?? null;
    const afterValue = safeAfter[key] ?? null;
    if (!valuesEqual(beforeValue, afterValue)) {
      diff[key] = {
        after: afterValue,
        before: beforeValue,
      };
    }
  }

  return diff;
}

export function toAuditRow(input: AuditEventInput): AuditEventRow {
  const actor = input.actor ?? null;
  const before = input.before ? sanitizeAuditValue(input.before) : null;
  const after = input.after ? sanitizeAuditValue(input.after) : null;
  const metadata = sanitizeAuditValue(input.metadata ?? {});
  const diff = input.before || input.after ? buildAuditDiff(input.before, input.after) : null;

  return {
    action: input.action,
    actor_email_snapshot: actor?.email ?? null,
    actor_role_snapshot: actor?.role ?? null,
    actor_source: actor?.source ?? "user",
    actor_user_id: actor?.id ?? null,
    after,
    before,
    cliente_id: input.clienteId ?? null,
    diff,
    entity_id: input.entityId ?? null,
    entity_type: input.entityType,
    error_message: input.errorMessage ?? null,
    metadata,
    operation_id: input.operationId ?? null,
    request_path: input.context?.requestPath ?? null,
    status: input.status ?? "success",
    user_agent: input.context?.userAgent ?? null,
  };
}

export async function getAuditActor(user: AuditUserIdentity): Promise<AuditActor> {
  let role: string | null = null;

  try {
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    role = isRecord(data) && typeof data.role === "string" ? data.role : null;
  } catch (error) {
    console.error("Falha ao carregar snapshot do ator de auditoria:", error);
  }

  return {
    email: user.email ?? null,
    id: user.id,
    role,
    source: "user",
  };
}

export async function logAuditEvents(inputs: AuditEventInput[]) {
  if (inputs.length === 0) return { ok: true };

  const admin = createAdminClient();
  const rows = inputs.map(toAuditRow);
  const { error } = (await admin.from("audit_events").insert(rows)) as SupabaseInsertResult;

  if (error) {
    console.error("Falha ao registrar audit_events:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function logAuditEvent(input: AuditEventInput) {
  return logAuditEvents([input]);
}
