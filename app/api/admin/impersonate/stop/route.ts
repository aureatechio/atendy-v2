import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { roleHasCapability } from "@/lib/auth/capabilities";
import { IMPERSONATION_COOKIE, decodeImpersonationCookie } from "@/lib/auth/impersonation";

export async function POST() {
  const cookieStore = await cookies();
  const payload = decodeImpersonationCookie(cookieStore.get(IMPERSONATION_COOKIE)?.value);

  if (!payload) {
    return NextResponse.json({ error: "Nenhuma impersonacao ativa." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: devAuth, error: devError }, { data: devProfile }] = await Promise.all([
    admin.auth.admin.getUserById(payload.impersonatorId),
    admin.from("profiles").select("role, status").eq("id", payload.impersonatorId).maybeSingle(),
  ]);

  const supabase = await createClient();

  // Re-verify the original account is still a Dev in good standing before restoring it.
  if (
    devError ||
    !devAuth?.user?.email ||
    !devProfile ||
    devProfile.status !== "active" ||
    !roleHasCapability(devProfile.role, "impersonate")
  ) {
    cookieStore.delete(IMPERSONATION_COOKIE);
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Conta original indisponivel. Faca login novamente." }, { status: 403 });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: devAuth.user.email,
  });

  if (linkError || !linkData.properties?.hashed_token) {
    return NextResponse.json({ error: "Nao foi possivel voltar para sua conta." }, { status: 500 });
  }

  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });

  if (otpError) {
    return NextResponse.json({ error: "Nao foi possivel voltar para sua conta." }, { status: 500 });
  }

  cookieStore.delete(IMPERSONATION_COOKIE);
  return NextResponse.json({ ok: true });
}
