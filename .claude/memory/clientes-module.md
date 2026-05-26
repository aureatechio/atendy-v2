---
name: clientes-module
description: "Estrutura, fluxos de dados, tabelas Supabase, server actions e componentes do módulo /clientes (CRM core) do Atendy v2"
metadata:
  node_type: memory
  type: project
  originSessionId: clientes-context-engineering-2026-05-26
---

Módulo `/clientes` é o **core do CRM** — listagem, kanban e detalhe de cada cliente. É a porta de entrada do funil de vendas e a página mais usada pelas atendentes. O módulo `/cs` (Customer Success) opera sobre os mesmos dados com lente gerencial — ver [cs-module.md](cs-module.md).

**Why:** Centraliza a tabela mestre `clientes_cadastro` + tudo que orbita em volta (etapas, histórico, tarefas, reuniões, comentários, ajustes). Foi consolidado para substituir o módulo legado `/funil` (que ainda existe em paralelo).

**How to apply:** Ao tocar qualquer coisa sob `/clientes/*` lembrar que (1) toda mudança de etapa deve passar por `changeStage` para gravar `client_stage_history`, (2) o build dos itens de listagem é centralizado em `buildClientesData` e reaproveitado pela API de detalhe rápido (`getClienteQuickDetail`), (3) `changeStage` revalida `/clientes`, `/funil`, `/funil/v1` e `/clientes/[id]`.

### Rotas e shell
- `app/(protected)/clientes/page.tsx` — server component, `dynamic = "force-dynamic"`. Chama `getClientesDados()` e renderiza `<ClientesDashboard initialData={data} />`. Em erro mostra Card com fallback.
- `app/(protected)/clientes/[id]/page.tsx` — server component. Chama `getClienteDetalhes(id)`, renderiza header com KPIs + 6 cards (Info, Histórico, Comentários, Tarefas, Reuniões, Ajustes). Link "Voltar ao funil" aponta para `/funil` (não `/clientes`).
- `app/(protected)/clientes/[id]/actions.ts` — server actions: `addComment`, `changeStage`, `setArchived`.

### Dados de listagem (`/clientes`)

#### Pipeline
1. `getClientesDados()` em [lib/api/clientes.ts](lib/api/clientes.ts:74) busca em paralelo (`Promise.all`) com paginação em 1000 registros via `fetchSupabaseAll`:
   - `client_pipeline_stages` (id, name, slug, color, order_index, is_final, is_active) — ordenado por `order_index`
   - `clientes_cadastro` (~40 campos)
   - `segmentos` (id, nome), `subsegmentos` (id, nome)
   - `production_tasks` (filtrado `status != COMPLETED_TASK_STATUS`)
   - `client_meetings`
2. Coleta IDs de profile referenciados, busca `profiles` em uma query única `.in("id", profileIds)`.
3. Passa tudo para `buildClientesData(input)` em [lib/clientes/build-data.ts](lib/clientes/build-data.ts:145) que retorna `{ items, stages, profiles }` (`ClientesData`).

#### Derivados calculados em `buildClientesData`
- `valor`: `numberValue(client.valor) || numberValue(client.deal_value)` — fallback do legacy `deal_value`.
- `nome`: `nomecliente ?? nome ?? nome_fantasia ?? "Cliente sem nome"`.
- `diasNaEtapa`: `daysSince(stage_entered_at ?? created_at, now)`.
- `tarefasAbertas`, `tarefasUrgentes`: contam só `production_tasks` com `status != concluida`.
- `nextMeetingAt`: primeira reunião futura, ignora status `cancelled/canceled/cancelada/cancelado/done/completed/concluida/concluido`.
- `lastActivityAt`: `maxIso([created_at, stage_entered_at, archived_at, ...tasks.created_at, ...meetings.scheduled_at])`.

### Dashboard ([components/cliente/clientes-dashboard.tsx](components/cliente/clientes-dashboard.tsx))

669 linhas, client component. Controla:
- **View toggle** `list | kanban` persistido em `localStorage` chave `atendy:clientes:view`.
- **Colunas visíveis** persistidas em `atendy:clientes:columns`. Ordem fixa em `columnOrder`. Colunas: cliente, stage, responsavel, prazo, tempo, tarefas, valor, celebridade, praca, actions.
- **Paginação** via `usePaginatedTable` — 50 itens/página, só aplica no list view (kanban mostra todos).
- **Filtros** via `useClientesFilters` ([hooks/useClientesFilters.ts](hooks/useClientesFilters.ts)) — search, period+periodField+preset, stage, responsável, status (active/archived/all), prazo (all/overdue/today/next7/none), segmento, subsegmento, celebridade, praça, classificação, valorMin/Max, diasMin/Max, tarefaUrgente, semResponsavel, comReuniao, sortKey, sortDir.
- **Sort keys**: `nome | stageOrder | responsavelNome | prazoFinal | diasNaEtapa | valor | lastActivityAt`.
- **`prazoVariant`**: badge danger se vencido, warning se ≤7 dias, default caso contrário.
- **Quick drawer**: ao clicar numa linha abre `<ClienteQuickDrawer>` ([components/cliente/cliente-quick-drawer.tsx](components/cliente/cliente-quick-drawer.tsx)) — busca via `getClienteQuickDetail(id)`.
- **StageOverride local**: ao mudar etapa pelo dashboard, aplica override otimista enquanto `router.refresh()` não chega.

