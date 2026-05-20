export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  return url;
}

export function getSupabasePublicKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.");
  }

  return key;
}

export function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return key;
}

export function getCrmSupabaseUrl() {
  const url = process.env.CRM_SUPABASE_URL;

  if (!url) {
    throw new Error("CRM_SUPABASE_URL is not configured.");
  }

  return url;
}

export function getCrmServiceRoleKey() {
  const key = process.env.CRM_SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("CRM_SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return key;
}
