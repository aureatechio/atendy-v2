---
name: alerts-system
description: "Sistema unificado de alertas (SLA de etapa + task overdue + followup + vigência contratual): cron job, evaluators puros, diff, persistência em `sla_alerts`, endpoint de leitura"
metadata:
  node_type: memory
  type: project
  originSessionId: clientes-context-engineering-2026-05-26
---

Sistema de alertas é um **pipeline cron → evaluators puros → diff → persistência → endpoint**. Quatro fontes (`stage_sla`, `task_overdue`, `followup`, `contract_expiry`) reconciliadas numa única tabela `sla_alerts` via diff. UI consome via `/api/alerts` que enriquece com cliente/stage/task.

**Why:** Centraliza notificações de "algo precisa de atenção" sem que cada módulo recalcule. Persistir os alertas (ao invés de recalcular sob demanda) garante histórico e permite snooze. Foi unificado no commit `dd7252b` ("alertas unificados SLA/tarefas/follow-up").

**How to apply:** Para adicionar um novo tipo de alerta: (1) cria evaluator puro em `lib/alerts/`, (2) acrescenta no enum `AlertType` em [lib/sla/diffAlerts.ts](lib/sla/diffAlerts.ts:1) e [lib/types.ts](lib/types.ts:93), (3) chama o evaluator no cron e concatena em `snapshot`, (4) atualiza `/api/alerts` se precisar de joins. Não inserir direto na tabela.

### Arquitetura

```
                      ┌─ evaluateStageSla ────┐
business_holidays  ──→│                        │
client_pipeline_stages│  ┌→ snapshot[]        │
production_tasks  ───→│  │                    │
clientes_cadastro ───→│  ├─ evaluateTaskOverdue→ diffAlerts ─→ ops: {insert, update, touch, resolve}
cliente_last_interaction  │                        ↑
clientes_cadastro.vigencia│ ├─ evaluateFollowup ───┤
                      │  └─ evaluateContractExpiry┘
                      └──────────────────────────  │
                                                   │
                            sla_alerts (resolved_at IS NULL) ──┘
```

Cron `/api/cron/sla-alerts` orquestra tudo. UI lê `/api/alerts`.

### Tipos (`AlertType`)

`type AlertType = "stage_sla" | "task_overdue" | "followup" | "contract_expiry"` — declarado em **dois lugares**:
- [lib/types.ts:93](lib/types.ts:93) — para `Alert` (UI)
- [lib/sla/diffAlerts.ts:1](lib/sla/diffAlerts.ts:1) — para `CurrentAlert`/`OpenAlert` (cron internals)

Manter sincronizados.

### Evaluators (todos puros, testáveis sem Supabase)

#### `evaluateStageSla` ([lib/alerts/evaluateStageSla.ts](lib/alerts/evaluateStageSla.ts))
- Input: tasks abertas com `pipeline_stage_id`, `stageById` (com `sla_amount`, `sla_unit`, `warn_at_percent`, `is_final`), `holidays` (Set).
- Para cada task: pega stage, ignora se `is_final` ou `sla_amount=null` ou sem `enteredAt` (`started_at ?? created_at`).
- Chama `evaluateSla` ([lib/sla/calculateDeadline.ts:140](lib/sla/calculateDeadline.ts:140)) — retorna `{ status, deadline, hoursRemaining }`.
- **Só gera alerta** se status `warning` ou `overdue`.
- Dedupe por `${cliente_id}:${stage_id}` (Map) — múltiplas tasks na mesma etapa = 1 alerta.

#### `evaluateTaskOverdue` ([lib/alerts/evaluateTaskOverdue.ts](lib/alerts/evaluateTaskOverdue.ts))
- Input: tasks com `deadline not null` e `status != concluido`.
- Regra simples: `deadline < now` → alerta `"overdue"`.
- Sem warning (binário). Sem dedupe (1 task = até 1 alerta).
- **Independente do SLA da etapa** — task pode ter prazo próprio.

#### `evaluateFollowup` ([lib/alerts/evaluateFollowup.ts](lib/alerts/evaluateFollowup.ts))
- Input: clientes ativos (`current_stage_id not null`), stages (com `followup_days`, `is_final`), `lastInteractionByCliente` (Map vinda da view `cliente_last_interaction`), `warnAtPercent` (default 80).
- Para cada cliente: ignora se stage final ou sem `followup_days > 0` ou sem `lastInteraction`.
- "Relógio de interação" reseta em: comments, stage moves, meetings, adjustments, task activity (lógica na view, não no código).
- `elapsedPercent = (now - lastInteraction) / (followup_days * dayMs) * 100`.
  - `>= 100` → `overdue`
  - `>= warnAtPercent` → `warning`
- 1 alerta por cliente.

#### `evaluateContractExpiry` ([lib/alerts/evaluateContractExpiry.ts](lib/alerts/evaluateContractExpiry.ts))
- Input: clientes com `id`, `vigencia`, `inicio_vigencia`, `data_contrato_assinado`.
- Fonte: `clientes_cadastro.vigencia` (não usa `compras.fimdireitouso` na v1).
- Inclui clientes arquivados; o cron não filtra `is_archived`.
- Aceita `vigencia` em `YYYY-MM-DD`, `DD/MM/YYYY` e ISO datetime; interpreta a data como válida até 23:59:59.999 em `America/Sao_Paulo`.
- Janela fixa da v1: `warning` quando vence entre hoje e 15 dias, inclusive; `overdue` quando a data final é anterior ao dia atual.
- `enteredAt`: `inicio_vigencia` válido, senão `data_contrato_assinado` válido, senão o próprio `deadline`.
- 1 alerta por cliente (`stageId=null`, `taskId=null`).

