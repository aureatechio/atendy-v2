# modulo-dashboard-producao

Documentacao tecnica do modulo Dashboard Producao.

Ultima atualizacao: 2026-05-08

## Objetivo

O modulo Dashboard Producao apresenta metricas operacionais da equipe de producao, com foco em volume de pecas entregues, tarefas finalizadas, tempos medios por etapa, motivos de ajuste e desempenho por pessoa/especialidade.

A tela principal fica em `/dashboard-producao` e consome dados agregados do Supabase por meio da RPC `get_production_dashboard_metrics`. O mesmo contrato tambem alimenta a tela complementar `/dashboard-performance`, que transforma as metricas em analises comparativas de produtividade.

## Principais caminhos

| Area                                       | Caminho                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| Rota principal                             | `src/app/(auth)/dashboard-producao/page.tsx`                                      |
| Rota de analise complementar               | `src/app/(auth)/dashboard-performance/page.tsx`                                   |
| Componentes do modulo                      | `src/components/dashboard-producao/`                                              |
| Hook principal                             | `src/hooks/use-production-dashboard-metrics.ts`                                   |
| Hooks legados exportados pelo mesmo modulo | `src/hooks/use-production-dashboard-metrics-legacy.ts`                            |
| Analise derivada de performance            | `src/components/dashboard-performance/ai-analysis-engine.ts`                      |
| RPC original                               | `supabase/migrations/20260309180000_dashboard_producao_rpc.sql`                   |
| RPC vigente/correcao posterior             | `supabase/migrations/20260505131000_fix_production_dashboard_metrics_warning.sql` |
| Tipos Supabase gerados                     | `src/types/supabase.ts`                                                           |
| Testes de componentes                      | `src/components/dashboard-producao/__tests__/`                                    |

## Funcionamento geral

1. A pagina `/dashboard-producao` inicializa o filtro de periodo do primeiro dia do mes atual ate hoje.
2. O componente `PeriodFilter` permite selecionar datas manualmente, usar presets de hoje/semana/mes ou limpar o filtro.
3. O hook `useProductionDashboardMetrics(dateFrom, dateTo)` chama a RPC `get_production_dashboard_metrics`.
4. A pagina busca metricas ativas adicionais diretamente no cliente Supabase:
   - tarefas ativas em `production_tasks` com `status != 'finalizado'`;
   - pecas a produzir em `kanban_pecas` com `status = 'a_fazer'`;
   - clientes ativos distintos a partir de `production_tasks.cliente_id`.
5. Os componentes renderizam os blocos:
   - resumo global e producao de pecas;
   - motivos de ajuste;
   - tempo medio por etapa;
   - metricas individuais por pessoa.
6. A pagina `/dashboard-performance` reutiliza o mesmo hook e o `PeriodFilter`, gerando analises locais no frontend com `generateFullAnalysis(metrics)`.

## Telas e componentes

### `src/app/(auth)/dashboard-producao/page.tsx`

Componente client-side que orquestra o dashboard. Responsabilidades:

- manter `dateFrom` e `dateTo`;
- chamar `useProductionDashboardMetrics`;
- calcular `activeStats` via TanStack Query;
- renderizar loading, estado vazio ou conteudo;
- linkar para `/dashboard-performance`.

Query local de ativos:

```ts
queryKey: ['active-production-stats']
```

Tabelas consultadas diretamente:

- `production_tasks`
- `kanban_pecas`

### `PeriodFilter`

Arquivo: `src/components/dashboard-producao/period-filter.tsx`

Controle de periodo usado em `/dashboard-producao` e `/dashboard-performance`.

Entradas:

```ts
interface PeriodFilterProps {
  dateFrom: string
  dateTo: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onReset: () => void
}
```

Presets:

- `Hoje`: hoje como inicio e fim;
- `Semana`: segunda-feira da semana atual ate hoje;
- `Mes`: primeiro dia do mes atual ate hoje;
- reset: limpa ambos os campos.

