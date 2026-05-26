"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { removeAvatar, updateProfileName, uploadAvatar } from "@/app/(protected)/perfil/actions";
import { useAuth } from "@/hooks/use-auth";
import type { Profile, UserRole, UserStatus } from "@/lib/auth/types";

interface Props {
  profile: Profile;
  email: string | null;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  attendant: "Atendente",
  producao: "Produção",
  cs_head: "CS Head",
  dev: "Desenvolvedor",
  designer: "Designer",
};

const STATUS_LABELS: Record<UserStatus, { label: string; tone: "success" | "warning" | "danger" }> = {
  active: { label: "Ativo", tone: "success" },
  pending: { label: "Pendente", tone: "warning" },
  blocked: { label: "Bloqueado", tone: "danger" },
};

export function PerfilForm({ profile, email }: Props) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [pending, startTransition] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [removing, startRemove] = useTransition();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = fullName.trim() !== (profile.full_name ?? "").trim();
  const initials = (profile.full_name ?? email ?? "AT")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const roleLabel = ROLE_LABELS[profile.role] ?? profile.role;
  const statusMeta = STATUS_LABELS[profile.status] ?? { label: profile.status, tone: "warning" as const };

  function handleNameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = await updateProfileName({ fullName });
      if (!result.ok) {
        setFeedback({ kind: "error", text: result.error ?? "Não foi possível salvar." });
        return;
      }
      setFeedback({ kind: "success", text: "Nome atualizado com sucesso." });
      await refreshProfile();
      router.refresh();
    });
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFeedback(null);
    const data = new FormData();
    data.append("file", file);
    startUpload(async () => {
      const result = await uploadAvatar(data);
      if (!result.ok || !result.avatarUrl) {
        setFeedback({ kind: "error", text: result.error ?? "Falha no upload." });
        return;
      }
      setAvatarUrl(result.avatarUrl);
      setFeedback({ kind: "success", text: "Foto atualizada com sucesso." });
      await refreshProfile();
      router.refresh();
    });
  }

  function handleRemoveAvatar() {
    setFeedback(null);
    startRemove(async () => {
      const result = await removeAvatar();
      if (!result.ok) {
        setFeedback({ kind: "error", text: result.error ?? "Falha ao remover." });
        return;
      }
      setAvatarUrl(null);
      setFeedback({ kind: "success", text: "Foto removida." });
      await refreshProfile();
      router.refresh();
    });
  }

  return (
    <div className="perfil-form">
      <section className="perfil-identity">
        <div className="perfil-avatar-wrap">
          <div className="perfil-avatar" aria-hidden>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" />
            ) : (
              <span>{initials}</span>
            )}
            {uploading || removing ? (
              <div className="perfil-avatar-overlay">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="perfil-avatar-edit"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || removing}
            aria-label="Trocar foto de perfil"
            title="Trocar foto"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={handleFileChange}
          />
        </div>

        <div className="perfil-identity-info">
          <p className="perfil-identity-name">{profile.full_name || "Sem nome"}</p>
          <p className="perfil-identity-email">{email ?? "—"}</p>
          <div className="perfil-identity-badges">
            <span className="perfil-badge perfil-badge--role">{roleLabel}</span>
            <span className={`perfil-badge perfil-badge--status is-${statusMeta.tone}`}>
              <span className="perfil-badge-dot" aria-hidden />
              {statusMeta.label}
            </span>
          </div>
          <div className="perfil-identity-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || removing}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {avatarUrl ? "Trocar foto" : "Enviar foto"}
            </Button>
            {avatarUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveAvatar}
                disabled={uploading || removing}
              >
                {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Remover
              </Button>
            ) : null}
          </div>
          <p className="perfil-identity-hint">PNG, JPG, WEBP ou GIF · máx 2 MB.</p>
        </div>
      </section>

      <form className="perfil-fields" onSubmit={handleNameSubmit}>
        <div className="perfil-field-group">
          <label className="perfil-field">
            <span className="perfil-field-label">Nome completo</span>
            <Input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Como você quer ser chamado"
              maxLength={120}
              required
              disabled={pending}
            />
          </label>

          <label className="perfil-field">
            <span className="perfil-field-label">Email</span>
            <Input type="email" value={email ?? ""} readOnly disabled />
            <span className="perfil-field-hint">Para alterar o email, fale com um administrador.</span>
          </label>
        </div>

        {feedback ? (
          <p
            className={`perfil-feedback is-${feedback.kind}`}
            role={feedback.kind === "error" ? "alert" : "status"}
          >
            {feedback.text}
          </p>
        ) : null}

        <div className="perfil-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFullName(profile.full_name ?? "");
              setFeedback(null);
            }}
            disabled={pending || !isDirty}
          >
            Descartar
          </Button>
          <Button type="submit" disabled={pending || !isDirty}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar alterações
          </Button>
        </div>
      </form>
    </div>
  );
}