### Kanban ([components/cliente/clientes-kanban-view.tsx](components/cliente/clientes-kanban-view.tsx))

473 linhas. Drag-and-drop **nativo do browser** (sem dependência). Helper `buildClientesKanbanColumns(rows, stages)` em [lib/clientes/kanban.ts](lib/clientes/kanban.ts:26):
- Inclui só `stages.filter(s => s.is_active)` ordenadas por `order_index`.
- Cria coluna fantasma `"Sem etapa"` (id `CLIENTES_NO_STAGE_COLUMN_ID = "__no_stage__"`, cor `#94a3b8`, order `MAX_SAFE_INTEGER`) **apenas se** existirem clientes com `stageId` nulo ou inexistente.
- Cada coluna calcula `count` e `totalValue` (soma de `valor`).

Plano original: [docs/superpowers/plans/2026-05-25-clientes-kanban-funil.md](docs/superpowers/plans/2026-05-25-clientes-kanban-funil.md).

### Detalhe (`/clientes/[id]`)

#### Carregamento
`getClienteDetalhes(id)` em [lib/api/cliente.ts](lib/api/cliente.ts:174):
1. Busca o cliente em `clientes_cadastro` por `eq("id", id).maybeSingle()` — campos ricos (`briefing`, `notes`, `negocio_id`, `channel`, `vigencia`, `data_primeira_entrega`, `link_pasta_entrega`, etc.) que não vêm na listagem.
2. `Promise.all` em paralelo:
   - `client_pipeline_stages` (eq `is_active=true`, com `parent_stage_id`)
   - `client_stage_history` (limit 100, ordem desc por created_at)
   - `client_comments` (limit 100)
   - `production_tasks` (filtrado por cliente + abertas, limit 100)
   - `client_meetings` (limit 50)
   - `client_adjustments` (limit 50)
3. Coleta TODOS os profile IDs (responsável, changed_by, from/to_assigned_to, author_id, assigned_to, organizer_id, created_by, completed_by) e busca em uma query.
4. **`sortPipelineStages`**: ordenação topológica respeitando `parent_stage_id` — substages aparecem logo após o pai. Stages órfãos (parent inexistente) ficam como roots.

#### UI — cards renderizados em [page.tsx](app/(protected)/clientes/[id]/page.tsx)
| Card | Função | Componente |
|---|---|---|
| Header | KPIs (valor, responsável, celebridade, prazo) + chip da etapa atual + dias na etapa | inline + `<ClienteActions>` |
| **Informações** | WhatsApp formatado, email, instagram, razão social, CNPJ formatado, segmento, subsegmento, praça, vigência (com dias restantes), datas contrato, links Drive/Proposta. Briefing (HTML stripped via `htmlToPlainText`) + notas. | `InfoCard` |
| **Histórico** | Timeline com tipos `stage_change`, `assignment_change`, `created`, `bulk_reassignment`. Mostra from→to com cor da etapa de destino. | `StageHistoryCard` |
| **Comentários** | Form `<ClienteAddComment>` (textarea + ⌘+Enter) + lista. | `CommentsCard` |
| **Tarefas** | Tarefas abertas com badge "Urgente", chip da etapa, prioridade, prazo, responsável. | `TasksCard` |
| **Reuniões** | Próximas + link "Abrir" se `meeting_link`. | `MeetingsCard` |
| **Ajustes** | Marca `is-done` se `completed_at`. Tipo do ajuste, status, conteúdo, autor. | `AdjustmentsCard` |

### Server Actions ([app/(protected)/clientes/[id]/actions.ts](app/(protected)/clientes/[id]/actions.ts))

Todas retornam `ActionResult = { ok, error? }` e validam `auth.getUser()`.

| Action | Efeito | Revalidações |
|---|---|---|
| `addComment(clienteId, content)` | Insert em `client_comments` com `author_id = user.id`. Trim vazio rejeitado. | `/clientes/[id]` |
| `changeStage(clienteId, newStageId)` | Lê stage atual; se diferente, atualiza `current_stage_id`, `stage_entered_at`, `updated_at`. Insert em `client_stage_history` com `action_type: "stage_change"`, `changed_by: user.id`. Se igual à atual, retorna ok sem op. | `/clientes`, `/funil`, `/funil/v1`, `/clientes/[id]` |
| `setArchived(clienteId, archived)` | Update `is_archived`, `archived_at` (null se desarquivando), `updated_at`. | `/clientes`, `/funil`, `/funil/v1`, `/clientes/[id]` (alinhado com `changeStage` em 2026-05-26) |

### Tabelas Supabase tocadas (project `cfgeilnppnlyhwnabkox`)

