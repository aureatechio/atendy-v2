"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, VenetianMask } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserRole, UserStatus } from "@/lib/auth/types";

type ImpersonationCandidate = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  producao: "Producao",
  attendant: "Atendente",
  cs_head: "Head CS/CX",
  dev: "Desenvolvedor",
  designer: "Designer",
};

const statusLabels: Record<UserStatus, string> = {
  active: "Ativo",
  pending: "Pendente",
  blocked: "Bloqueado",
};

const statusBadgeVariants: Record<UserStatus, "success" | "warning" | "danger"> = {
  active: "success",
  pending: "warning",
  blocked: "danger",
};

export function ImpersonationPanel({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<ImpersonationCandidate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUsers() {
      setLoading(true);
      const response = await fetch("/api/admin/impersonate", { cache: "no-store" });
      const payload = await response.json();

      if (!mounted) return;

      if (!response.ok) {
        setMessage(payload.error ?? "Nao foi possivel carregar usuarios.");
        setLoading(false);
        return;
      }

      setUsers(payload.users);
      setLoading(false);
    }

    void loadUsers();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("pt-BR");

    return users.filter((user) => {
      if (user.id === currentUserId) return false;
      if (query.length === 0) return true;
      return (
        user.full_name.toLocaleLowerCase("pt-BR").includes(query) ||
        user.email.toLocaleLowerCase("pt-BR").includes(query)
      );
    });
  }, [currentUserId, searchTerm, users]);

  async function impersonate(user: ImpersonationCandidate) {
    setMessage(null);
    setPendingId(user.id);

    const response = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.error ?? "Nao foi possivel impersonar este usuario.");
      setPendingId(null);
      return;
    }

    // Full reload so server components and the auth provider pick up the swapped session.
    window.location.assign("/");
  }

  return (
    <div className="admin-users">
      <section className="panel-card">
        <div className="panel-card-header admin-users-title">
          <div>
            <p className="auth-eyebrow">Ferramentas de Dev</p>
            <h2>Impersonar usuario</h2>
            <p>Entre na conta de qualquer usuario ativo para investigar problemas. Volte pela barra no topo.</p>
          </div>
          <div className="admin-users-title-actions">
            <VenetianMask aria-hidden />
          </div>
        </div>

        {message ? (
          <div className="panel-card-content admin-users-message">
            <div className="auth-alert admin-message">{message}</div>
          </div>
        ) : null}
      </section>

      <section className="panel-card">
        <div className="panel-card-header admin-users-list-header">
          <div>
            <h3 className="text-[15px] font-semibold">Usuarios</h3>
            <p>{filteredUsers.length} disponiveis</p>
          </div>
        </div>

        <div className="panel-card-content admin-users-filters">
          <label className="admin-search-field" htmlFor="impersonate-search">
            <Search aria-hidden />
            <Input
              id="impersonate-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nome ou e-mail"
            />
          </label>
        </div>

        <div className="panel-card-content admin-users-table-wrap">
          {loading ? (
            <p className="admin-empty">Carregando usuarios...</p>
          ) : (
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Papel</th>
                  <th>Status</th>
                  <th aria-label="Acoes" />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-user-cell">
                        <strong>{user.full_name}</strong>
                        <span>{user.email}</span>
                      </div>
                    </td>
                    <td>
                      <Badge>{roleLabels[user.role]}</Badge>
                    </td>
                    <td>
                      <Badge variant={statusBadgeVariants[user.status]}>{statusLabels[user.status]}</Badge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={user.status !== "active" || pendingId !== null}
                        onClick={() => impersonate(user)}
                      >
                        <VenetianMask />
                        {pendingId === user.id ? "Entrando..." : "Impersonar"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <p className="admin-empty">Nenhum usuario encontrado.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
