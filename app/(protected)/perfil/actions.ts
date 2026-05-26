"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface UpdateProfileNameInput {
  fullName: string;
}

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

export async function updateProfileName(input: UpdateProfileNameInput): Promise<ActionResult> {
  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: "Informe seu nome completo." };
  if (fullName.length > 120) return { ok: false, error: "Nome muito longo (máx. 120 caracteres)." };

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Sessão inválida." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  return { ok: true };
}

export interface UploadAvatarResult extends ActionResult {
  avatarUrl?: string;
}

export async function uploadAvatar(formData: FormData): Promise<UploadAvatarResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Arquivo inválido." };
  if (file.size === 0) return { ok: false, error: "Arquivo vazio." };
  if (file.size > MAX_AVATAR_BYTES) return { ok: false, error: "Imagem muito grande (máx. 2 MB)." };
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return { ok: false, error: "Formato não suportado. Use PNG, JPG, WEBP ou GIF." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Sessão inválida." };

  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) return { ok: false, error: uploadError.message };

  const { data: publicUrl } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const avatarUrl = publicUrl.publicUrl;

  const { data: prev } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const { error: updateError } = await admin
    .from("profiles")
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updateError) return { ok: false, error: updateError.message };

  if (prev?.avatar_url) {
    const previousPath = extractAvatarPath(prev.avatar_url);
    if (previousPath && previousPath !== path) {
      await admin.storage.from(AVATAR_BUCKET).remove([previousPath]).catch(() => undefined);
    }
  }

  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  return { ok: true, avatarUrl };
}

export async function removeAvatar(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Sessão inválida." };

  const admin = createAdminClient();
  const { data: prev } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const { error: updateError } = await admin
    .from("profiles")
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updateError) return { ok: false, error: updateError.message };

  if (prev?.avatar_url) {
    const previousPath = extractAvatarPath(prev.avatar_url);
    if (previousPath) {
      await admin.storage.from(AVATAR_BUCKET).remove([previousPath]).catch(() => undefined);
    }
  }

  revalidatePath("/perfil");
  revalidatePath("/", "layout");
  return { ok: true };
}

function extractAvatarPath(url: string): string | null {
  const marker = `/object/public/${AVATAR_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}
