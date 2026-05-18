# Modulo Producao

Documentacao tecnica do modulo Producao.

Ultima atualizacao: 2026-05-11

## Objetivo

O modulo Producao e o quadro operacional das tarefas de producao. Ele apresenta tasks por etapa do pipeline, permite filtrar, criar, editar, mover, abrir detalhes completos, criar subtarefas, vincular pecas e navegar a partir de outros modulos como Dashboard e Pauta.

A tela principal fica em `/producao`.

## Principais caminhos

| Area                    | Caminho                                                          | Papel                                                       |
| ----------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| Rota principal          | `src/app/(auth)/producao/page.tsx`                               | Orquestra filtros, visualizacoes, modais e query params     |
| Error boundary          | `src/app/(auth)/producao/error.tsx`                              | Fallback com retry e retorno para Clientes                  |
| Hook otimizado do board | `src/hooks/use-producao-board.ts`                                | Carrega board via RPC e fallback legado                     |
| Hook legado/pipeline    | `src/hooks/use-pipeline-kanban.ts`                               | Stages, movimentacao, subtarefas e mutacoes auxiliares      |
| Componentes do modulo   | `src/components/producao/`                                       | Kanban, lista, cards, filtros, formularios e modal completo |
| Formulario de task      | `src/components/producao/task-form-modal.tsx`                    | Criacao/edicao de tarefa principal                          |
| Modal completo          | `src/components/producao/task-detail-full-modal.tsx`             | Detalhes, scripts, historico, pecas, comentarios e acoes    |
| RPC do board            | `supabase/migrations/20260505200000_producao_board_view_rpc.sql` | View `v_producao_task_cards` e funcoes paginadas            |
| Tipos Supabase          | `src/types/supabase.ts`                                          | Tipos de tasks, stages, pecas, subtasks e joins             |

## Funcionamento geral

1. Usuario acessa `/producao`.
2. A pagina restaura filtros de `localStorage` (`producao-filters`).
3. Query params podem abrir tarefa ou aplicar filtros vindos de outros modulos.
4. `useKanbanPipelineStages()` carrega etapas do pipeline.
5. `useTasksByPipelineStage()` carrega tasks agrupadas por etapa, preferencialmente via RPC.
6. Usuario alterna entre kanban e lista.
7. Usuario cria/edita tasks, abre modal completo, move etapas, cria subtarefas e vincula pecas.
8. Paginacao por etapa usa `loadMoreStage`.

## Query params

| Parametro          | Uso                                     |
| ------------------ | --------------------------------------- |
| `task_id`          | Abre o modal completo da task informada |
| `from=pauta`       | Ao fechar modal, retorna para `/pauta`  |
| `dashboard_filter` | Aplica filtro vindo do Dashboard        |

Valores de `dashboard_filter` tratados:

| Valor                | Efeito esperado                      |
| -------------------- | ------------------------------------ |
| `urgentes`           | Mostra tarefas urgentes              |
| `entregas_atrasadas` | Mostra tarefas com deadline atrasado |

## Etapas do pipeline

Arquivo de referencia: `src/hooks/use-pipeline-kanban.ts`

Slugs conhecidos em `KANBAN_STAGE_SLUGS`:

- `onboarding`;
- `roteiro`;
- `roteiro-em-aprovacao`;
- `atendimento`;
- `criacao`;
- `ajuste-roteiro`;
- `design`;
- `locucao`;
- `edit`;
- `video`;
- `mix`;
- `finalizacao`;
- `delivery`;
- `aguardando`;
- `ajuste-video`;
- `ajuste-design`;
- `celebridade`;
- `aprovado-celebridade`;
- `finalizado`.

Esses slugs sao contratos com Pauta, Celebridade, Clientes, Dashboard e relatorios.

## Hook otimizado do board

Arquivo: `src/hooks/use-producao-board.ts`

### `useTasksByPipelineStage(filters)`

Query key:

```ts
;['production-tasks', 'by-pipeline-stage', 'optimized', filters, user?.id]
```

Fluxo:

1. Monta argumentos da RPC `get_producao_board`.
2. Tenta carregar dados agregados por etapa.
3. Se a RPC falhar, usa fallback legado com queries diretas.
4. Retorna stages com tarefas, contagens e estados de carregamento.

Filtros suportados por `PipelineStageTaskFilters`:

- `assignedTo`;
- `priority`;
- `isUrgent`;
- `showSubtasks`;
- `searchTerm`;
- `dateFrom`;
- `dateTo`;
- `showOverdueOnly`;
- `clienteId`;
- `responsavelAtendimentoId`;
- `taskStartedFilter`.

### `loadMoreStage`

Carrega mais tasks de uma etapa via RPC `get_producao_stage_tasks`.

Contrato atual:

- limite inicial por etapa: 20;
- carregamento adicional por etapa: 60;
- offset baseado na quantidade ja carregada.

## RPC e view do board

Migration:

`supabase/migrations/20260505200000_producao_board_view_rpc.sql`

Cria:

- indices para board;
- view `public.v_producao_task_cards` com `security_invoker = true`;
- funcao `public.get_producao_board`;
- funcao `public.get_producao_stage_tasks`.

Campos derivados importantes:

- dados do cliente;
- etapa atual;
- responsavel;
- responsavel de atendimento;
- contagem de subtarefas;
- `has_rejected_pecas`;
- `has_aguardando_pecas`;
- `has_troca_solicitada`;
- flags de prioridade/urgencia/deadline.

