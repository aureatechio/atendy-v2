import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/auth/types";

export const profileSelectColumns =
  "id, full_name, avatar_url, role, status, created_at, updated_at";

export type AuthUserSummary = {
  id: string;
  email: string | null;
};

export type AuthSnapshot =
  | { status: "anonymous"; user: null; profile: null }
  | { status: "active"; user: AuthUserSummary; profile: Profile }
  | { status: "pending"; user: AuthUserSummary; profile: Profile }
  | { status: "blocked"; user: AuthUserSummary; profile: Profile }
  | { status: "profile_missing"; user: AuthUserSummary; profile: null };

export type ActiveAuthSnapshot = Extract<AuthSnapshot, { status: "active" }>;

export function summarizeAuthUser(user: Pick<User, "id" | "email">): AuthUserSummary {
  return {
    id: user.id,
    email: user.email ?? null,
  };
}