| Tabela | Uso | Campos críticos |
|---|---|---|
| `clientes_cadastro` | Master | `current_stage_id`, `stage_entered_at`, `valor`, `deal_value` (legacy), `prazo_final`, `responsavel_atendimento`, `assigned_to`, `is_archived`, `archived_at`, `briefing`, `notes`, `vigencia`, `inicio_vigencia`, `data_contrato_assinado`, `data_primeira_entrega`, `link_pasta_drive`, `link_proposta`, `link_pasta_entrega` |
| `client_pipeline_stages` | Etapas funil | `order_index`, `is_final`, `is_active`, `parent_stage_id` (substages), `slug`, `color` |
| `client_stage_history` | Auditoria | `action_type` ∈ {`stage_change`, `assignment_change`, `created`, `bulk_reassignment`}, `from/to_stage_id`, `from/to_assigned_to`, `changed_by`, `reason`, `metadata` |
| `client_comments` | Comentários internos | `author_id`, `content` |
| `production_tasks` | Tarefas | `status` (filtrar `!= COMPLETED_TASK_STATUS`), `is_urgent`, `priority`, `deadline`, `pipeline_stage_id` |
| `client_meetings` | Reuniões | `scheduled_at`, `meeting_link`, `status`, `organizer_id` |
| `client_adjustments` | Ajustes/correções | `adjustment_type`, `status`, `completed_at`, `task_id` |
| `profiles` | Nomes de usuários | `full_name`, `avatar_url` — sempre buscado por `.in("id", ids)` ao final do pipeline |
| `segmentos`, `subsegmentos` | Categorização | `nome` |

### Tipos centrais ([lib/clientes/types.ts](lib/clientes/types.ts))
- `ClientesData = { items: ClienteListItem[], stages: ClienteStageSummary[], profiles: ClienteProfileSummary[] }`
- `ClienteListItem` — versão achatada/derivada para listagem e kanban (44 campos, inclui `diasNaEtapa`, `tarefasAbertas`, `nextMeetingAt`, `lastActivityAt`).
- `ClienteQuickDetail = { cliente, tasks[], comments[], meetings[] }` — usado pelo drawer.
- `ClientesFiltersState` — shape completo do filtro persistido.

### Tipos do detalhe ([lib/api/cliente.ts](lib/api/cliente.ts))
`ClienteFull` (~45 campos crus), `ClienteStage`, `ClienteStageHistoryEntry`, `ClienteComment`, `ClienteTask`, `ClienteMeeting`, `ClienteAdjustment`, `ClienteProfile`. `ClienteDetalhes = { cliente, stages, stageHistory, comments, tasks, meetings, adjustments, profiles: Record<string, ClienteProfile> }`.

### Helpers ([lib/clientes/format.ts](lib/clientes/format.ts))
- `buildWhatsappHref(phone)` — gera `https://wa.me/...` (usado no header, drawer, dashboard, kanban).
- `formatPhone`, `formatCnpj`, `parseClienteDate`, `formatNullableDate`.

### Componentes-chave
| Path | Linhas | Responsabilidade |
|---|---|---|
| `components/cliente/clientes-dashboard.tsx` | 669 | Toggle list/kanban, filtros, paginação, drawer trigger |
| `components/cliente/clientes-kanban-view.tsx` | 473 | Colunas + drag-and-drop nativo, update otimista |
| `components/cliente/cliente-quick-drawer.tsx` | 332 | Drawer lateral com `getClienteQuickDetail` |
| `components/cliente/cliente-actions.tsx` | 163 | Select de etapa + arquivo + WhatsApp + form de comentário (na detalhe) |
| `components/cliente/whatsapp-copy-button.tsx` | — | Botão copiar número formatado |

### Notas operacionais e pegadinhas
- **`/funil` ainda existe em paralelo** (e o botão "Voltar" do detalhe aponta pra lá, não pra `/clientes`). Ao mexer em etapas, revalidar ambos.
- O `quick-drawer` faz **request adicional** ao Supabase (`getClienteQuickDetail`) — não reusa o `ClienteListItem` da listagem. Trade-off: dados sempre frescos vs. round-trip extra.
- `buildClientesData` é **puro** (testável sem Supabase) — `lib/api/clientes.ts` é o adaptador IO. Use isso ao adicionar testes.
- Profile IDs no listagem **NÃO** incluem comentários (não há `client_comments` na lista). Em `getClienteQuickDetail` sim.
- `is_active = false` em stages: aparecem no detalhe (`sortPipelineStages` inclui todas) mas **não** no kanban (`buildClientesKanbanColumns` filtra).
- Filtro de tasks abertas é replicado em 3 lugares (lista, detalhe, drawer) via `COMPLETED_TASK_STATUS` de `lib/production-tasks/status` — fonte única.
- `setArchived` **revalida** `/clientes`, `/funil`, `/funil/v1` e `/clientes/[id]` desde 2026-05-26 (alinhado com `changeStage`/`assignResponsavel`). Antes dessa data revalidava só o detalhe.
- O componente `ClienteActions` desabilita o select de etapa quando `isArchived = true` (não dá pra mover cliente arquivado).