Por usar `security invoker`, a view e as funcoes respeitam as permissoes/RLS do usuario chamador.

## Componentes principais

Pasta: `src/components/producao/`

| Componente                   | Papel                                   |
| ---------------------------- | --------------------------------------- |
| `KanbanPipeline`             | Board por etapas                        |
| `PipelineListView`           | Visualizacao em lista                   |
| `MainTaskCard`               | Card de task principal                  |
| `SubtaskCard`                | Card de subtarefa                       |
| `TasksFilters`               | Filtros da tela                         |
| `TaskFormModal`              | Criacao/edicao de tarefa                |
| `TaskDetailFullModal`        | Modal completo de trabalho              |
| `CreateSubtaskModal`         | Criacao de subtarefa                    |
| `PipelineStageTaskAccordion` | Agrupamento de tasks por etapa na lista |
| `PriorityBadge`              | Badge visual de prioridade              |

## Formulario de task

Arquivo: `src/components/producao/task-form-modal.tsx`

Campos principais:

- titulo;
- descricao;
- briefing;
- cliente;
- etapa;
- responsavel;
- prioridade;
- urgencia;
- prazo/data/hora.

Hooks usados:

- `useCreateProductionTask`;
- `useUpdateProductionTask`.

Consultas auxiliares:

- clientes;
- profiles;
- stages.

## Modal completo

Arquivo: `src/components/producao/task-detail-full-modal.tsx`

O modal completo concentra operacoes de execucao. Ele integra:

- dados da task;
- checklist;
- comentarios;
- pecas;
- scripts;
- historico;
- aprovacoes de celebridade;
- ajustes;
- arquivos/links;
- subtarefas;
- mudanca de status/etapa.

Como esse arquivo cruza muitos dominios, alteracoes nele devem ser validadas com Pauta, Celebridade, Clientes e Chat quando houver vinculo de cliente/conversa.

## Mutacoes do pipeline

Arquivo: `src/hooks/use-pipeline-kanban.ts`

Hooks relevantes:

| Hook                         | Operacao                                                   |
| ---------------------------- | ---------------------------------------------------------- |
| `useMoveTaskToPipelineStage` | Move task entre etapas                                     |
| `useSaveCelebrityLinks`      | Salva links de pasta estatica/video em task de celebridade |
| `useCreateSubtask`           | Cria subtarefa                                             |
| `useUpdateTaskStatus`        | Atualiza status da task                                    |
| `useDeleteTask`              | Remove task                                                |
| `useUpdateTask`              | Atualiza dados gerais da task                              |

## Integracoes com outros modulos

| Modulo       | Integracao                                                               |
| ------------ | ------------------------------------------------------------------------ |
| Dashboard    | Abre `/producao?dashboard_filter=urgentes` e `entregas_atrasadas`        |
| Pauta        | Abre `/producao?task_id=<id>&from=pauta`; Producao retorna para `/pauta` |
| Celebridade  | Usa etapas `celebridade` e `aprovado-celebridade`, aprovacoes e links    |
| Clientes     | Sidebar de cliente exibe/edita dados que afetam tasks e pipeline         |
| Notificacoes | Algumas acoes de task/aprovacao geram notificacoes                       |

## Banco de dados

Tabelas centrais:

- `production_tasks`;
- `client_pipeline_stages`;
- `clientes_cadastro`;
- `profiles`;
- `kanban_pecas`;
- `task_pecas`;
- `task_checklist_items`;
- `task_comments`;
- `task_history`;
- tabelas de aprovacoes/ajustes quando o modal completo aciona esses fluxos.

## Permissoes e RLS

O board otimizado usa view e funcoes `security invoker`. Isso significa que:

- a consulta roda com permissoes do usuario autenticado;
- RLS das tabelas subjacentes continua relevante;
- falhas de permissao podem acionar fallback legado, mas nao devem ser tratadas como solucao de seguranca.

Ponto de atencao: se o modulo precisar de recorte por role/especialidade, preferir RPCs com autorizacao explicita e helpers `SECURITY DEFINER` ja aprovados no projeto.

## Pontos de atencao

- Slugs de pipeline sao contrato publico entre modulos; evitar renomear sem migration/backfill e ajuste de consumidores.
- Fallback legado pode ser mais pesado que RPC. Erros da RPC devem ser investigados, nao ignorados.
- `localStorage` persiste filtros; bugs de filtro podem parecer dados ausentes para o usuario.
- `task_id` em query param abre modal automaticamente; manter compatibilidade com Pauta e links internos.
- `TaskDetailFullModal` tem alto acoplamento com pecas, scripts, comentarios, celebridade e historico.
- Paginacao por etapa depende de contagem correta no retorno da RPC.

## Checklist de validacao

- Abrir `/producao` com filtros limpos.
- Alternar kanban/lista.
- Aplicar busca, responsavel, prioridade, urgencia e atraso.
- Criar task principal.
- Editar task existente.
- Mover task entre etapas.
- Criar subtarefa.
- Abrir via `/producao?task_id=<id>`.
- Abrir via Pauta e fechar retornando para `/pauta`.
- Abrir via Dashboard com `dashboard_filter=urgentes` e `entregas_atrasadas`.
- Carregar mais tarefas em uma etapa.
- Validar tasks de celebridade com pecas reprovadas/aguardando.
