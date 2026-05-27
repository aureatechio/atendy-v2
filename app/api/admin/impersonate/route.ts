import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAccess } from "@/lib/auth/requireAdmin";
import {
  IMPERSONATION_COOKIE,
  decodeImpersonationCookie,
  encodeImpersonationCookie,
  impersonationCookieOptions,
} from "@/lib/auth/impersonation";
import type { Profile } from "@/lib/auth/types";

const startSchema = z.object({ userId: z.string().uuid() });

export async function GET() {
  const access = await requireAdminAccess({ capability: "impersonate" });

  if (access.error) {
    return access.error;
  }

  const admin = createAdminClient();
  const [{ data: profiles, error: profilesError }, { data: authData, error: authError }] = await Promise.all([
    admin.from("profiles").select("id, full_name, role, status").order("full_name", { ascending: true }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (profilesError || authError) {
    return NextResponse.json({ error: "Nao foi possivel listar usuarios." }, { status: 500 });
  }

  const emailById = new Map(authData.users.map((user) => [user.id, user.email ?? ""]));
  const users = ((profiles ?? []) as Pick<Profile, "id" | "full_name" | "role" | "status">[]).map((profile) => ({
    ...profile,
    email: emailById.get(profile.id) ?? "",
  }));

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const access = await requireAdminAccess({ capability: "impersonate" });

  if (access.error) {
    return access.error;
  }

  const cookieStore = await cookies();

  if (decodeImpersonationCookie(cookieStore.get(IMPERSONATION_COOKIE)?.value)) {
    return NextResponse.json(
      { error: "Ja existe uma impersonacao ativa. Volte para sua conta antes." },
      { status: 409 },
    );
  }

  const parsed = startSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const targetId = parsed.data.userId;

  if (targetId === access.user.id) {
    return NextResponse.json({ error: "Voce ja esta logado nesta conta." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: targetAuth, error: targetError }, { data: callerProfile }, { data: targetProfile }] =
    await Promise.all([
      admin.auth.admin.getUserById(targetId),
      admin.from("profiles").select("full_name").eq("id", access.user.id).maybeSingle(),
      admin.from("profiles").select("full_name, status").eq("id", targetId).maybeSingle(),
    ]);

  if (targetError || !targetAuth?.user?.email) {
    return NextResponse.json({ error: "Usuario alvo nao encontrado." }, { status: 404 });
  }

  if (!targetProfile || targetProfile.status !== "active") {
    return NextResponse.json({ error: "So e possivel impersonar usuarios ativos." }, { status: 400 });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: targetAuth.user.email,
  });

  if (linkError || !linkData.properties?.hashed_token) {
    return NextResponse.json({ error: "Nao foi possivel iniciar a impersonacao." }, { status: 500 });
  }

  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });

  if (otpError) {
    return NextResponse.json({ error: "Nao foi possivel iniciar a impersonacao." }, { status: 500 });
  }

  cookieStore.set(
    IMPERSONATION_COOKIE,
    encodeImpersonationCookie({
      impersonatorId: access.user.id,
      impersonatorName: callerProfile?.full_name ?? "minha conta",
    }),
    impersonationCookieOptions,
  );

  return NextResponse.json({ ok: true });
}
