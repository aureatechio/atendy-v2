# Modulo Dashboard

Documentacao tecnica do modulo Dashboard.

Ultima atualizacao: 2026-05-11

## Objetivo

O modulo Dashboard e a visao operacional principal em `/dashboard`. Ele consolida indicadores de atendimento, clientes e producao para direcionar o usuario para filas de trabalho: clientes sem resposta, insatisfeitos, prazos vencendo, entregas atrasadas e tarefas urgentes.

Este documento cobre `/dashboard`. Ele e diferente de:

- `/admin`, que usa metricas administrativas via `src/hooks/use-dashboard-metrics.ts` e rota `src/app/api/admin/dashboard-metrics/route.ts`;
- `/dashboard-producao`, documentado em `.context/modules/modulo-dashboard-producao/README.md`.

## Principais caminhos

| Area                         | Caminho                                                          | Papel                                                             |
| ---------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| Rota principal               | `src/app/(auth)/dashboard/page.tsx`                              | Orquestra cards e paineis                                         |
| Hook de metricas da tela     | `src/hooks/use-team-productivity.ts`                             | Expoe `useDashboardMetrics` usado por `/dashboard`                |
| Cards principais             | `src/components/dashboard/metrics-cards.tsx`                     | Renderiza indicadores clicaveis                                   |
| Tarefas urgentes             | `src/components/dashboard/urgent-tasks-panel.tsx`                | Lista tarefas urgentes vindas de `useUrgentTasks`                 |
| Tarefas vencidas por usuario | `src/components/dashboard/overdue-tasks-by-user.tsx`             | Usa hook legado de dashboard de producao                          |
| Clientes por etapa           | `src/components/dashboard/clients-per-stage.tsx`                 | Distribuicao por etapa                                            |
| Tempo medio                  | `src/components/dashboard/average-completion-card.tsx`           | Tempo medio de conclusao                                          |
| Tarefas paradas              | `src/components/dashboard/stuck-tasks-panel.tsx`                 | Tasks sem movimento por limite de horas                           |
| Hooks legados complementares | `src/hooks/use-production-dashboard-metrics-legacy.ts`           | `useClientsPerStage`, `useAverageCompletionTime`, `useStuckTasks` |
| Hook admin homonimo          | `src/hooks/use-dashboard-metrics.ts`                             | Nao e usado por `/dashboard`; alimenta area admin                 |
| API admin                    | `src/app/api/admin/dashboard-metrics/route.ts`                   | Metricas administrativas com service role                         |
| Edge Function admin legada   | `supabase/functions/get-dashboard-metrics/index.ts`              | Versao Edge das metricas admin                                    |
| Views historicas             | `supabase/migrations/20260115100000_sprint5_dashboard_views.sql` | Views de metricas diarias e ranking                               |

## Funcionamento geral

1. Usuario acessa `/dashboard`.
2. A pagina chama `useDashboardMetrics()` de `src/hooks/use-team-productivity.ts`.
3. Em paralelo, carrega `useUrgentTasks()` para alimentar o painel de urgencias.
4. `MetricsCards` renderiza oito indicadores principais.
5. Clique em um card navega para a tela operacional com filtro via query string.
6. Paineis complementares mostram clientes por etapa, tarefas vencidas por usuario, tempo medio e tarefas paradas.

## Rotas acionadas pelos cards

| Card                | Rota de destino                                 |
| ------------------- | ----------------------------------------------- |
| `totalClientes`     | `/clientes`                                     |
| `semResposta`       | `/chat?filter=sem_resposta`                     |
| `insatisfeitos`     | `/clientes?dashboard_filter=insatisfeitos`      |
| `prazosVencemHoje`  | `/clientes?dashboard_filter=vence_hoje`         |
| `prazosAtrasados`   | `/clientes?dashboard_filter=prazos_atrasados`   |
| `entregasAtrasadas` | `/producao?dashboard_filter=entregas_atrasadas` |
| `tasksUrgentes`     | `/producao?dashboard_filter=urgentes`           |
| `tasksEmAndamento`  | `/producao`                                     |

Esses nomes sao contrato entre Dashboard, Clientes, Chat e Producao. Ao renomear filtros, atualizar os modulos consumidores.

## Hook de metricas da tela

Arquivo: `src/hooks/use-team-productivity.ts`

Hook usado por `/dashboard`:

```ts
useDashboardMetrics()
```

Query key:

```ts
;['production-dashboard-metrics']
```

Fontes consultadas diretamente:

| Metrica             | Fonte principal                                       |
| ------------------- | ----------------------------------------------------- |
| `totalClientes`     | `clientes_cadastro`                                   |
| `semResposta`       | `conversations` com ultima mensagem do cliente ha +2h |
| `insatisfeitos`     | `conversations.ai_classification = 'Insatisfeito'`    |
| `prazosVencemHoje`  | `clientes_cadastro.prazo_final`                       |
| `prazosAtrasados`   | `clientes_cadastro.prazo_final`                       |
| `entregasAtrasadas` | `production_tasks.deadline`                           |
| `tasksUrgentes`     | `production_tasks.is_urgent`                          |
| `tasksEmAndamento`  | `production_tasks.status`                             |

