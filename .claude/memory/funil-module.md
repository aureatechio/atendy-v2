---
name: funil-module
description: "Estrutura do módulo /funil — visão de pipeline de produção (Funil de Produção V2 e Vista detalhada V1), distinto de /clientes mas alimentado pelas mesmas tabelas"
metadata:
  node_type: memory
  type: project
  originSessionId: clientes-context-engineering-2026-05-26
---

`/funil` é o módulo **visual de pipeline de produção** — mostra como clientes/tasks se distribuem pelas etapas. **Coexiste com `/clientes`** (que é o CRM tabular/kanban) e foi mantido em paralelo. O detalhe de cliente em `/clientes/[id]` tem botão "Voltar ao funil" apontando pra `/funil` (não `/clientes`).

**Why:** É a "visão de processo" — agrupa por etapa, mostra SLA, rótulos, kanban-de-produção. Difere de `/clientes` que é "visão de carteira" (lista de pessoas + filtros).

**How to apply:** Ao mexer em coisa que afete tasks/etapas, lembrar de revalidar **`/funil` e `/funil/v1`** além de `/clientes`. O legado já segue esse contrato em `changeStage`, `assignResponsavel` e CS força-tarefa — ver [clientes-module.md](clientes-module.md).

### Rotas
- `app/(protected)/funil/page.tsx` (43 linhas) — `getFunilDados()` → `<FunilDashboardV2 initialData={data} />`. Default V2.
- `app/(protected)/funil/v1/page.tsx` (62 linhas) — mesma data, renderiza **`<FunilDashboard>` (V1, legado)** com header "Vista detalhada". Útil para análise lateral.

Ambas `dynamic = "force-dynamic"`.

### Dados (`getFunilDados` em [lib/api/funil.ts](lib/api/funil.ts:265))

Diferente de `/clientes`: foca em **active rows** (1 cliente × etapa onde tem task aberta OU posição atual). Filtra por `is_archived = false`.

`Promise.all` busca:
- `client_pipeline_stages` (eq `is_active=true`, com `sla_amount`, `sla_unit`, `warn_at_percent`, `followup_days`)
- `production_tasks` (eq `pipeline_stage_id not null`, `status != concluida`)
- `clientes_cadastro` (eq `is_archived = false`)
- `profiles`, `segmentos`, `subsegmentos`
- `business_holidays` (feriados para cálculo SLA com `business_days`/`business_hours`)

Tudo via `fetchSupabaseAll` ([lib/supabase/paginate.ts](lib/supabase/paginate.ts)) — paginação automática.

### `buildFunilData` ([lib/api/funil.ts](lib/api/funil.ts:89))

Função **pura**, testável.

#### Regras-chave
1. **`rootStageOf(stage)`**: sobe a árvore via `parent_stage_id` até a raiz, com proteção contra loops (Set de IDs visitados). Subetapas são agrupadas debaixo da etapa-mãe na visualização.
2. **Linha primária por task**: para cada `production_task` aberta com `cliente_id` ativo, gera uma `FunilRow` na **raiz** da etapa da task. Deduplica por `${cliente_id}:${rootStage.id}` (key `activeClientKeys`).
3. **Linha fallback por cliente**: clientes ativos sem task aberta em etapa não-final são adicionados pela `current_stage_id` deles (sem filtro `is_final` — vai pra coluna mesmo se for final).
4. **`activeSince`**: `task.started_at ?? task.created_at` para rows-de-task; `client.stage_entered_at ?? client.created_at` para rows-de-cliente.
5. **SLA** via `evaluateSla` ([lib/sla/calculateDeadline.ts](lib/sla/calculateDeadline.ts)): aceita `business_days | business_hours | calendar_hours` e o `Set<string>` de feriados. Retorna `{ status: SlaStatus, deadline, hoursRemaining }`. `SlaStatus = "ok" | "warning" | "overdue" | "none"`.

