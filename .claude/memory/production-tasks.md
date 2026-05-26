---
name: production-tasks
description: "Tabela `production_tasks` — schema, status enum, consumidores em /clientes, /funil, /cs, alertas. Não tem rota dedicada; é dependência transversal"
metadata:
  node_type: memory
  type: project
  originSessionId: clientes-context-engineering-2026-05-26
---

`production_tasks` é a **tabela de tarefas de produção do CRM**, ligada a um cliente e (opcionalmente) a uma etapa. **Não tem módulo/rota dedicada** — é dependência de quase todos os módulos do funil. Mexer no schema dessa tabela afeta ≥7 lugares.

**Why:** Representa unidades de trabalho dos clientes ativos (entregas, ações operacionais). Alimenta o funil (linha = task em etapa), os alertas (overdue por deadline ou SLA), os cards de detalhe e a métrica "tarefas urgentes" da listagem.

**How to apply:** Antes de adicionar coluna ou regra, conferir os 9 lugares listados em "Consumidores" — provavelmente vai precisar atualizar `select` e tipagem em vários. Filtro de status aberto sempre via constante `COMPLETED_TASK_STATUS`.

### Schema (colunas referenciadas no código)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `cliente_id` | uuid | FK → `clientes_cadastro` (pode ser null em rows órfãs, sempre filtrado) |
| `pipeline_stage_id` | uuid \| null | FK → `client_pipeline_stages`. Pode ser null (tasks "soltas") |
| `assigned_to` | uuid \| null | FK → `profiles` |
| `title` | text \| null | |
| `status` | text \| null | **Comparar sempre via `COMPLETED_TASK_STATUS = "concluido"`** ([lib/production-tasks/status.ts](lib/production-tasks/status.ts)). Aberto = qualquer valor diferente |
| `priority` | text \| null | String livre |
| `is_urgent` | bool \| null | Flag de urgência. Aparece como badge "Urgente" |
| `deadline` | timestamptz \| null | Prazo individual da task. Usado por `evaluateTaskOverdue` |
| `started_at` | timestamptz \| null | Quando entrou em execução. Usado para SLA (`task.started_at ?? task.created_at`) |
| `created_at` | timestamptz \| null | |
| `updated_at` | timestamptz \| null | Atualizado em migrações de etapa |

### Status — só uma constante

Não há enum nem schema Zod. Apenas a constante mágica:
```ts
// lib/production-tasks/status.ts
export const COMPLETED_TASK_STATUS = "concluido";
```
Todos os filtros `.neq("status", COMPLETED_TASK_STATUS)` referenciam essa constante. Não inlinear `"concluido"` em queries novas.

### Tabela irmã: `task_history`

Auditoria de mudanças de etapa em tasks. Mesmo formato que `client_stage_history` mas para tasks:
- `task_id`, `from_stage_id`, `to_stage_id`, `changed_by`, `action_type`, `metadata`
- Inserida pelo `/api/admin/pipeline-stages/[id]/migrate` quando uma etapa é migrada (best-effort, sem rollback)

### Consumidores

| Caminho | Operação | Filtros |
|---|---|---|
| [lib/api/clientes.ts](lib/api/clientes.ts:99) | Lista de clientes (count + flags) | `status != COMPLETED_TASK_STATUS` |
| [lib/api/cliente.ts](lib/api/cliente.ts:222) | Detalhe + drawer | `cliente_id = id`, `status != COMPLETED_TASK_STATUS`, limit 100 |
| [lib/api/funil.ts](lib/api/funil.ts:286) | Rows do funil | `pipeline_stage_id not null`, `status != concluido` |
| [lib/clientes/build-data.ts](lib/clientes/build-data.ts) | Calcula `tarefasAbertas`, `tarefasUrgentes` | Mesmo filtro |
| [lib/alerts/evaluateStageSla.ts](lib/alerts/evaluateStageSla.ts) | Alerts SLA por etapa | Tasks abertas + stage com `sla_amount` |
| [lib/alerts/evaluateTaskOverdue.ts](lib/alerts/evaluateTaskOverdue.ts) | Alerts task overdue | `status != "concluido"`, `deadline < now` |
| [app/api/cron/sla-alerts/route.ts](app/api/cron/sla-alerts/route.ts) | Loader do cron | Paginação 1000, dois selects diferentes (stageTasks + overdueTasks) |
| [app/api/admin/pipeline-stages/[id]/route.ts](app/api/admin/pipeline-stages/[id]/route.ts) | Bloqueia delete se há tasks abertas | count(id) onde `pipeline_stage_id = X` |
| [app/api/admin/pipeline-stages/[id]/migrate/route.ts](app/api/admin/pipeline-stages/[id]/migrate/route.ts) | Migra `pipeline_stage_id` em lote | `eq pipeline_stage_id`, `neq status concluido` |

### Como tasks aparecem na UI

- **Detalhe do cliente** (`/clientes/[id]`): card `TasksCard` lista até 100 abertas com chip da etapa, prioridade, deadline, responsável, badge urgente.
- **Drawer rápido** (`/clientes` quick drawer): até 8 mais recentes via `getClienteQuickDetail`.
- **Listagem `/clientes`**: colunas `tarefas` (count) e `tarefaUrgente` (filtro booleano).
- **`/funil` V2/V1**: cada task aberta vira `FunilRow`, agrupada na raiz da etapa via `rootStageOf`.
- **`/alerts`**: alertas do tipo `task_overdue` linkam pra task individual.
- **Não há tela própria para criar/editar tasks** no app atual — são criadas externamente ou via integração.

### Modelo de mudança de etapa em task

Quando admin migra etapa (`/api/admin/pipeline-stages/[id]/migrate`):
1. Update bulk `pipeline_stage_id` + `updated_at` em todas as tasks abertas na origem.
2. Insert em `task_history` com `action_type: "stage_change"`, `metadata: { migration: true, origin_stage_id, reason }`.
3. History é best-effort — se falhar, log no console mas não dá rollback.

**Não existe** server action equivalente a `changeStage` para tasks individuais (apenas via admin migrate).

### Pegadinhas

- ⚠️ Status `"concluido"` é hardcoded sem migration constraint — qualquer string serve. Se alguém escrever `"Concluido"` (maiúscula) o filtro de `concluida` quebra silenciosamente. Considerar enum no Postgres.
- ⚠️ `is_urgent` é boolean nullable — `tarefasUrgentes` usa `tasks.filter((task) => task.is_urgent)` (truthy check), trata null como false. OK na prática.
- ⚠️ Task sem `pipeline_stage_id` **não aparece no funil** (filtro `not null`). Aparece no detalhe do cliente.
- ⚠️ `evaluateStageSla` ignora tasks em stage com `is_final = true` ou `sla_amount = null`. Não gera alerta.
- ⚠️ `evaluateTaskOverdue` precisa de `deadline` (filtro `not null`) **e** status diferente de `"concluido"`. Sem deadline = sem alerta.
- ⚠️ `activeSince` em tasks (`started_at ?? created_at`) — se ambos forem null, row é skippada pelo evaluator e pelo funil.