Ponto de atencao: o componente usa `new Date().toISOString().split('T')[0]`, portanto a data base vem de UTC. Se houver divergencia de fuso em bordas de dia, considerar usar utilitario local como `getBrazilTodayStr`.

### `GlobalMetrics`

Arquivo: `src/components/dashboard-producao/global-metrics.tsx`

Renderiza os blocos principais:

- tarefas ativas, pecas a produzir e clientes ativos;
- producao de pecas:
  - video novo;
  - video ajuste;
  - imagem novo;
  - imagem ajuste;
  - total de pecas;
- tempos e desempenho:
  - tasks finalizadas;
  - tempo medio de tarefa;
  - entrega de video;
  - entrega de imagem;
  - ajuste de video;
  - ajuste de imagem;
  - celebridade;
  - tempo ocioso.

O helper local `formatHours` converte horas em `min`, `h` ou `d h`.

### `AdjustmentMetrics`

Arquivo: `src/components/dashboard-producao/adjustment-metrics.tsx`

Busca e agrega motivos de ajuste na tabela `client_adjustments`.

Query key:

```ts
;['adjustment-metrics', dateFrom, dateTo]
```

Campos lidos:

- `id`
- `adjustment_type`
- `created_at`

Tipos esperados de `adjustment_type`:

- `pedido_cliente`
- `erro_producao`
- `ajuste_nao_feito`

Ponto de atencao: migrations antigas de `client_adjustments` documentam a tabela base, mas `adjustment_type` deve ser confirmado nas migrations/estado atual do banco antes de alterar esse componente.

### `StepsAvgTime`

Arquivo: `src/components/dashboard-producao/steps-avg-time.tsx`

Renderiza barras horizontais com o tempo medio em cada etapa do pipeline. Recebe `metrics.global.stepsAvgTime` vindo da RPC.

Contrato:

```ts
interface StepAvgTime {
  stageSlug: string
  stageName: string
  stageColor: string
  avgHours: number
  count: number
}
```

### `PersonMetricsTable`

Arquivo: `src/components/dashboard-producao/person-metrics-table.tsx`

Renderiza metricas por pessoa em cards agrupados por `profile.specialty`.

Especialidades conhecidas:

- `video`
- `design`
- `roteirista`
- `audio`
- `atendimento`
- `gestor`
- `celebridade`
- `aprovacao_celebridade`
- fallback: `outros`

Ordenacoes disponiveis:

- total de pecas;
- tasks finalizadas;
- nome.

### `MetricCard`

Arquivo: `src/components/dashboard-producao/metric-card.tsx`

Componente visual simples para titulo, valor, subtitulo opcional e icone.

## Hook principal e contrato de API

Arquivo: `src/hooks/use-production-dashboard-metrics.ts`

Assinatura:

```ts
export function useProductionDashboardMetrics(dateFrom: string | null, dateTo: string | null)
```

Query key:

```ts
;['production-dashboard-metrics', dateFrom, dateTo]
```

Comportamento:

- cria o client Supabase com `createClient()`;
- chama a RPC `get_production_dashboard_metrics`;
- envia datas como timestamp UTC de inicio/fim do dia:

```ts
{
  p_date_from: dateFrom ? `${dateFrom}T00:00:00.000Z` : null,
  p_date_to: dateTo ? `${dateTo}T23:59:59.999Z` : null,
}
```

- usa `staleTime: 60000`;
- usa `refetchInterval: 120000`;
- retorna fallback vazio se a RPC vier nula.

### Contrato `DashboardMetrics`

```ts
interface DashboardMetrics {
  global: {
    pieces: PiecesCount
    tasksFinalized: number
    avgTaskWorkTime: number | null
    avgIdleTime: number | null
    deliveryTimes: DeliveryTimes
    stepsAvgTime: StepAvgTime[]
  }
  byPerson: PersonMetrics[]
}
```

### Contrato `PiecesCount`

```ts
interface PiecesCount {
  videoNovo: number
  videoAjuste: number
  imagemNovo: number
  imagemAjuste: number
  totalVideo: number
  totalImagem: number
  total: number
}
```