#### Output (`FunilData` em [lib/types.ts](lib/types.ts:136))
```ts
{
  stages_meta: FunilStageMeta[],  // só roots, com substages[] aninhadas
  rows: FunilRow[],                // { c: clienteId, s: stageSlug, d: daysSince, a: activeSinceDateKey, l: linkId, slaStatus, slaDeadline, slaHoursRemaining }
  valor_map: Record<clienteId, valor>,
  clients_map: Record<clienteId, FunilClientDetail>  // nome, whatsapp, responsavel, segmento, prazo, celebridade
}
```

`FunilStageMeta` carrega `sla_amount`, `sla_unit`, `warn_at_percent`, `followup_days` — V2 usa para badge de SLA no header de cada coluna.

### Dashboards

| Componente | Linhas | Versão | Onde |
|---|---|---|---|
| `components/dashboard/funil-dashboard-v2.tsx` | 782 | **V2 (atual)** | `/funil` |
| `components/dashboard/funil-dashboard.tsx` | 405 | V1 (legacy) | `/funil/v1` |
| `components/dashboard/funil-stage-drawer.tsx` | — | Drawer compartilhado de detalhe da etapa | ambos |

Classes CSS V2 usam prefixo `fv2-*` (`fv2-kpi`, `fv2-pipeline`, `fv2-ribbon-svg`).

### Diferenças `/funil` × `/clientes` (não confundir!)

| Aspecto | `/funil` | `/clientes` |
|---|---|---|
| Lente | Pipeline / processo | Carteira / lista |
| Unidade | Row (cliente×etapa) | Cliente |
| Arquivados | **Sempre excluídos** (`is_archived=false` no SQL) | Filtro toggleável `active/archived/all` |
| Etapas inativas | Sempre excluídas (`is_active=true` no SQL) | Excluídas só do kanban; aparecem no detalhe |
| Substages | Re-agregadas na raiz via `rootStageOf` | Listadas separadamente |
| Tasks finalizadas | Excluídas (`status != concluida`) | Idem |
| Foco do SLA | **Sim** — colunas mostram SLA por etapa | Não usa SLA na lista |
| Cliente sem task | Aparece pela `current_stage_id` | Idem |
| Build helper | `buildFunilData` (puro) | `buildClientesData` (puro) |
| API entrypoint | `lib/api/funil.ts` | `lib/api/clientes.ts` |

### Contrato de revalidação (memorizar!)

Mutations que mudam `current_stage_id`, `stage_entered_at`, `responsavel_atendimento` ou `is_archived` em `clientes_cadastro` **devem revalidar**:
- `/clientes`
- `/funil`
- `/funil/v1`
- `/clientes/[id]`

Implementações que seguem isso:
- `changeStage` ([app/(protected)/clientes/[id]/actions.ts:68-71](app/(protected)/clientes/[id]/actions.ts:68))
- `assignResponsavel` ([app/(protected)/actions/assign-responsavel.ts:70-72](app/(protected)/actions/assign-responsavel.ts:70))
- `reassignBatch` (CS força-tarefa, [app/(protected)/cs/forca-tarefa/actions.ts:103-106](app/(protected)/cs/forca-tarefa/actions.ts:103))

⚠️ `setArchived` **não revalida `/funil*` nem `/clientes`** — listas continuam mostrando o cliente arquivado até refresh manual. Ver `clientes-module.md` para detalhe.

### Notas operacionais
- `FunilRow` usa nomes curtos (`c`, `s`, `d`, `a`, `l`) — herança de payload otimizado pra cliente. Não renomear sem trocar todas as referências em `funil-dashboard*.tsx`.
- `holidays` vem de `business_holidays` (não de uma lista hardcoded). Scope `national | regional | company`.
- Sub-etapas só podem ter 2 níveis (etapa-mãe → subetapa). Validado em `pipeline-stages/reorder` — ver [pipeline-stages.md](pipeline-stages.md).
- Quando uma task tem `pipeline_stage_id` apontando para uma subetapa, o `buildFunilData` agrupa visualmente na etapa-mãe via `rootStageOf`, mas mantém o `pipeline_stage_id` original na task.
