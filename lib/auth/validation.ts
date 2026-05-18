import { z } from "zod";

export const roleOptions = ["admin", "supervisor", "producao", "attendant"] as const;
export const statusOptions = ["pending", "active", "blocked"] as const;

export const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
  password: z.string().min(1, "Informe a senha."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
    confirmPassword: z.string().min(8, "Confirme a senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  });

export const createAdminUserSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  full_name: z.string().trim().min(2, "Informe o nome."),
  role: z.enum(roleOptions).default("producao"),
  status: z.enum(statusOptions).default("active"),
});

export const updateAdminUserSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(2).optional(),
  role: z.enum(roleOptions).optional(),
  status: z.enum(statusOptions).optional(),
});
