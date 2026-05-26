---
name: pipeline-stages
description: "Subsystem de etapas do funil (`client_pipeline_stages`) — schema, regras de hierarquia, SLA, APIs admin de CRUD/reorder/migrate, e como módulos consomem"
metadata:
  node_type: memory
  type: project
  originSessionId: clientes-context-engineering-2026-05-26
---

`client_pipeline_stages` é a **tabela mãe das etapas do CRM/funil**. Praticamente todo módulo do projeto consulta ela: clientes, funil, tasks de produção, alertas, CS, configurações admin. Mudanças nessa tabela têm impacto largo — leia este doc antes de mexer.

**Why:** Centralizar a definição de etapa (cor, ordem, SLA, hierarquia) em uma única fonte. Tasks, clientes e auditoria referenciam por `id` ou `slug`. A árvore (parent_stage_id) permite agrupar substages na visualização de funil sem duplicar lógica.

**How to apply:** Ao adicionar coisas que referenciam etapas, decida cedo se você quer apontar para a **raiz** ou para uma **subetapa**. Ao mexer em hierarquia, validar contra `app/api/admin/pipeline-stages/reorder/route.ts`.

### Schema (tabela `client_pipeline_stages`)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | Display |
| `slug` | text | `^[a-z0-9]+(?:-[a-z0-9]+)*$` — usado em URLs/queries do funil legado. **Único** (ou deveria ser) |
| `color` | text | `#RRGGBB` |
| `order_index` | int | Ordenação dentro do escopo (root ou irmãos sob um pai) |
| `is_final` | bool | Etapas finais (cliente "saiu do funil"). Não podem virar subetapas (validação em reorder). |
| `is_active` | bool | Soft delete. **Falsa = invisível em /funil e no kanban de /clientes**, mas aparece no detalhe (histórico). |
| `parent_stage_id` | uuid \| null | Aponta para etapa-mãe. **Máximo 2 níveis** (root → sub; sub não pode ter sub). |
| `sla_amount` | int \| null | Quantidade do SLA |
| `sla_unit` | enum | `"business_days" \| "business_hours" \| "calendar_hours"` |
| `warn_at_percent` | int 1-100 | Percentual do SLA para gerar warning (default 80) |
| `followup_days` | int \| null | Dias até disparar followup |
| `created_at`, `updated_at` | timestamptz | |

### Regras de hierarquia (validadas em [reorder/route.ts](app/api/admin/pipeline-stages/reorder/route.ts))

1. Uma etapa **não pode ser pai de si mesma** (`upd.parent_stage_id !== upd.id`).
2. **Etapas finais** (`is_final = true`) **não podem virar subetapas**.
3. O pai precisa **existir e estar ativo** no estado projetado.
4. **Máximo 2 níveis**: o pai não pode ele próprio ser subetapa (`parent.parent_stage_id !== null`).
5. Uma etapa-mãe que **tem filhos não pode virar subetapa** (limite de 2 níveis pelo outro lado).

A validação é feita sobre um **snapshot projetado** (`Map<id, ExistingStage>` mutável) — todas as updates aplicadas in-memory antes de validar, evitando inconsistência momentânea durante reorderings em lote.

### APIs admin ([app/api/admin/pipeline-stages/](app/api/admin/pipeline-stages))

Todas protegidas por `requireAdminAccess()` ([lib/auth/requireAdmin.ts](lib/auth/requireAdmin.ts)) com capability `adminArea` para reads e `admin` default para writes. Usam `createAdminClient` (service role) para writes.

| Método | Rota | Função |
|---|---|---|
| GET | `/api/admin/pipeline-stages` | Lista todas, ordenadas por `parent_stage_id` (nulls first) + `order_index` |
| POST | `/api/admin/pipeline-stages` | Cria. Valida com `createStageSchema` (Zod, [lib/sla/validation.ts](lib/sla/validation.ts:8)) |
| PATCH | `/api/admin/pipeline-stages/[id]` | Atualiza parcial. Schema `updateStageSchema` |
| DELETE | `/api/admin/pipeline-stages/[id]` | **Soft delete** (`is_active = false`). Bloqueia se houver clientes/tasks/subetapas ativas a menos que `?force=true` |
| GET | `/api/admin/pipeline-stages/[id]/impact` | Conta impacto (clientes ativos, tasks abertas, substages ativos). Usado pelo UI antes de deletar |
| POST | `/api/admin/pipeline-stages/[id]/migrate` | Migra clientes + tasks abertos para `target_stage_id`. Registra `client_stage_history` (`action_type: "stage_change"`, `metadata: { migration: true, origin_stage_id }`) e `task_history`. Best-effort: se history falhar, não dá rollback |
| POST | `/api/admin/pipeline-stages/reorder` | Reordena + remapeia `parent_stage_id` em lote. Sem transação multi-row (Supabase JS não suporta) — aplica 1-a-1 e retorna `partial` em falha |

### Consumidores (quem lê `client_pipeline_stages`)

