import type { UserRole } from "@/lib/auth/types";

/**
 * Capabilities are the single source of truth for "who can access what".
 * Add a new capability here (and only here) when introducing a gated area
 * or operation. Consumers should never inline role arrays.
 */
export type Capability = "adminOnly" | "adminArea" | "csArea" | "settingsArea" | "auditArea" | "impersonate";

export const CAPABILITIES: Record<Capability, readonly UserRole[]> = {
  // Restricted to admin: mutations on admin-only resources.
  adminOnly: ["admin"],
  // Admin area (read + light ops). Supervisor can read.
  adminArea: ["admin", "supervisor"],
  // Customer Success area.
  csArea: ["admin", "dev", "cs_head"],
  // Configurações (etapas, SLAs, feriados): Admin + CS + Dev podem ler e editar.
  settingsArea: ["admin", "dev", "cs_head"],
  // Auditoria central: restrita a quem pode investigar eventos sensíveis.
  auditArea: ["admin", "dev"],
  // Impersonação: somente Dev pode entrar como qualquer usuário do sistema.
  impersonate: ["dev"],
} as const;

export function roleHasCapability(role: UserRole, capability: Capability): boolean {
  return CAPABILITIES[capability].includes(role);
}
