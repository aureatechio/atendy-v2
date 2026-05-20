import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCrmServiceRoleKey, getCrmSupabaseUrl } from "@/lib/supabase/env";

export function createCrmClient() {
  return createSupabaseClient(getCrmSupabaseUrl(), getCrmServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
