import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminAccess } from "@/lib/auth/requireAdmin";
import { profileSelectColumns } from "@/lib/auth/session";
import { createAdminUserSchema, updateAdminUserSchema } from "@/lib/auth/validation";
import type { AdminUser, Profile } from "@/lib/auth/types";

const profileColumns = profileSelectColumns;

function mergeUsers(profiles: Profile[], authUsers: User[]) {
  const authById = new Map(authUsers.map((user) => [user.id, user]));

  return profiles.map((profile) => {
    const authUser = authById.get(profile.id);

    return {
      ...profile,
      email: authUser?.email ?? "sem-email@atendy.local",
      auth_created_at: authUser?.created_at ?? null,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
    } satisfies AdminUser;
  });
}

export async function GET() {
  const access = await requireAdminAccess({ capability: "adminArea" });

  if (access.error) {
    return access.error;
  }

  const admin = createAdminClient();
  const [{ data: profiles, error: profilesError }, { data: authData, error: authError }] = await Promise.all([
    admin.from("profiles").select(profileColumns).order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (profilesError || authError) {
    return NextResponse.json({ error: "Nao foi possivel listar usuarios." }, { status: 500 });
  }

  return NextResponse.json({ users: mergeUsers((profiles ?? []) as Profile[], authData.users) });
}

export async function POST(request: Request) {
  const access = await requireAdminAccess({ capability: "adminArea" });

  if (access.error) {
    return access.error;
  }

  const parsed = createAdminUserSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados invalidos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { email, password, full_name, role, status } = parsed.data;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Nao foi possivel criar o usuario." }, { status: 400 });
  }

  if (status === "blocked") {
    await admin.auth.admin.updateUserById(data.user.id, { ban_duration: "876000h" });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .upsert({
      id: data.user.id,
      full_name,
      role,
      status,
      updated_at: new Date().toISOString(),
    })
    .select(profileColumns)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Usuario criado no Auth, mas o profile nao foi atualizado." }, { status: 500 });
  }

  return NextResponse.json({
    user: {
      ...(profile as Profile),
      email: data.user.email ?? email,
      auth_created_at: data.user.created_at ?? null,
      last_sign_in_at: data.user.last_sign_in_at ?? null,
    } satisfies AdminUser,
  });
}

export async function PATCH(request: Request) {
  const access = await requireAdminAccess({ capability: "adminArea" });

  if (access.error) {
    return access.error;
  }

  const parsed = updateAdminUserSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados invalidos." }, { status: 400 });
  }

  const { id, ...changes } = parsed.data;
  const admin = createAdminClient();

  if (changes.status === "blocked") {
    await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  }

  if (changes.status === "active") {
    await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(profileColumns)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Nao foi possivel atualizar o usuario." }, { status: 500 });
  }

  return NextResponse.json({ user: profile });
}
