"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarPlus, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Scope = "national" | "regional" | "company";

interface HolidayRow {
  date: string;
  description: string;
  scope: Scope;
  created_at?: string;
}

const scopeLabels: Record<Scope, string> = {
  national: "Nacional",
  regional: "Regional",
  company: "Empresa",
};

type NewHolidayState = {
  date: string;
  description: string;
  scope: Scope;
};

const initialNewHoliday: NewHolidayState = { date: "", description: "", scope: "national" };

export function HolidaysAdmin() {
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newHoliday, setNewHoliday] = useState<NewHolidayState>(initialNewHoliday);
  const [yearFilter, setYearFilter] = useState<string>("");

  async function loadHolidays() {
    setLoading(true);
    const response = await fetch("/api/admin/holidays", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Nao foi possivel carregar feriados.");
      setLoading(false);
      return;
    }
    setHolidays(payload.holidays);
    setLoading(false);
  }

  useEffect(() => {
    void loadHolidays();
  }, []);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const h of holidays) set.add(h.date.slice(0, 4));
    return Array.from(set).sort();
  }, [holidays]);

  const filtered = useMemo(
    () => (yearFilter ? holidays.filter((h) => h.date.startsWith(yearFilter)) : holidays),
    [holidays, yearFilter],
  );

  async function createHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    const response = await fetch("/api/admin/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newHoliday),
    });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(payload.error ?? "Nao foi possivel criar o feriado.");
      return;
    }
    setNewHoliday(initialNewHoliday);
    setMessage("Feriado criado.");
    await loadHolidays();
  }

  async function updateHoliday(date: string, changes: Partial<HolidayRow>) {
    setMessage(null);
    const response = await fetch(`/api/admin/holidays/${date}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Nao foi possivel atualizar o feriado.");
      return;
    }
    setHolidays((current) => current.map((item) => (item.date === date ? { ...item, ...payload.holiday } : item)));
  }

  async function deleteHoliday(date: string) {
    setMessage(null);
    if (!confirm(`Remover feriado em ${date}?`)) return;
    const response = await fetch(`/api/admin/holidays/${date}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.error ?? "Nao foi possivel remover o feriado.");
      return;
    }
    setHolidays((current) => current.filter((item) => item.date !== date));
  }

  return (
    <div className="admin-users">
      <section className="panel-card">
        <div className="panel-card-header admin-users-title">
          <div>
            <p className="auth-eyebrow">Calendário</p>
            <h2>Feriados</h2>
            <p>Dias não-úteis usados no cálculo de SLA das etapas.</p>
          </div>
          <CalendarRange />
        </div>

        <form className="panel-card-content admin-create-form" onSubmit={createHoliday}>
          {message ? <div className="auth-alert admin-message">{message}</div> : null}

          <div>
            <label className="label" htmlFor="holiday-date">Data</label>
            <Input
              id="holiday-date"
              type="date"
              value={newHoliday.date}
              onChange={(event) => setNewHoliday((current) => ({ ...current, date: event.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="holiday-description">Descrição</label>
            <Input
              id="holiday-description"
              value={newHoliday.description}
              onChange={(event) => setNewHoliday((current) => ({ ...current, description: event.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="holiday-scope">Escopo</label>
            <Select
              id="holiday-scope"
              value={newHoliday.scope}
              onChange={(event) => setNewHoliday((current) => ({ ...current, scope: event.target.value as Scope }))}
            >
              {Object.entries(scopeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>

          <Button type="submit" disabled={saving}>
            <CalendarPlus />
            {saving ? "Criando..." : "Adicionar feriado"}
          </Button>
        </form>
      </section>

      <section className="panel-card">
        <div className="panel-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="text-[15px] font-semibold">Feriados cadastrados</h3>
          <Select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            style={{ width: 140 }}
          >
            <option value="">Todos os anos</option>
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </Select>
        </div>
        <div className="panel-card-content admin-users-table-wrap">
          {loading ? (
            <p className="admin-empty">Carregando feriados...</p>
          ) : (
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Escopo</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((holiday) => (
                  <tr key={holiday.date}>
                    <td>{holiday.date}</td>
                    <td>
                      <input
                        className="admin-inline-input"
                        defaultValue={holiday.description}
                        onBlur={(event) => void updateHoliday(holiday.date, { description: event.target.value })}
                      />
                    </td>
                    <td>
                      <Select
                        value={holiday.scope}
                        onChange={(event) => void updateHoliday(holiday.date, { scope: event.target.value as Scope })}
                      >
                        {Object.entries(scopeLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </td>
                    <td>
                      <Button type="button" variant="ghost" size="sm" onClick={() => void deleteHoliday(holiday.date)}>
                        Remover
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="admin-empty">Nenhum feriado cadastrado.</td></tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