### Contrato `DeliveryTimes`

```ts
interface DeliveryTimes {
  avgVideoDelivery: number | null
  avgImageDelivery: number | null
  avgAjusteVideo: number | null
  avgAjusteImage: number | null
  avgCelebrity: number | null
}
```

### Contrato `PersonMetrics`

```ts
interface PersonMetrics {
  profile: {
    id: string
    full_name: string | null
    avatar_url: string | null
    specialty?: string | null
  }
  pieces: PiecesCount
  tasksFinalized: number
  avgTaskWorkTime: number | null
  avgIdleTime: number | null
  deliveryTimes: DeliveryTimes
}
```

## RPC `get_production_dashboard_metrics`

A RPC e responsavel por agregar a maior parte dos dados no Postgres.

Definicao vigente:

```sql
public.get_production_dashboard_metrics(
  p_date_from timestamp with time zone default null,
  p_date_to timestamp with time zone default null
) returns jsonb
```

Migration relevante mais recente:

```text
supabase/migrations/20260505131000_fix_production_dashboard_metrics_warning.sql
```

### Stages resolvidos por slug

A funcao busca IDs em `client_pipeline_stages` pelos seguintes slugs ativos:

| Variavel              | Slug                   |
| --------------------- | ---------------------- |
| `v_delivery_id`       | `delivery`             |
| `v_ajuste_video_id`   | `ajuste-video`         |
| `v_ajuste_design_id`  | `ajuste-design`        |
| `v_celebridade_id`    | `celebridade`          |
| `v_aprovado_celeb_id` | `aprovado-celebridade` |
| `v_locucao_id`        | `locucao`              |
| `v_design_id`         | `design`               |

Ponto de atencao: a migration original tambem declarava `v_finalizado_id`, mas a correcao posterior removeu a variavel nao usada.

### CTEs principais

| CTE                               | Papel                                                    |
| --------------------------------- | -------------------------------------------------------- |
| `all_history`                     | Todo o historico `stage_change` de `task_history`        |
| `period_history`                  | Historico filtrado por `p_date_from` e `p_date_to`       |
| `delivery_tasks`                  | Tasks que chegaram em `delivery` no periodo              |
| `task_data`                       | Task e responsavel (`assigned_to`) para tasks entregues  |
| `task_pieces`                     | Pecas vinculadas via `task_pecas` e `kanban_pecas`       |
| `task_ajuste`                     | Detecta se a task passou por ajuste de video/design      |
| `pieces_per_task`                 | Base para contagem de pecas novas vs ajustes             |
| `stage_durations`                 | Calcula permanencia em cada etapa                        |
| `delivery_time_calc`              | Calcula tempos entre pares de etapas                     |
| `work_times`                      | Mede `task_work_started_at` ate proxima mudanca de etapa |
| `delivery_moments` / `next_start` | Base para tempo ocioso entre entrega e proxima task      |
| `person_*`                        | Agregacoes por pessoa                                    |
| `by_person`                       | Montagem do JSON de `byPerson`                           |

### Metricas calculadas

- pecas globais por tipo e origem:
  - video novo;
  - video ajuste;
  - imagem novo;
  - imagem ajuste;
- total de tasks finalizadas, definido como tasks que entraram em `delivery` no periodo;
- tempo medio por etapa;
- tempos medios de entrega:
  - `locucao -> delivery`;
  - `design -> delivery`;
  - `ajuste-video -> delivery`;
  - `ajuste-design -> delivery`;
  - `celebridade -> aprovado-celebridade`;
- tempo medio de trabalho:
  - `production_tasks.task_work_started_at -> proximo task_history.stage_change`;
- tempo medio ocioso:
  - momento de entrega em `delivery -> proximo task_work_started_at` da mesma pessoa;
- metricas equivalentes por pessoa.

### Filtros de sanidade da RPC

A RPC descarta duracoes fora de faixas esperadas:

