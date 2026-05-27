import {
  createAuditOperationId,
  mergeAuditMetadata,
  type AuditActorSource,
  type AuditJsonObject,
} from "@/lib/audit/logger";

type NullableId = string | null;

export interface ClientStageHistoryInput {
  actionType: string;
  changedBy?: NullableId;
  clienteId: string;
  fromAssignedTo?: NullableId;
  fromStageId?: NullableId;
  metadata?: AuditJsonObject | null;
  operationId?: string | null;
  reason?: string | null;
  toAssignedTo?: NullableId;
  toStageId?: NullableId;
}

export interface TaskHistoryInput {
  actionType: string;
  changedBy?: NullableId;
  clienteId?: NullableId;
  fieldName?: string | null;
  fromAssignedTo?: NullableId;
  fromStageId?: NullableId;
  metadata?: AuditJsonObject | null;
  newValue?: string | null;
  oldValue?: string | null;
  operationId?: string | null;
  taskId: string;
  toAssignedTo?: NullableId;
  toStageId?: NullableId;
}

function actorSource(changedBy: NullableId | undefined): AuditActorSource {
  return changedBy ? "user" : "service";
}

export function buildClientStageHistoryRow(input: ClientStageHistoryInput) {
  const operationId = input.operationId ?? createAuditOperationId();

  return {
    action_type: input.actionType,
    changed_by: input.changedBy ?? null,
    cliente_id: input.clienteId,
    from_assigned_to: input.fromAssignedTo ?? null,
    from_stage_id: input.fromStageId ?? null,
    metadata: mergeAuditMetadata(input.metadata, {
      actor_source: actorSource(input.changedBy),
      operation_id: operationId,
    }),
    operation_id: operationId,
    reason: input.reason ?? null,
    to_assigned_to: input.toAssignedTo ?? null,
    to_stage_id: input.toStageId ?? null,
  };
}

export function buildTaskHistoryRow(input: TaskHistoryInput) {
  const operationId = input.operationId ?? createAuditOperationId();

  return {
    action_type: input.actionType,
    changed_by: input.changedBy ?? null,
    cliente_id: input.clienteId ?? null,
    field_name: input.fieldName ?? null,
    from_assigned_to: input.fromAssignedTo ?? null,
    from_stage_id: input.fromStageId ?? null,
    metadata: mergeAuditMetadata(input.metadata, {
      actor_source: actorSource(input.changedBy),
      operation_id: operationId,
    }),
    new_value: input.newValue ?? null,
    old_value: input.oldValue ?? null,
    operation_id: operationId,
    task_id: input.taskId,
    to_assigned_to: input.toAssignedTo ?? null,
    to_stage_id: input.toStageId ?? null,
  };
}
