"use client";

import { FormEvent, useEffect, useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { AdminUser, UserRole, UserStatus } from "@/lib/auth/types";

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  producao: "Producao",
  attendant: "Atendente",
};

const statusLabels: Record<UserStatus, string> = {
  active: "Ativo",
  pending: "Pendente",
  blocked: "Bloqueado",
};

type NewUserState = {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
};

const initialNewUser: NewUserState = {
  email: "",
  password: "",
  full_name: "",
  role: "producao",
  status: "active",
};

export function UsersAdmin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [newUser, setNewUser] = useState<NewUserState>(initialNewUser);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Nao foi possivel carregar usuarios.");
      setLoading(false);
      return;
    }

    setUsers(payload.users);
    setLoading(false);
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const payload = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(payload.error ?? "Nao foi possivel criar o usuario.");
      return;
    }

    setNewUser(initialNewUser);
    setMessage("Usuario criado.");
    await loadUsers();
  }

  async function updateUser(id: string, changes: Partial<Pick<AdminUser, "full_name" | "role" | "status">>) {
    setMessage(null);

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...changes }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Nao foi possivel atualizar o usuario.");
      return;
    }

    setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...payload.user } : user)));
  }

  return (
    <div className="admin-users">
      <section className="panel-card">
        <div className="panel-card-header admin-users-title">
          <div>
            <p className="auth-eyebrow">Governanca</p>
            <h2>Usuarios e acessos</h2>
            <p>Crie usuarios internos e controle status e papel operacional.</p>
          </div>
          <ShieldCheck />
        </div>

        <form className="panel-card-content admin-create-form" onSubmit={createUser}>
          {message ? <div className="auth-alert admin-message">{message}</div> : null}

          <div>
            <label className="label" htmlFor="full_name">
              Nome
            </label>
            <Input
              id="full_name"
              value={newUser.full_name}
              onChange={(event) => setNewUser((current) => ({ ...current, full_name: event.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="email">
              E-mail
            </label>
            <Input
              id="email"
              type="email"
              value={newUser.email}
              onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Senha inicial
            </label>
            <Input
              id="password"
              type="password"
              value={newUser.password}
              onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="role">
              Papel
            </label>
            <Select
              id="role"
              value={newUser.role}
              onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value as UserRole }))}
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <Select
              id="status"
              value={newUser.status}
              onChange={(event) => setNewUser((current) => ({ ...current, status: event.target.value as UserStatus }))}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <Button type="submit" disabled={saving}>
            <UserPlus />
            {saving ? "Criando..." : "Criar usuario"}
          </Button>
        </form>
      </section>

      <section className="panel-card">
        <div className="panel-card-header">
          <h3 className="text-[15px] font-semibold">Usuarios cadastrados</h3>
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
                  <th>Ultimo login</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <input
                        className="admin-inline-input"
                        value={user.full_name}
                        onChange={(event) =>
                          setUsers((current) =>
                            current.map((item) =>
                              item.id === user.id ? { ...item, full_name: event.target.value } : item,
                            ),
                          )
                        }
                        onBlur={(event) => void updateUser(user.id, { full_name: event.target.value })}
                      />
                      <span>{user.email}</span>
                    </td>
                    <td>
                      <Select
                        value={user.role}
                        onChange={(event) => void updateUser(user.id, { role: event.target.value as UserRole })}
                      >
                        {Object.entries(roleLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td>
                      <Select
                        value={user.status}
                        onChange={(event) => void updateUser(user.id, { status: event.target.value as UserStatus })}
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("pt-BR") : "Nunca"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