- tempos de etapa/entrega maiores que `720` horas nao entram nas medias;
- tempo de trabalho maior que `72` horas nao entra em `avgTaskWorkTime`;
- valores menores ou iguais a zero sao ignorados nas medias.

## Banco de dados e entidades relacionadas

### `production_tasks`

Criada em:

```text
supabase/migrations/20260205120000_create_production_tasks.sql
```

Campos relevantes para o dashboard:

- `id`
- `cliente_id`
- `pipeline_stage_id`
- `assigned_to`
- `created_by`
- `status`
- `deadline`
- `created_at`
- `updated_at`
- `task_work_started_at`

Uso no dashboard:

- base de tasks entregues;
- contagem de tarefas ativas;
- contagem de clientes ativos distintos;
- vinculo com responsaveis;
- tempo de trabalho e tempo ocioso.

### `task_history`

Criada em:

```text
supabase/migrations/20260207100000_create_task_scripts_and_history.sql
```

Campos relevantes:

- `task_id`
- `action_type`
- `from_stage_id`
- `to_stage_id`
- `created_at`

Uso no dashboard:

- fonte principal para saber quando uma task entrou/saiu de etapas;
- determina tasks entregues no periodo;
- calcula tempos medios por etapa e por fluxo.

Trigger relevante:

```text
trigger_record_task_history on production_tasks
```

Migration posterior relevante:

```text
supabase/migrations/20260207180000_history_include_current_stage.sql
```

Essa migration ajusta `record_task_history()` para registrar a etapa atual em eventos do historico.

### `task_pecas`

Criada em:

```text
supabase/migrations/20260309175959_create_task_pecas_compat.sql
```

Tabela ponte entre `production_tasks` e `kanban_pecas`.

Campos:

- `task_id`
- `peca_id`

Uso no dashboard:

- relaciona tasks entregues as pecas produzidas;
- permite classificar volume por tipo de peca.

### `kanban_pecas`

Criada em:

```text
supabase/migrations/20260204230000_create_kanban_pecas.sql
```

Migration de tipo:

```text
supabase/migrations/20260204240000_add_peca_tipo_enum.sql
```

Campos relevantes:

- `id`
- `cliente_id`
- `status`
- `tipo`

Valores esperados de `tipo`:

- `video`
- `imagem`

Uso no dashboard:

- classificar pecas em video/imagem;
- contar pecas a produzir com `status = 'a_fazer'`.

### `client_pipeline_stages`

Criada em:

```text
supabase/migrations/20260204210000_create_client_pipeline_system.sql
```

Uso no dashboard:

- resolver slugs de etapas para IDs;
- exibir nomes, cores e ordem em `stepsAvgTime`;
- identificar etapas de ajuste, entrega, design, locucao e celebridade.

Ponto de atencao: mudancas em slugs quebram a RPC. Ao renomear etapas, atualizar a RPC e os fluxos que gravam `task_history`.

### `profiles`

Uso no dashboard:

- montar `profile` nas metricas por pessoa;
- exibir `full_name`, `avatar_url` e `specialty`.

Ponto de atencao RLS: policies novas ou alteradas nao devem consultar `profiles` diretamente dentro de `USING()` se houver risco de recursao. Seguir as regras do `AGENTS.md` e usar funcoes auxiliares `SECURITY DEFINER`.

### `client_adjustments`

Criada em:

```text
supabase/migrations/20260206150000_create_client_adjustments.sql
```

Correcao de FKs:

```text
supabase/migrations/20260206160000_fix_client_adjustments_fk.sql
```

Uso no dashboard:

- componente `AdjustmentMetrics`;
- agregacao por `adjustment_type`;
- filtro por `created_at`.

## Permissoes e RLS

O dashboard roda no cliente autenticado e depende das permissoes de leitura das tabelas consultadas e da execucao da RPC.

Pontos observados:

