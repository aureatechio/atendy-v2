"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpDown,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Inbox,
  Loader2,
  Move,
  Trophy,
  UserRound,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buildClientesKanbanColumns, CLIENTES_NO_STAGE_COLUMN_ID } from "@/lib/clientes/kanban";
import { formatNullableDate, parseClienteDate } from "@/lib/clientes/format";
import { getActiveParentClienteStages, getClienteStageRootId } from "@/lib/clientes/stages";
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

type SortKey = "default" | "valor" | "diasNaEtapa" | "prazoFinal" | "nome";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "default", label: "Padrão" },
  { key: "valor", label: "Maior valor" },
  { key: "diasNaEtapa", label: "Mais tempo na etapa" },
  { key: "prazoFinal", label: "Prazo mais próximo" },
  { key: "nome", label: "Nome (A→Z)" },
];

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

function ageVariant(value: number | null) {
  if (value === null) return "default" as const;
  if (value >= 30) return "danger" as const;
  if (value >= 14) return "warning" as const;
  return "success" as const;
}

function taskVariant(openTasks: number, urgentTasks: number) {
  if (urgentTasks > 0) return "danger" as const;
  if (openTasks === 0) return "success" as const;
  return "default" as const;
}

function cardSubtitle(row: ClienteListItem) {
  return [row.code, row.companyName].filter(Boolean).join(" · ") || "Sem empresa vinculada";
}

function getInitials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_HUES = [210, 270, 330, 20, 60, 140, 180];
function getAvatarHue(name: string | null) {
  if (!name) return 220;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
}

function isPrazoOverdue(value: string | null) {
  const date = parseClienteDate(value);
  if (!date) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() < today;
}

function sortItems(items: ClienteListItem[], key: SortKey): ClienteListItem[] {
  if (key === "default") return items;
  const copy = [...items];
  switch (key) {
    case "valor":
      return copy.sort((a, b) => b.valor - a.valor);
    case "diasNaEtapa":
      return copy.sort((a, b) => (b.diasNaEtapa ?? -1) - (a.diasNaEtapa ?? -1));
    case "prazoFinal":
      return copy.sort((a, b) => {
        const da = parseClienteDate(a.prazoFinal)?.getTime() ?? Number.POSITIVE_INFINITY;
        const db = parseClienteDate(b.prazoFinal)?.getTime() ?? Number.POSITIVE_INFINITY;
        return da - db;
      });
    case "nome":
      return copy.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
    default:
      return copy;
  }
}

