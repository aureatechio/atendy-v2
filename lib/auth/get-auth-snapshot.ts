import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth/types";
import { profileSelectColumns, summarizeAuthUser, type AuthSnapshot } from "@/lib/auth/session";

export const getAuthSnapshot = cache(async (): Promise<AuthSnapshot> => {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { status: "anonymous", user: null, profile: null };
  }

  const authUser = summarizeAuthUser(user);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(profileSelectColumns)
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { status: "profile_missing", user: authUser, profile: null };
  }

  const nextProfile = profile as Profile;

  if (nextProfile.status === "blocked") {
    return { status: "blocked", user: authUser, profile: nextProfile };
  }

  if (nextProfile.status === "pending") {
    return { status: "pending", user: authUser, profile: nextProfile };
  }

  return { status: "active", user: authUser, profile: nextProfile };
});
