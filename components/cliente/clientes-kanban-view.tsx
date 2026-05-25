"use client";

import { CalendarClock, CheckCircle2, Clock3, Loader2, UserRound, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buildClientesKanbanColumns, CLIENTES_NO_STAGE_COLUMN_ID } from "@/lib/clientes/kanban";
import { formatNullableDate, parseClienteDate } from "@/lib/clientes/format";
import { currencyFormatter } from "@/lib/utils";
import type { ClienteListItem, ClienteStageSummary } from "@/lib/clientes/types";

interface Props {
  rows: ClienteListItem[];
  stages: ClienteStageSummary[];
  movingIds: Set<string>;
  onOpenCliente: (cliente: ClienteListItem) => void;
  onMoveCliente: (clienteId: string, stageId: string) => void;
}

const DRAG_MIME = "application/x-atendy-cliente-id";

function fmtDays(value: number | null) {
  if (value === null) return "sem data";
  if (value === 0) return "hoje";
  return `${value}d na etapa`;
}

function prazoVariant(value: string | null) {
  const date = parseClienteDate(value);
  if (!date) return "default" as const;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (target < today) return "danger" as const;
  if (target <= new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).getTime()) return "warning" as const;
  return "default" as const;
}

function cardSubtitle(row: ClienteListItem) {
  return [row.code, row.companyName].filter(Boolean).join(" · ") || "Sem empresa vinculada";
}

export function ClientesKanbanView({ rows, stages, movingIds, onOpenCliente, onMoveCliente }: Props) {
  const columns = buildClientesKanbanColumns(rows, stages);

  if (columns.length === 0) {
    return <div className="clientes-kanban-empty">Nenhum cliente encontrado com os filtros atuais.</div>;
  }

  return (
    <div className="clientes-kanban" aria-label="Funil kanban de clientes">
      {columns.map((column) => {
        const canReceiveDrop = column.id !== CLIENTES_NO_STAGE_COLUMN_ID;

        return (
          <section
            key={column.id}
            className={`clientes-kanban-column ${column.isFinal ? "is-final" : ""} ${canReceiveDrop ? "is-droppable" : ""}`}
            style={{ ["--stage-color" as string]: column.color }}
            role="list"
            aria-label={column.name}
            onDragOver={
              canReceiveDrop
                ? (event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }
                : undefined
            }
            onDrop={
              canReceiveDrop
                ? (event) => {
                    event.preventDefault();
                    const clienteId = event.dataTransfer.getData(DRAG_MIME) || event.dataTransfer.getData("text/plain");
                    if (clienteId) onMoveCliente(clienteId, column.id);
                  }
                : undefined
            }
          >
            <header className="clientes-kanban-column-head">
              <span className="clientes-kanban-stage-dot" aria-hidden />
              <div>
                <h3>{column.name}</h3>
                <p>
                  {column.count} cliente{column.count === 1 ? "" : "s"}
                </p>
              </div>
              <strong>{currencyFormatter.format(column.totalValue)}</strong>
            </header>

            <div className="clientes-kanban-cards">
              {column.items.length === 0 ? (
                <div className="clientes-kanban-column-empty">Sem clientes nesta etapa.</div>
              ) : (
                column.items.map((row) => {
                  const moving = movingIds.has(row.id);
                  const draggable = !row.isArchived && !moving;

                  return (
                    <article
                      key={row.id}
                      className={`clientes-kanban-card ${row.isArchived ? "is-archived" : ""} ${moving ? "is-moving" : ""}`}
                      draggable={draggable}
                      data-testid={`clientes-kanban-card-${row.id}`}
                      role="listitem"
                      onDragStart={(event) => {
                        if (!draggable) return;
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(DRAG_MIME, row.id);
                        event.dataTransfer.setData("text/plain", row.id);
                      }}
                    >
                      <button type="button" className="clientes-kanban-card-main" onClick={() => onOpenCliente(row)}>
                        <span className="clientes-kanban-card-title">{row.nome}</span>
                        <span className="clientes-kanban-card-subtitle">{cardSubtitle(row)}</span>
                      </button>

                      <div className="clientes-kanban-card-value">
                        <Wallet className="h-3.5 w-3.5" aria-hidden />
                        {currencyFormatter.format(row.valor)}
                      </div>

                      <div className="clientes-kanban-card-meta">
                        <span title="Responsável">
                          <UserRound className="h-3.5 w-3.5" aria-hidden />
                          {row.responsavelNome ?? "Sem responsável"}
                        </span>
                        <span title="Tempo na etapa">
                          <Clock3 className="h-3.5 w-3.5" aria-hidden />
                          {fmtDays(row.diasNaEtapa)}
                        </span>
                      </div>

                      <div className="clientes-kanban-card-foot">
                        <Badge variant={prazoVariant(row.prazoFinal)}>
                          <CalendarClock className="h-3 w-3" aria-hidden />
                          {formatNullableDate(row.prazoFinal)}
                        </Badge>
                        <span className="clientes-kanban-task-pill">
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                          {row.tarefasAbertas} tarefa{row.tarefasAbertas === 1 ? "" : "s"}
                        </span>
                        {row.tarefasUrgentes > 0 ? (
                          <span className="clientes-kanban-urgent-pill">
                            {row.tarefasUrgentes} urgente{row.tarefasUrgentes === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>

                      {moving ? (
                        <span className="clientes-kanban-moving" aria-label="Movendo cliente">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        </span>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
