import { redirect } from "next/navigation";
import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";
import { PerfilForm } from "@/components/perfil/perfil-form";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const snapshot = await getAuthSnapshot();

  if (snapshot.status !== "active") {
    redirect("/");
  }

  const { profile, user } = snapshot;
  const createdAt = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : null;
  const updatedAt = profile.updated_at
    ? new Date(profile.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <div className="perfil-page">
      <header className="perfil-header">
        <div>
          <p className="perfil-eyebrow">Conta</p>
          <h2 className="perfil-title">Meu perfil</h2>
          <p className="perfil-subtitle">Gerencie sua foto, nome e veja seu nível de acesso.</p>
        </div>
        {createdAt ? (
          <dl className="perfil-meta">
            <div>
              <dt>Membro desde</dt>
              <dd>{createdAt}</dd>
            </div>
            {updatedAt ? (
              <div>
                <dt>Atualizado em</dt>
                <dd>{updatedAt}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </header>

      <div className="perfil-card">
        <PerfilForm profile={profile} email={user.email} />
      </div>
    </div>
  );
}