### Diff (`diffAlerts` em [lib/sla/diffAlerts.ts](lib/sla/diffAlerts.ts:59))

Reconcilia snapshot (calculado agora) vs open alerts (DB, `resolved_at IS NULL`):

- Key: `${type}:${clienteId}:${stageId ?? "-"}:${taskId ?? "-"}` — alertas de tipos diferentes nunca colidem.
- 4 operações:
  - `toInsert` — alerta novo (não existe key no DB)
  - `toUpdate` — key existe mas status, `entered_at` ou `deadline` mudou
  - `toTouch` — key existe e status igual → só atualiza `last_seen_at` (heartbeat)
  - `toResolve` — alerta no DB sumiu do snapshot → set `resolved_at = now`

### Tabela `sla_alerts` (schema usado)

| Campo | Notas |
|---|---|
| `id` | uuid PK |
| `type` | `AlertType` (nullable, default `"stage_sla"` no consumer) |
| `cliente_id` | FK → `clientes_cadastro` (inner join no `/api/alerts` — alerta sem cliente é filtrado) |
| `stage_id` | nullable |
| `task_id` | nullable |
| `status` | `"warning" \| "overdue"` |
| `fired_at` | Quando inserido pela primeira vez |
| `last_seen_at` | Atualizado em `toTouch` e `toUpdate` |
| `deadline` | Para exibição |
| `entered_at` | Para exibição |
| `resolved_at` | Null = aberto. Filtro principal das queries |
| `snoozed_until` | UI usa para esconder temporariamente — query no `/api/alerts` aceita null ou `< now` |

Para `contract_expiry`, `stage_id` e `task_id` são `null`; a unicidade aberta garante no máximo 1 alerta de vigência aberto por cliente.

### Cron `/api/cron/sla-alerts` ([app/api/cron/sla-alerts/route.ts](app/api/cron/sla-alerts/route.ts))

- Runtime: `nodejs`. Dynamic: `force-dynamic`.
- **Auth**: header `Authorization: Bearer $CRON_SECRET`. Sem isso → 401. Sem env → 500.
- Cliente: `createAdminClient()` (service role).
- Carrega 7 datasets em paralelo (paginação 1000) — stages, stageTasks, overdueTasks, clientes, lastInteractions (view `cliente_last_interaction`), holidays, contractClientes (`clientes_cadastro.vigencia`).
- Roda os 4 evaluators, concatena em `snapshot[]`.
- Carrega `openAlerts` (`resolved_at IS NULL`), chama `diffAlerts`.
- Aplica `insert`, `update`, `touch` (bulk `IN`), `resolve` (bulk `IN`).
- Retorna JSON com contadores.

⚠️ Não usa transação — operações independentes podem falhar parcialmente.

### Endpoint `/api/alerts` ([app/api/alerts/route.ts](app/api/alerts/route.ts))

- Auth: precisa de `auth.getUser()` (qualquer user autenticado pode ler).
- Filtra `resolved_at IS NULL` e (`snoozed_until` null OR `< now`).
- Joins inner com `clientes_cadastro`, left com `client_pipeline_stages` e `production_tasks`.
- Ordena: `status DESC` (overdue antes), `fired_at DESC`.
- Filtra rows sem cliente (`r.cliente`).
- Devolve `Alert[]` (definido em [lib/types.ts:95](lib/types.ts:95)).

### UI

| Componente | Path |
|---|---|
| Bell na topbar | [components/layout/sla-bell.tsx](components/layout/sla-bell.tsx) |
| Lista de alertas | [components/alerts/alerts-view.tsx](components/alerts/alerts-view.tsx) |

(Há também `app/api/sla-alerts/route.ts` — verificar se é legado/duplicado antes de mexer.)

### Tipo `Alert` (consumido pela UI, [lib/types.ts:95](lib/types.ts:95))

```ts
interface Alert {
  id: string;
  type: AlertType;
  status: "warning" | "overdue";
  firedAt: string;
  deadline: string;
  lastSeenAt: string;
  snoozedUntil: string | null;
  cliente: { id; nome; responsavelId };
  stage: { id; name; slug; color } | null;
  task: { id; title } | null;
}

/** @deprecated use `Alert` */
export type SlaAlert = Alert;
```

### Pegadinhas

- ⚠️ **Duas declarações de `AlertType`** (em `types.ts` e `diffAlerts.ts`). Não há import compartilhado — sincronizar manualmente.
- ⚠️ **`cliente_last_interaction` é uma view do Postgres**, não tabela. A lógica de "o que conta como interação" está no SQL da view, não no TS. Para mexer no comportamento de followup, editar a view (não tem migration nesse repo, suspeito).
- ⚠️ **`/api/sla-alerts` vs `/api/alerts`** — coexistem. Provavelmente legado vs atual. Verificar `app/api/sla-alerts/route.ts` antes de fazer mudanças.
- ⚠️ Cron sem transação — falhas parciais são possíveis. Em produção, idempotência do diff cobre na próxima execução.
- ⚠️ `task_overdue` não tem warning (só overdue). Se quiser warning, precisaria estender o evaluator pra olhar `warn_at_percent` da etapa OU adicionar campo na task.
- ⚠️ `evaluateFollowup` usa `warnAtPercent` parametrizado (default 80), **não** o da etapa. Diferente de `evaluateStageSla` que usa o da etapa.
- ⚠️ Alerta resolvido **não é apagado** — fica com `resolved_at != null`. Limpeza/expurgo seria responsabilidade externa.
- ⚠️ `contract_expiry` segue a semântica atual de resolver: se a vigência continuar dentro da regra, o próximo cron pode recriar o alerta. Para esconder temporariamente, usar snooze.
