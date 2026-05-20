export type UserRole = "admin" | "supervisor" | "attendant" | "producao" | "cs_head" | "dev";
export type UserStatus = "pending" | "active" | "blocked";

export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  specialty: string | null;
  permissions: Record<string, boolean> | null;
  is_team_admin: boolean | null;
  autorizado_tirar_analise_ia: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminUser = Profile & {
  email: string;
  auth_created_at: string | null;
  last_sign_in_at: string | null;
};