export function ClientesKanbanView({ rows, stages, movingIds, onOpenCliente, onMoveCliente }: Props) {
  const columns = useMemo(() => buildClientesKanbanColumns(rows, stages), [rows, stages]);
  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages]);
  const parentStages = useMemo(() => getActiveParentClienteStages(stages), [stages]);
  const [sortByColumn, setSortByColumn] = useState<Record<string, SortKey>>({});
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const stageNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const stage of stages) map.set(stage.id, stage.name);
    return map;
  }, [stages]);

  function handleMove(clienteId: string, stageId: string, currentStageId: string | null) {
    if (stageId === getClienteStageRootId(currentStageId, stageById)) return;
    onMoveCliente(clienteId, stageId);
    const target = stageNamesById.get(stageId) ?? "outra etapa";
    setAnnounce(`Cliente movido para ${target}.`);
  }

  if (columns.length === 0) {
    return (
      <div className="clientes-kanban-empty" role="status">
        <Inbox className="clientes-kanban-empty-icon" aria-hidden />
        <span>Nenhum cliente encontrado com os filtros atuais.</span>
        <small>Ajuste os filtros ou limpe a busca para ver os cards.</small>
      </div>
    );
  }

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
      <div className="clientes-kanban" aria-label="Funil kanban de clientes">
        {columns.map((column) => {
          const canReceiveDrop = column.id !== CLIENTES_NO_STAGE_COLUMN_ID;
          const sortKey = sortByColumn[column.id] ?? "default";
          const sortedItems = sortItems(column.items, sortKey);
          const isDragTarget = dragTargetId === column.id;

          return (
            <section
              key={column.id}
              className={[
                "clientes-kanban-column",
                column.isFinal ? "is-final" : "",
                canReceiveDrop ? "is-droppable" : "",
                isDragTarget ? "is-drag-target" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ ["--stage-color" as string]: column.color }}
              role="list"
              aria-label={column.name}
              onDragOver={
                canReceiveDrop
                  ? (event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      if (dragTargetId !== column.id) setDragTargetId(column.id);
                    }
                  : undefined
              }
              onDragLeave={
                canReceiveDrop
                  ? (event) => {
                      if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                      setDragTargetId((current) => (current === column.id ? null : current));
                    }
                  : undefined
              }
              onDrop={
                canReceiveDrop
                  ? (event) => {
                      event.preventDefault();
                      setDragTargetId(null);
                      const clienteId =
                        event.dataTransfer.getData(DRAG_MIME) || event.dataTransfer.getData("text/plain");
                      if (clienteId) {
                        const row = rows.find((r) => r.id === clienteId);
                        handleMove(clienteId, column.id, row?.stageId ?? null);
                      }
                    }
                  : undefined
              }
            >
              <header className="clientes-kanban-column-head">
                <div className="clientes-kanban-column-title">
                  <h3>
                    {column.isFinal ? <Trophy className="h-3.5 w-3.5" aria-hidden /> : null}
                    <span>{column.name}</span>
                  </h3>
                  <span
                    className="clientes-kanban-column-count"
                    aria-label={`${column.count} cliente${column.count === 1 ? "" : "s"}`}
                  >
                    <Briefcase className="h-3 w-3" aria-hidden />
                    <span>{column.count}</span>
                    <span className="sr-only"> cliente{column.count === 1 ? "" : "s"}</span>
                  </span>
                </div>
                <div className="clientes-kanban-column-meta">
                  <strong>{currencyFormatter.format(column.totalValue)}</strong>
                  <details
                    className="clientes-kanban-sort"
                    onToggle={(event) => {
                      // close other open details inside this column when one opens
                      const target = event.currentTarget;
                      if (target.open) {
                        document.querySelectorAll<HTMLDetailsElement>("details.clientes-kanban-sort").forEach((el) => {
                          if (el !== target) el.open = false;
                        });
                      }
                    }}
                  >
                    <summary aria-label="Ordenar coluna" title="Ordenar">
                      <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
                      {sortKey !== "default" ? <span className="clientes-kanban-sort-dot" aria-hidden /> : null}
                    </summary>
                    <div className="clientes-kanban-sort-menu" role="menu">
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          role="menuitemradio"
                          aria-checked={sortKey === opt.key}
                          className={`clientes-kanban-sort-item ${sortKey === opt.key ? "is-active" : ""}`}
                          onClick={(event) => {
                            setSortByColumn((current) => ({ ...current, [column.id]: opt.key }));
                            (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute(
                              "open",
                            );
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
              </header>

              <KanbanColumnCards>
                  {sortedItems.length === 0 ? (
                    <div className="clientes-kanban-column-empty">
                      <Inbox className="h-4 w-4" aria-hidden />
                      <span>Sem clientes nesta etapa</span>
                      <small>Arraste cards aqui para movê-los</small>
                    </div>
                  ) : (
                    sortedItems.map((row) => {
                      const moving = movingIds.has(row.id);
                      const draggable = !row.isArchived && !moving;
                      const overdue = isPrazoOverdue(row.prazoFinal);
                      const isUrgent = row.tarefasUrgentes > 0 || overdue;
                      const isDragging = draggedId === row.id;
                      const currentRootStageId = getClienteStageRootId(row.stageId, stageById);
                      const moveTargets = parentStages.filter((s) => s.id !== currentRootStageId);
                      const hue = getAvatarHue(row.responsavelNome);

                      return (
                        <article
                          key={row.id}
                          className={[
                            "clientes-kanban-card",
                            row.isArchived ? "is-archived" : "",
                            moving ? "is-moving" : "",
                            isUrgent ? "is-urgent" : "",
                            isDragging ? "is-dragging" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          draggable={draggable}
                          data-testid={`clientes-kanban-card-${row.id}`}
                          role="listitem"
                          onDragStart={(event) => {
                            if (!draggable) return;
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData(DRAG_MIME, row.id);
                            event.dataTransfer.setData("text/plain", row.id);
                            setDraggedId(row.id);
                          }}
                          onDragEnd={() => {
                            setDraggedId(null);
                            setDragTargetId(null);
                          }}
                        >
                          <div className="clientes-kanban-card-head">
                            <button
                              type="button"
                              className="clientes-kanban-card-main"
                              onClick={() => onOpenCliente(row)}
                            >
                              <span className="clientes-kanban-card-title">{row.nome}</span>
                              <span className="clientes-kanban-card-subtitle">{cardSubtitle(row)}</span>
                            </button>

                            <div className="clientes-kanban-card-value">
                              <Wallet className="h-3 w-3" aria-hidden />
                              {currencyFormatter.format(row.valor)}
                            </div>
                          </div>

                          <div className="clientes-kanban-card-badges">
                            {row.responsavelNome ? (
                              <span
                                className="clientes-kanban-responsavel"
                                title={`Responsável: ${row.responsavelNome}`}
                              >
                                <span
                                  className="clientes-kanban-avatar"
                                  style={{
                                    ["--avatar-hue" as string]: String(hue),
                                  }}
                                  aria-hidden
                                >
                                  {getInitials(row.responsavelNome)}
                                </span>
                                <span className="clientes-kanban-responsavel-name">{row.responsavelNome}</span>
                              </span>
                            ) : (
                              <Badge variant="warning" className="clientes-kanban-badge" title="Responsável">
                                <UserRound className="h-3 w-3" aria-hidden />
                                Sem responsável
                              </Badge>
                            )}
                            <Badge
                              variant={ageVariant(row.diasNaEtapa)}
                              className="clientes-kanban-badge"
                              title="Tempo na etapa"
                            >
                              <Clock3 className="h-3 w-3" aria-hidden />
                              {fmtDays(row.diasNaEtapa)}
                            </Badge>
                            <Badge
                              variant={prazoVariant(row.prazoFinal)}
                              className="clientes-kanban-badge"
                              title="Prazo"
                            >
                              <CalendarClock className="h-3 w-3" aria-hidden />
                              {formatNullableDate(row.prazoFinal)}
                            </Badge>
                            <Badge
                              variant={taskVariant(row.tarefasAbertas, row.tarefasUrgentes)}
                              className="clientes-kanban-badge"
                              title="Tarefas abertas"
                            >
                              <CheckCircle2 className="h-3 w-3" aria-hidden />
                              {row.tarefasAbertas} tarefa{row.tarefasAbertas === 1 ? "" : "s"}
                            </Badge>
                            {row.tarefasUrgentes > 0 ? (
                              <Badge variant="danger" className="clientes-kanban-badge" title="Tarefas urgentes">
                                {row.tarefasUrgentes} urgente{row.tarefasUrgentes === 1 ? "" : "s"}
                              </Badge>
                            ) : null}
                          </div>

                          {!row.isArchived && moveTargets.length > 0 ? (
                            <details
                              className="clientes-kanban-move"
                              onToggle={(event) => {
                                const target = event.currentTarget;
                                if (target.open) {
                                  document
                                    .querySelectorAll<HTMLDetailsElement>("details.clientes-kanban-move")
                                    .forEach((el) => {
                                      if (el !== target) el.open = false;
                                    });
                                }
                              }}
                            >
                              <summary aria-label={`Mover ${row.nome} para outra etapa`} title="Mover para outra etapa">
                                <Move className="h-3 w-3" aria-hidden />
                                <span>Mover</span>
                                <ChevronDown className="h-3 w-3 clientes-kanban-move-chevron" aria-hidden />
                              </summary>
                              <div className="clientes-kanban-move-menu" role="menu">
                                {moveTargets.map((stage) => (
                                  <button
                                    key={stage.id}
                                    type="button"
                                    role="menuitem"
                                    className="clientes-kanban-move-item"
                                    onClick={(event) => {
                                      handleMove(row.id, stage.id, row.stageId);
                                      (
                                        event.currentTarget.closest("details") as HTMLDetailsElement | null
                                      )?.removeAttribute("open");
                                    }}
                                  >
                                    <span
                                      className="clientes-kanban-move-color"
                                      style={{ backgroundColor: stage.color }}
                                      aria-hidden
                                    />
                                    <span>{stage.name}</span>
                                  </button>
                                ))}
                              </div>
                            </details>
                          ) : null}

                          {moving ? (
                            <span className="clientes-kanban-moving" aria-label="Movendo cliente">
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            </span>
                          ) : null}
                        </article>
                      );
                    })
                  )}
              </KanbanColumnCards>
            </section>
          );
        })}
      </div>
    </>
  );
}

function KanbanColumnCards({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const updateOverflow = useCallback(() => {
    const wrap = wrapRef.current;
    const scroll = scrollRef.current;
    if (!wrap || !scroll) return;
    const top = scroll.scrollTop > 2;
    const bottom = scroll.scrollTop + scroll.clientHeight < scroll.scrollHeight - 2;
    wrap.dataset.overflowTop = top ? "true" : "false";
    wrap.dataset.overflowBottom = bottom ? "true" : "false";
  }, []);

  useEffect(() => {
    updateOverflow();
    const scroll = scrollRef.current;
    if (!scroll || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(scroll);
    return () => observer.disconnect();
  }, [updateOverflow]);

  return (
    <div className="clientes-kanban-cards-wrap" ref={wrapRef}>
      <div className="clientes-kanban-cards" ref={scrollRef} onScroll={updateOverflow}>
        {children}
      </div>
    </div>
  );
}