- `production_tasks` possui RLS habilitado e leitura para usuarios autenticados.
- `task_history` possui RLS habilitado e leitura para usuarios autenticados.
- `client_adjustments` possui RLS habilitado e leitura para usuarios autenticados.
- `client_pipeline_stages` possui leitura autenticada.
- `task_pecas` tem RLS habilitado na migration de compatibilidade; confirmar policies efetivas no estado atual do banco antes de depender de queries diretas do frontend.

Regra critica do projeto: ao criar ou alterar policies, evitar subqueries em tabelas protegidas por RLS dentro de `USING()`/`WITH CHECK`. Usar funcoes auxiliares `SECURITY DEFINER` como `is_admin()`, `is_admin_or_supervisor()` e `is_active_user()`.

## Edge Functions e integracoes externas

Este modulo nao chama Edge Functions diretamente.

Dependencias indiretas:

- Supabase Postgres, Auth e RLS;
- Realtime/historico gerado pelos fluxos de producao;
- tela de producao (`/producao`) e seus componentes, que atualizam `production_tasks`, `task_work_started_at`, `task_pecas` e `task_history`;
- modulo de clientes/ajustes, que alimenta `client_adjustments`.

Nao ha integracao direta com Z-API neste dashboard. A influencia da Z-API e indireta quando fluxos de atendimento/clientes geram tasks, pecas ou ajustes.

## Relacao com `/dashboard-performance`

Arquivo: `src/app/(auth)/dashboard-performance/page.tsx`

Essa tela reutiliza:

- `useProductionDashboardMetrics`;
- `PeriodFilter`;
- contrato `DashboardMetrics`.

Arquivo de analise:

```text
src/components/dashboard-performance/ai-analysis-engine.ts
```

O nome visual menciona "Analise IA", mas a analise atual e calculada localmente por heuristicas no frontend. Nao ha chamada a LLM ou Edge Function nesse fluxo.

## Regras de negocio

### Periodo

O periodo filtra eventos de historico (`task_history.created_at`) e, para alguns calculos, movimentos finais ocorridos dentro do periodo.

Datas nulas significam ausencia de limite:

- `dateFrom = null`: sem inicio;
- `dateTo = null`: sem fim.

### Task finalizada

No contexto deste dashboard, `tasksFinalized` nao e simplesmente `production_tasks.status = 'finalizado'`. A RPC conta tasks distintas que chegaram na etapa `delivery` dentro do periodo.

### Peca nova vs ajuste

Uma peca e considerada ajuste quando a task relacionada passou por `ajuste-video` ou `ajuste-design` no historico, seja como entrada ou saida de etapa.

Se a task nao passou por etapa de ajuste, a peca conta como nova.

### Tipos de peca

A classificacao depende de `kanban_pecas.tipo`:

- `video`;
- `imagem`.

Valores ausentes ou diferentes nao entram na contagem principal da RPC.

### Tempo medio por step

Para cada saida de etapa no periodo, a RPC procura a entrada anterior da mesma task na etapa (`to_stage_id = from_stage_id`) e calcula a diferenca em horas.

### Tempos de entrega

A RPC procura pares de etapas em uma mesma task:

| Metrica            | Par                                   |
| ------------------ | ------------------------------------- |
| `avgVideoDelivery` | `locucao -> delivery`                 |
| `avgImageDelivery` | `design -> delivery`                  |
| `avgAjusteVideo`   | `ajuste-video -> delivery`            |
| `avgAjusteImage`   | `ajuste-design -> delivery`           |
| `avgCelebrity`     | `celebridade -> aprovado-celebridade` |

### Tempo medio de trabalho

Calculado a partir de `production_tasks.task_work_started_at` ate o proximo `stage_change` da mesma task.

Esse campo e atualizado em fluxos da tela de detalhe de task, especialmente em:

```text
src/components/producao/task-detail-full-modal.tsx
```

### Tempo ocioso

Calculado por pessoa entre:

1. momento em que uma task dela chegou em `delivery`;
2. proximo `task_work_started_at` de outra task da mesma pessoa.

## Pontos de atencao e riscos conhecidos

