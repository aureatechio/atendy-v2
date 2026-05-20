"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, UserCog, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatLastLogin, formatLastLoginDetails } from "@/lib/auth/last-login";
import type { AdminUser, UserRole, UserStatus } from "@/lib/auth/types";

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  producao: "Producao",
  attendant: "Atendente",
  cs_head: "Head CS/CX",
  dev: "Desenvolvedor",
};

const statusLabels: Record<UserStatus, string> = {
  active: "Ativo",
  pending: "Pendente",
  blocked: "Bloqueado",
};

const roleBadgeClasses: Record<UserRole, string> = {
  admin: "admin-role-badge admin-role-badge-admin",
  supervisor: "admin-role-badge admin-role-badge-supervisor",
  producao: "admin-role-badge admin-role-badge-producao",
  attendant: "admin-role-badge admin-role-badge-attendant",
  cs_head: "admin-role-badge admin-role-badge-cs-head",
  dev: "admin-role-badge admin-role-badge-dev",
};

const statusBadgeVariants: Record<UserStatus, "success" | "warning" | "danger"> = {
  active: "success",
  pending: "warning",
  blocked: "danger",
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

type EditUserState = Pick<AdminUser, "full_name" | "role" | "status">;

export function UsersAdmin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [newUser, setNewUser] = useState<NewUserState>(initialNewUser);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editingUser, setEditingUser] = useState<EditUserState | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
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

  useEffect(() => {
    if (!createModalOpen && !selectedUser) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setCreateModalOpen(false);
      setSelectedUser(null);
      setEditingUser(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createModalOpen, selectedUser]);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("pt-BR");

    return users.filter((user) => {
      const matchesSearch =
        query.length === 0 ||
        user.full_name.toLocaleLowerCase("pt-BR").includes(query) ||
        user.email.toLocaleLowerCase("pt-BR").includes(query);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchTerm, statusFilter, users]);

  const hasFilters = searchTerm.trim().length > 0 || roleFilter !== "all" || statusFilter !== "all";

  function clearFilters() {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
  }

  function openCreateModal() {
    setMessage(null);
    setNewUser(initialNewUser);
    setCreateModalOpen(true);
  }

  function closeCreateModal() {
    setCreateModalOpen(false);
  }

  function openUserDetails(user: AdminUser) {
    setMessage(null);
    setSelectedUser(user);
    setEditingUser({
      full_name: user.full_name,
      role: user.role,
      status: user.status,
    });
  }

  function closeUserDetails() {
    setSelectedUser(null);
    setEditingUser(null);
  }

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
    setCreateModalOpen(false);
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
    return payload.user as AdminUser;
  }

  async function saveUserDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser || !editingUser) return;

    setSaving(true);
    const updated = await updateUser(selectedUser.id, editingUser);
    setSaving(false);

    if (!updated) return;

    const nextUser = { ...selectedUser, ...updated };
    setSelectedUser(nextUser);
    setEditingUser({
      full_name: nextUser.full_name,
      role: nextUser.role,
      status: nextUser.status,
    });
    setMessage("Usuario atualizado.");
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
          <div className="admin-users-title-actions">
            <ShieldCheck aria-hidden />
            <Button type="button" onClick={openCreateModal}>
              <UserPlus />
              Novo usuario
            </Button>
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
            <h3 className="text-[15px] font-semibold">Usuarios cadastrados</h3>
            <p>
              {filteredUsers.length} de {users.length} usuarios
            </p>
          </div>
          {hasFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <X />
              Limpar filtros
            </Button>
          ) : null}
        </div>

        <div className="panel-card-content admin-users-filters">
          <label className="admin-search-field" htmlFor="admin-user-search">
            <Search aria-hidden />
            <Input
              id="admin-user-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nome ou e-mail"
            />
          </label>

          <Select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as UserRole | "all")}
            aria-label="Filtrar por papel"
          >
            <option value="all">Todos os papeis</option>
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as UserStatus | "all")}
            aria-label="Filtrar por status"
          >
            <option value="all">Todos os status</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
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
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="admin-user-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => openUserDetails(user)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openUserDetails(user);
                      }
                    }}
                    aria-label={`Abrir detalhes de ${user.full_name}`}
                  >
                    <td>
                      <div className="admin-user-cell">
                        <strong>{user.full_name}</strong>
                        <span>{user.email}</span>
                      </div>
                    </td>
                    <td>
                      <Badge className={roleBadgeClasses[user.role]}>{roleLabels[user.role]}</Badge>
                    </td>
                    <td>
                      <Badge variant={statusBadgeVariants[user.status]}>{statusLabels[user.status]}</Badge>
                    </td>
                    <td>
                      <time
                        dateTime={user.last_sign_in_at ?? undefined}
                        title={formatLastLoginDetails(user.last_sign_in_at)}
                      >
                        {formatLastLogin(user.last_sign_in_at)}
                      </time>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <p className="admin-empty">Nenhum usuario encontrado com os filtros atuais.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {createModalOpen ? (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-new-user-title">
          <button
            type="button"
            className="admin-modal-backdrop"
            onClick={closeCreateModal}
            aria-label="Fechar modal"
          />
          <section className="admin-modal">
            <header className="admin-modal-header">
              <div>
                <p className="auth-eyebrow">Novo acesso</p>
                <h3 id="admin-new-user-title">Criar usuario</h3>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={closeCreateModal} aria-label="Fechar">
                <X />
              </Button>
            </header>

            <form className="admin-user-modal-form" onSubmit={createUser}>
              {message ? <div className="auth-alert admin-message">{message}</div> : null}

              <div>
                <label className="label" htmlFor="new-user-full-name">
                  Nome
                </label>
                <Input
                  id="new-user-full-name"
                  value={newUser.full_name}
                  onChange={(event) => setNewUser((current) => ({ ...current, full_name: event.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="new-user-email">
                  E-mail
                </label>
                <Input
                  id="new-user-email"
                  type="email"
                  value={newUser.email}
                  onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="new-user-password">
                  Senha inicial
                </label>
                <Input
                  id="new-user-password"
                  type="password"
                  value={newUser.password}
                  onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="new-user-role">
                  Papel
                </label>
                <Select
                  id="new-user-role"
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
                <label className="label" htmlFor="new-user-status">
                  Status
                </label>
                <Select
                  id="new-user-status"
                  value={newUser.status}
                  onChange={(event) =>
                    setNewUser((current) => ({ ...current, status: event.target.value as UserStatus }))
                  }
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>

              <footer className="admin-modal-actions">
                <Button type="button" variant="secondary" onClick={closeCreateModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  <UserPlus />
                  {saving ? "Criando..." : "Criar usuario"}
                </Button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}

      {selectedUser && editingUser ? (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-user-details-title">
          <button
            type="button"
            className="admin-modal-backdrop"
            onClick={closeUserDetails}
            aria-label="Fechar modal"
          />
          <section className="admin-modal">
            <header className="admin-modal-header">
              <div>
                <p className="auth-eyebrow">Detalhes do usuario</p>
                <h3 id="admin-user-details-title">{selectedUser.full_name}</h3>
                <div className="admin-modal-meta">
                  <Badge className={roleBadgeClasses[editingUser.role]}>{roleLabels[editingUser.role]}</Badge>
                  <Badge variant={statusBadgeVariants[editingUser.status]}>{statusLabels[editingUser.status]}</Badge>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={closeUserDetails} aria-label="Fechar">
                <X />
              </Button>
            </header>

            <form className="admin-user-modal-form" onSubmit={saveUserDetails}>
              {message ? <div className="auth-alert admin-message">{message}</div> : null}

              <div>
                <label className="label" htmlFor="edit-user-full-name">
                  Nome
                </label>
                <Input
                  id="edit-user-full-name"
                  value={editingUser.full_name}
                  onChange={(event) =>
                    setEditingUser((current) => (current ? { ...current, full_name: event.target.value } : current))
                  }
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="edit-user-email">
                  E-mail
                </label>
                <Input id="edit-user-email" value={selectedUser.email} readOnly aria-readonly="true" />
              </div>

              <div className="admin-detail-grid">
                <div>
                  <label className="label" htmlFor="edit-user-role">
                    Papel
                  </label>
                  <Select
                    id="edit-user-role"
                    value={editingUser.role}
                    onChange={(event) =>
                      setEditingUser((current) =>
                        current ? { ...current, role: event.target.value as UserRole } : current,
                      )
                    }
                  >
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="label" htmlFor="edit-user-status">
                    Status
                  </label>
                  <Select
                    id="edit-user-status"
                    value={editingUser.status}
                    onChange={(event) =>
                      setEditingUser((current) =>
                        current ? { ...current, status: event.target.value as UserStatus } : current,
                      )
                    }
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="admin-detail-grid">
                <div className="admin-readonly-field">
                  <span>Ultimo login</span>
                  <strong title={formatLastLoginDetails(selectedUser.last_sign_in_at)}>
                    {formatLastLogin(selectedUser.last_sign_in_at)}
                  </strong>
                </div>
                <div className="admin-readonly-field">
                  <span>Criado em</span>
                  <strong title={formatLastLoginDetails(selectedUser.auth_created_at)}>
                    {selectedUser.auth_created_at ? formatLastLoginDetails(selectedUser.auth_created_at) : "Sem data"}
                  </strong>
                </div>
              </div>

              <footer className="admin-modal-actions">
                <Button type="button" variant="secondary" onClick={closeUserDetails}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  <UserCog />
                  {saving ? "Salvando..." : "Salvar alteracoes"}
                </Button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
