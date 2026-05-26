import { z } from "zod";

export const slaUnitOptions = ["business_days", "business_hours", "calendar_hours"] as const;

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

export const createStageSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  slug: z
    .string()
    .trim()
    .min(2, "Informe o slug.")
    .regex(slugRegex, "Slug deve usar letras minúsculas, números e hífens."),
  color: z.string().regex(hexColorRegex, "Cor deve ser hex (#RRGGBB).").default("#64748b"),
  order_index: z.number().int().min(0).default(0),
  is_final: z.boolean().default(false),
  is_active: z.boolean().default(true),
  parent_stage_id: z.string().uuid().nullable().default(null),
  sla_amount: z.number().int().positive().nullable().default(null),
  sla_unit: z.enum(slaUnitOptions).default("business_days"),
  warn_at_percent: z.number().int().min(1).max(100).default(80),
  followup_days: z.number().int().positive().nullable().default(null),
});

export const updateStageSchema = z.object({
  name: z.string().trim().min(2).optional(),
  slug: z.string().trim().min(2).regex(slugRegex).optional(),
  color: z.string().regex(hexColorRegex).optional(),
  order_index: z.number().int().min(0).optional(),
  is_final: z.boolean().optional(),
  is_active: z.boolean().optional(),
  parent_stage_id: z.string().uuid().nullable().optional(),
  sla_amount: z.number().int().positive().nullable().optional(),
  sla_unit: z.enum(slaUnitOptions).optional(),
  warn_at_percent: z.number().int().min(1).max(100).optional(),
  followup_days: z.number().int().positive().nullable().optional(),
});

export const reorderStagesSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().uuid(),
        order_index: z.number().int().min(0),
        parent_stage_id: z.string().uuid().nullable(),
      }),
    )
    .min(1, "Informe ao menos uma etapa para reordenar."),
});

export const migrateStageSchema = z.object({
  target_stage_id: z.string().uuid("Etapa de destino inválida."),
  reason: z.string().trim().max(500).optional(),
});

export const createHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD."),
  description: z.string().trim().min(2, "Informe a descrição."),
  scope: z.enum(["national", "regional", "company"]).default("national"),
});

export const updateHolidaySchema = z.object({
  description: z.string().trim().min(2).optional(),
  scope: z.enum(["national", "regional", "company"]).optional(),
});

export type CreateStageInput = z.infer<typeof createStageSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
export type ReorderStagesInput = z.infer<typeof reorderStagesSchema>;
export type MigrateStageInput = z.infer<typeof migrateStageSchema>;
export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