Regra de sem resposta:

- `last_customer_message_at` existe;
- esta antes de `now - 2 hours`;
- conversa nao esta `resolved`;
- `marked_as_responded_at` e nulo;
- ha unread ou nao houve resposta de agente apos a mensagem do cliente;
- existe tolerancia de 30 minutos para `last_agent_message_at`.

Data base:

- prazos de cliente usam `getBrazilTodayStr()`;
- outras comparacoes usam `new Date()`/ISO no cliente.

## Componentes

### `MetricsCards`

Arquivo: `src/components/dashboard/metrics-cards.tsx`

Recebe:

```ts
{
  metrics: DashboardMetrics | undefined
  isLoading: boolean
  onCardClick?: (card: string) => void
}
```

Renderiza cards para:

- total de clientes;
- sem resposta;
- insatisfeitos;
- prazos vencem hoje;
- prazos atrasados;
- entregas atrasadas;
- tarefas urgentes;
- tarefas em andamento.

### `UrgentTasksPanel`

Arquivo: `src/components/dashboard/urgent-tasks-panel.tsx`

Recebe a lista de `useUrgentTasks()` e destaca tarefas de maior prioridade.

### `OverdueTasksByUser`

Arquivo: `src/components/dashboard/overdue-tasks-by-user.tsx`

Usa hook legado de dashboard de producao para agrupar tarefas atrasadas por usuario.

### `ClientsPerStage`

Arquivo: `src/components/dashboard/clients-per-stage.tsx`

Usa `useClientsPerStage()` e exibe distribuicao de clientes por etapa.

### `AverageCompletionCard`

Arquivo: `src/components/dashboard/average-completion-card.tsx`

Usa `useAverageCompletionTime()` para tempo medio de conclusao.

### `StuckTasksPanel`

Arquivo: `src/components/dashboard/stuck-tasks-panel.tsx`

Usa `useStuckTasks(48)` para detectar tarefas paradas ha 48 horas.

## Diferenca para dashboard admin

Arquivos admin:

- `src/hooks/use-dashboard-metrics.ts`;
- `src/app/api/admin/dashboard-metrics/route.ts`;
- `supabase/functions/get-dashboard-metrics/index.ts`.

Esses contratos calculam metricas administrativas de mensagens, conversas, ranking, presenca e configuracao WhatsApp. Eles validam admin/supervisor e usam service role no servidor/Edge.

Nao trocar o hook de `/dashboard` por `use-dashboard-metrics.ts` sem revisar a tela inteira: os nomes, o formato e o objetivo das metricas sao diferentes.

## Banco de dados

Tabelas diretamente envolvidas:

- `clientes_cadastro`;
- `conversations`;
- `production_tasks`;
- `client_pipeline_stages`;
- `profiles`;
- `messages` nos contratos admin/historicos.

Migration historica:

`supabase/migrations/20260115100000_sprint5_dashboard_views.sql`

Cria:

- indices para `conversations` e `messages`;
- view `v_dashboard_daily_metrics`;
- view `v_attendants_ranking`.

Observacao: a tela `/dashboard` atual nao depende diretamente dessas views; elas sao relevantes para metricas administrativas/historicas.

## Permissoes e RLS

`/dashboard` nao tem guard explicito na pagina. As leituras diretas dependem da RLS das tabelas consultadas.

Pontos de atencao:

- se as metricas devem ser restritas por role, mover leituras para RPC/rota server com autorizacao explicita;
- queries diretas podem falhar parcialmente conforme RLS de cada tabela;
- manter consistencia entre metricas de `/dashboard`, filtros de destino e regras de negocio de cada tela.

## Pontos de atencao

- A query key `['production-dashboard-metrics']` e parecida com dashboards de producao, mas representa o dashboard operacional `/dashboard`.
- `use-dashboard-metrics.ts` e outro modulo, apesar do nome.
- O card `semResposta` usa criterio equivalente ao filtro do Chat; ao alterar um, revisar o outro.
- Os cards de prazo devem continuar alinhados aos filtros `dashboard_filter` de Clientes.
- Os cards de producao devem continuar alinhados aos filtros `dashboard_filter` de Producao.
- Comparacoes de data misturam utilitario de data brasileira com `Date` local/ISO; revisar bordas de fuso antes de alterar regras.

## Checklist de validacao

- Abrir `/dashboard` com dados reais.
- Verificar loading, valores numericos e paineis complementares.
- Clicar cada card e confirmar rota/filtro de destino.
- Conferir `semResposta` contra `/chat?filter=sem_resposta`.
- Conferir `insatisfeitos`, prazos de hoje e atrasados contra `/clientes`.
- Conferir urgentes e entregas atrasadas contra `/producao`.
- Se alterar permissao, testar admin, supervisor/producao e usuario sem acesso esperado.
