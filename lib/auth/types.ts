export type UserRole = "admin" | "supervisor" | "attendant" | "producao" | "cs_head" | "dev" | "designer";
export type UserStatus = "pending" | "active" | "blocked";

export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

export type AdminUser = Profile & {
  email: string;
  auth_created_at: string | null;
  last_sign_in_at: string | null;
};
