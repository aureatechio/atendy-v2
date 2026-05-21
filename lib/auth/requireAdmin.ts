import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { roleHasCapability, type Capability } from "@/lib/auth/capabilities";

type AdminAccessOptions = {
  capability?: Capability;
};

type AdminAccessFailure = { error: NextResponse; user?: never };
type AdminAccessSuccess = { user: { id: string; email?: string | null }; error?: never };

export async function requireAdminAccess(options: AdminAccessOptions = {}): Promise<AdminAccessFailure | AdminAccessSuccess> {
  const supabase = await createClient();
  const capability = options.capability ?? "adminOnly";
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: NextResponse.json({ error: "Nao autenticado." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active" || !roleHasCapability(profile.role, capability)) {
    return { error: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
  }

  return { user };
}
