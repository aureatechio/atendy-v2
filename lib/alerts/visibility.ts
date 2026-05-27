import type { UserRole } from "@/lib/auth/types";

export interface AlertVisibilityProfile {
  id: string;
  role: UserRole;
}

export interface AlertVisibilityCliente {
  responsavel_atendimento: string | null;
  assigned_to: string | null;
}

export const ALERT_ASSIGNED_GLOBAL_ROLES: readonly UserRole[] = [
  "admin",
  "dev",
  "supervisor",
  "cs_head",
];

export const ALERT_UNASSIGNED_ROLES: readonly UserRole[] = [
  "admin",
  "supervisor",
];

export function canAccessAlertForCliente(
  profile: AlertVisibilityProfile,
  cliente: AlertVisibilityCliente,
) {
  const responsavelAtendimentoId = cliente.responsavel_atendimento;
  const assignedToId = cliente.assigned_to;
  const hasAnyResponsible = Boolean(responsavelAtendimentoId || assignedToId);

  if (!hasAnyResponsible) {
    return ALERT_UNASSIGNED_ROLES.includes(profile.role);
  }

  if (ALERT_ASSIGNED_GLOBAL_ROLES.includes(profile.role)) {
    return true;
  }

  return responsavelAtendimentoId === profile.id || assignedToId === profile.id;
}