| Caminho | Filtro | Uso |
|---|---|---|
| [lib/api/clientes.ts](lib/api/clientes.ts) | ordenado por order_index | Listagem `/clientes` (sem `is_active` — pega todas) |
| [lib/api/cliente.ts](lib/api/cliente.ts) | `is_active = true`, `parent_stage_id` incluso | Detalhe `/clientes/[id]` |
| [lib/api/funil.ts](lib/api/funil.ts) | `is_active = true`, com SLA fields | `/funil` e `/funil/v1` |
| [lib/clientes/build-data.ts](lib/clientes/build-data.ts) | n/a | Mapeia `current_stage_id` → stage metadata |
| [lib/clientes/kanban.ts](lib/clientes/kanban.ts) | `is_active` apenas | Colunas do kanban de `/clientes` |
| [lib/alerts/evaluateStageSla.ts](lib/alerts/evaluateStageSla.ts) | — | Calcula alertas SLA (cron job) |
| [lib/alerts/evaluateTaskOverdue.ts](lib/alerts/evaluateTaskOverdue.ts) | — | Alertas de task atrasada |
| [app/(protected)/cs/forca-tarefa/page.tsx](app/(protected)/cs/forca-tarefa/page.tsx) | `is_active`, `is_final = false` | Seletor de etapa-fonte para redistribuir |
| [components/settings/etapas-settings.tsx](components/settings/etapas-settings.tsx) | todas | UI admin de configuração |
| [components/settings/stage-edit-sheet.tsx](components/settings/stage-edit-sheet.tsx) | — | Editor de etapa individual |
| [components/settings/stage-create-dialog.tsx](components/settings/stage-create-dialog.tsx) | — | Dialog de criação |
| [app/api/cron/sla-alerts/route.ts](app/api/cron/sla-alerts/route.ts) | — | Cron de SLA |
| [app/api/alerts/route.ts](app/api/alerts/route.ts) | — | Endpoint de alertas |

### Padrão de ordenação topológica

Usado em `lib/api/cliente.ts` (`sortPipelineStages`) e em `buildFunilData` (`rootStages` + `substagesByParent`):

1. Identifica roots (sem `parent_stage_id` ou pai inexistente).
2. Ordena roots por `order_index`.
3. Para cada root, lista filhos diretos ordenados por `order_index`.
4. Visita DFS — root, depois subs ordenadas, depois próximo root.
5. Etapas órfãs (parent existe mas não está na lista carregada) viram roots automaticamente.

Use esse padrão se for adicionar nova UI que liste etapas — não inventar nova ordenação.

### Tabelas que referenciam (FKs)

| Tabela | Coluna | Comportamento |
|---|---|---|
| `clientes_cadastro` | `current_stage_id` | Cliente "está" nesta etapa |
| `production_tasks` | `pipeline_stage_id` | Task pertence a esta etapa |
| `client_stage_history` | `from_stage_id`, `to_stage_id` | Auditoria de mudanças |
| `task_history` | `from_stage_id`, `to_stage_id` | Auditoria de mudanças de etapa em tasks |
| `client_pipeline_stages` | `parent_stage_id` | Self-FK para hierarquia |

Ao soft-deletar uma etapa via DELETE, considere migrar antes (`/migrate`) para não deixar referências apontando para `is_active=false`.

### Schemas Zod ([lib/sla/validation.ts](lib/sla/validation.ts))

- `createStageSchema` — todos campos com default sensato; `parent_stage_id` nullable
- `updateStageSchema` — todos optional
- `reorderStagesSchema` — `{ updates: Array<{id, order_index, parent_stage_id}> }`, min 1
- `migrateStageSchema` — `{ target_stage_id: uuid, reason?: string (max 500) }`
- `createHolidaySchema` / `updateHolidaySchema` — feriados de `business_holidays` (input pro SLA)

### Pegadinhas e regras de ouro

- ⚠️ **`slug` é referenciado por código** — não permite renomear livremente (URLs do funil legado podem quebrar). Migrate cria stage nova ao invés de renomear.
- ⚠️ **`is_final` muda comportamento**: stages finais aparecem na listagem `/clientes` mas **não** geram rows no `/funil` (`if (stage.is_final) continue`).
- ⚠️ **Substages na visão `/funil`**: tasks/clientes em subetapas são "promovidas" pra raiz via `rootStageOf`. No `/clientes/[id]` (detalhe), a hierarquia é preservada.
- ⚠️ **Soft delete não migra automaticamente**: DELETE sem `force=true` retorna 409 com impact counts. UI deve oferecer `/migrate` antes.
- ⚠️ **`reorder` não é transacional**: se falhar no meio, devolve `partial` com o que conseguiu. Frontend deve tratar.
- ⚠️ **Sem `is_active=true` filter na listagem `/clientes`**: clientes em stage desativada continuam aparecendo (com `stageName: null` se foi removida do cache, ou nome anterior). Pode confundir UX.
- Cores são livres (`#RRGGBB`), sem paleta restrita. UI usa diretamente em `style={{ borderColor, color, background }}`.