- A confiabilidade das metricas depende fortemente de `task_history` registrar corretamente todos os `stage_change`.
- Slugs de etapas sao hardcoded na RPC. Alterar slugs em `client_pipeline_stages` exige atualizar a funcao.
- A definicao de "finalizada" neste modulo e chegada em `delivery`, nao necessariamente status final ou etapa `finalizado`.
- O filtro de datas do frontend usa timestamps UTC. Em viradas de dia no Brasil, validar se os resultados batem com a expectativa operacional.
- A migration mais recente da RPC inclui `avgIdleTime`; a migration original nao tinha essa metrica.
- `AdjustmentMetrics` depende de `client_adjustments.adjustment_type`; confirmar schema/migration ao evoluir motivos de ajuste.
- A RPC limita duracoes maximas para evitar outliers. Isso protege o dashboard, mas pode esconder dados historicos extremos.
- Alguns arquivos do modulo exibem sinais de encoding quebrado em textos renderizados, como `ProduÃ§Ã£o` ou `MÃ©s`. Corrigir encoding deve ser tratado como tarefa separada para evitar churn.
- `task_pecas` foi criada como ponte de compatibilidade. Antes de remover ou remodelar essa tabela, revisar a RPC, cleanup migrations e vinculos de pecas.

## Como testar e validar

### Testes automatizados

Rodar testes dos componentes do dashboard:

```bash
npm run test -- dashboard-producao
```

Rodar typecheck:

```bash
npm run type-check
```

Antes de PR, seguir o padrao do repositorio:

```bash
npm run build && npm run test
```

### Validacao manual

1. Acessar `/dashboard-producao` com usuario autenticado.
2. Validar loading inicial e renderizacao com periodo mensal.
3. Alterar o periodo manualmente e conferir se os cards mudam.
4. Testar presets `Hoje`, `Semana`, `Mes` e reset.
5. Conferir se `GlobalMetrics` mostra totais coerentes com tasks e pecas recentes.
6. Conferir `AdjustmentMetrics` contra registros em `client_adjustments`.
7. Conferir `StepsAvgTime` com dados de `task_history`.
8. Conferir ranking e agrupamento por especialidade em `PersonMetricsTable`.
9. Acessar `/dashboard-performance` e validar que os mesmos filtros e metricas alimentam a analise.

### Validacao SQL sugerida

Executar a RPC com e sem periodo:

```sql
select public.get_production_dashboard_metrics(null, null);

select public.get_production_dashboard_metrics(
  '2026-05-01T00:00:00.000Z'::timestamptz,
  '2026-05-08T23:59:59.999Z'::timestamptz
);
```

Checar se existem stages ativos obrigatorios:

```sql
select slug, id, name, is_active
from public.client_pipeline_stages
where slug in (
  'delivery',
  'ajuste-video',
  'ajuste-design',
  'celebridade',
  'aprovado-celebridade',
  'locucao',
  'design'
)
order by slug;
```

Checar historico recente de entregas:

```sql
select th.task_id, th.to_stage_id, th.created_at
from public.task_history th
join public.client_pipeline_stages s on s.id = th.to_stage_id
where th.action_type = 'stage_change'
  and s.slug = 'delivery'
order by th.created_at desc
limit 20;
```

## Checklist para futuros agentes

- Antes de mexer no dashboard, abrir `use-production-dashboard-metrics.ts` e a migration vigente da RPC.
- Se mudar contrato da RPC, atualizar os tipos locais no hook e revisar `/dashboard-performance`.
- Se adicionar nova metrica visual, decidir se ela pertence a RPC ou pode ser query local separada.
- Se alterar RLS, seguir o padrao do `AGENTS.md` para evitar recursao infinita.
- Se alterar etapas do pipeline, revisar todos os slugs hardcoded da RPC.
- Se alterar fluxo de inicio de tarefa, conferir impacto em `task_work_started_at`, `avgTaskWorkTime` e `avgIdleTime`.
- Se alterar ajustes, revisar `client_adjustments`, `AdjustmentMetrics` e os motivos aceitos.
