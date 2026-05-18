# Modulo Pauta

Documentacao tecnica do modulo Pauta.

Ultima atualizacao: 2026-05-08

## Objetivo

O modulo Pauta e a mesa de distribuicao de tarefas de producao. Ele permite que admins e supervisores vejam tarefas ainda sem responsavel, visualizem a carga atual dos membros de producao e atribuam tarefas por drag-and-drop.

A tela principal fica em `/pauta`. Ela nao cria tarefas nem altera etapa/status: a unica mutacao propria do modulo e atualizar `production_tasks.assigned_to`.

## Principais caminhos

| Area                  | Caminho                                                   | Papel                                                                   |
| --------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Rota principal        | `src/app/(auth)/pauta/page.tsx`                           | Monta a tela, aplica guard client-side e carrega hooks da pauta         |
| Hook do modulo        | `src/hooks/use-pauta.ts`                                  | Busca tarefas sem responsavel, membros/equipe e executa atribuicao      |
| Lista sem responsavel | `src/components/pauta/tarefas-sem-responsavel.tsx`        | Tabela arrastavel de tarefas sem `assigned_to`                          |
| Kanban de membros     | `src/components/pauta/kanban-membros.tsx`                 | Colunas por membro, drop target e feedback por toast                    |
| Card de tarefa        | `src/components/pauta/task-card-pauta.tsx`                | Card compacto das tarefas ja atribuidas a um membro                     |
| Teste unitario        | `src/components/pauta/__tests__/task-card-pauta.test.tsx` | Cobre renderizacao basica e navegacao do card                           |
| Volta da producao     | `src/app/(auth)/producao/page.tsx`                        | Abre modal por `task_id` e retorna para `/pauta` quando `from=pauta`    |
| Menu do usuario       | `src/components/layout/user-menu.tsx`                     | Entrada de navegacao para `/pauta`                                      |
| Presenca              | `src/lib/presence/route-labels.ts`                        | Rotulo "Pauta" para status de presenca                                  |
| Auth                  | `src/hooks/use-auth.tsx`                                  | Expoe `isAdmin`, `isSupervisor`, `profile.specialty` e `user`           |
| Tipos Supabase        | `src/types/supabase.ts`                                   | Define `ProductionTaskWithDetails`, `Profile`, enums e tipos auxiliares |

## Funcionamento geral

1. Usuario autenticado acessa `/pauta`.
2. A pagina espera `useAuth()` carregar `profile`.
3. Se o usuario nao for admin nem supervisor, a pagina redireciona para `/producao` e renderiza `null`.
4. A tela busca duas listas em paralelo:
   - tarefas de `production_tasks` sem `assigned_to`;
   - membros ativos de `profiles` com role `producao` ou `supervisor`.
5. A lista superior mostra tarefas sem responsavel, ordenadas por `deadline`.
6. O kanban inferior mostra uma coluna por membro e suas tarefas ja atribuidas.
7. Ao arrastar uma tarefa sem responsavel para um membro, o modulo atualiza `production_tasks.assigned_to`.
8. Ao clicar em uma tarefa, a Pauta navega para `/producao?task_id=<id>&from=pauta`.
9. A tela de Producao abre o modal da tarefa e, ao fechar, volta para `/pauta` se `from=pauta`.

## Autorizacao e acesso

| Camada                     | Comportamento atual                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/proxy.ts`             | Nao protege `/pauta` no servidor; so aplica guarda especial para rotas `/admin`                       |
| `src/app/(auth)/pauta`     | Guarda client-side: somente `isAdmin` ou `isSupervisor` continuam na tela                             |
| `useTarefasSemResponsavel` | Executa quando ha `user`                                                                              |
| `useMembrosEquipe`         | Executa quando ha `user` e `profile`                                                                  |
| RLS                        | A leitura/escrita final depende das policies de `production_tasks`, `profiles` e tabelas relacionadas |

Ponto de atencao: como o guard de `/pauta` e client-side, um usuario autenticado sem perfil admin/supervisor pode disparar queries antes do redirecionamento. A policy atual de `profiles` deve impedir leitura ampla de equipe para esse usuario, mas `production_tasks` e `clientes_cadastro` possuem historicamente policies permissivas. Se a Pauta virar uma area sensivel, considerar proteger `/pauta` no proxy ou centralizar a leitura em RPC com autorizacao explicita.

## Tela `/pauta`

Arquivo: `src/app/(auth)/pauta/page.tsx`

Responsabilidades:

- renderizar header com titulo "Pauta";
- carregar `useTarefasSemResponsavel()`;
- carregar `useMembrosEquipe()`;
- renderizar `TarefasSemResponsavel`;
- renderizar `KanbanMembros`;
- bloquear usuarios que nao sejam admin/supervisor.

Estados visuais:

| Estado                         | UI                                                          |
| ------------------------------ | ----------------------------------------------------------- |
| Auth carregando ou sem profile | Loader central "Carregando..."                              |
| Usuario sem permissao          | Redireciona para `/producao` e retorna `null`               |
| Tarefas carregando             | Skeleton simples dentro do bloco de tarefas sem responsavel |
| Membros carregando             | Loader "Carregando equipe..."                               |
| Sem membros                    | Estado vazio "Nenhum membro da equipe encontrado"           |
| Sem tarefas sem responsavel    | Estado vazio "Nenhuma tarefa sem responsavel"               |

## Componentes

### `TarefasSemResponsavel`

Arquivo: `src/components/pauta/tarefas-sem-responsavel.tsx`

Recebe:

```ts
{
  tarefas: TarefaSemResponsavel[]
  isLoading?: boolean
}
```

Comportamento:

- mostra uma tabela compacta com cliente, codigo, etapa/status e prazo;
- cada linha e `draggable`;
- `onDragStart` grava no `DataTransfer`:
  - `pautaTaskId`;
  - `pautaTaskTitle`;
- clique direto navega para `/producao?task_id=<id>&from=pauta`;
- deadline vencido e exibido em vermelho;
- deadline nulo aparece como "Sem prazo".

Contrato de item:

```ts
export interface TarefaSemResponsavel {
  id: string
  title: string
  deadline: string | null
  status: string
  priority: string
  cliente_code: string
  cliente_nome: string
  cliente_id: string
  stage_name: string
  stage_color: string
}
```

### `KanbanMembros`

Arquivo: `src/components/pauta/kanban-membros.tsx`

Recebe:

```ts
{
  membros: MembroEquipe[]
  isLoading?: boolean
}
```

Comportamento:

- renderiza uma coluna horizontal para cada membro;
- exibe avatar, nome, especialidade e quantidade de tarefas;
- cada coluna aceita drop de uma tarefa sem responsavel;
- `handleDrop` le `pautaTaskId` e `pautaTaskTitle`;
- chama `useAtribuirTarefa().mutateAsync({ taskId, assignedTo: membro.id })`;
- mostra toast de sucesso ou erro.

Especialidades com estilo customizado:

| Specialty | Label  | Estilo                       |
| --------- | ------ | ---------------------------- |
| `video`   | Video  | fundo roxo claro, texto roxo |
| `design`  | Design | fundo rosa claro, texto rosa |

Demais especialidades usam fallback cinza.

### `TaskCardPauta`

Arquivo: `src/components/pauta/task-card-pauta.tsx`

Comportamento:

- renderiza card compacto para tarefa ja atribuida;
- usa borda esquerda por prioridade:
  - `critica`: vermelho;
  - `alta`: laranja;
  - `media`: azul;
  - `baixa`: cinza;
- mostra icone de alerta quando `task.is_urgent` e verdadeiro;
- exibe codigo do cliente, nome do cliente ou `task.title`, etapa e deadline;
- clique navega para `/producao?task_id=<id>&from=pauta`.

Teste existente:

- garante renderizacao de codigo/nome/etapa;
- garante navegacao para Producao com `from=pauta`;
- garante fallback quando nao ha cliente, etapa ou prazo.

## Hooks e contratos

Todos os hooks ficam em `src/hooks/use-pauta.ts` e usam React Query.

### `useTarefasSemResponsavel()`

Query key:

```ts
;['pauta', 'tarefas-sem-responsavel']
```

Enabled:

```ts
!!user
```

Consulta:

```ts
supabase
  .from('production_tasks')
  .select(
    `
    id,
    title,
    deadline,
    status,
    priority,
    cliente:clientes_cadastro(id, code, nomecliente),
    pipeline_stage:client_pipeline_stages(id, name, color)
  `
  )
  .is('assigned_to', null)
  .neq('status', 'finalizado')
  .order('deadline', { ascending: true, nullsFirst: false })
```

Depois da consulta, o hook remove tarefas cuja etapa ou status esteja na lista de etapas excluidas.

Etapas/status excluidos da Pauta:

| Valor normalizado           |
| --------------------------- |
| `onboarding`                |
| `roteiro`                   |
| `roteiro em aprovacao`      |
| `atendimento`               |
| `criacao`                   |
| `ajuste de roteiro`         |
| `delivery`                  |
| `aguardando`                |
| `celebridade`               |
| `aprovado pela celebridade` |
| `finalizado`                |

Observacao: a exclusao compara `pipeline_stage.name` e `task.status` em lowercase. Ela nao usa `pipeline_stage.slug`, entao mudancas em labels, acentos ou encoding podem alterar o comportamento.

### `useMembrosEquipe()`

Query key:

```ts
;['pauta', 'membros-equipe', profile?.specialty, isAdmin]
```

Enabled:

```ts
!!user && !!profile
```

Primeira consulta: busca membros ativos.

```ts
supabase
  .from('profiles')
  .select('id, full_name, avatar_url, specialty')
  .in('role', ['producao', 'supervisor'])
  .eq('status', 'active')
  .order('full_name', { ascending: true })
```

Filtro por perfil logado:

| Usuario logado                                  | Membros retornados                 |
| ----------------------------------------------- | ---------------------------------- |
| Admin                                           | `specialty in ('video', 'design')` |
| Supervisor com `specialty = 'video'`            | somente `video`                    |
| Supervisor com `specialty = 'design'`           | somente `design`                   |
| Supervisor com outra specialty ou sem specialty | fallback para `video` e `design`   |

Segunda consulta: busca tarefas atribuidas aos membros encontrados.

```ts
supabase
  .from('production_tasks')
  .select(
    `
    *,
    cliente:clientes_cadastro(id, code, nomecliente, celebridade, whatsapp, responsavel_atendimento),
    pipeline_stage:client_pipeline_stages(id, name, slug, color, icon, order_index),
    assignee:profiles!production_tasks_assigned_to_fkey(id, full_name, avatar_url),
    creator:profiles!production_tasks_created_by_fkey(id, full_name, avatar_url)
  `
  )
  .in('assigned_to', membroIds)
  .neq('status', 'finalizado')
  .order('deadline', { ascending: true, nullsFirst: false })
```

O hook aplica a mesma lista de etapas/status excluidos e agrupa as tarefas por `assigned_to`.

Contrato de retorno:

```ts
export interface MembroEquipe {
  id: string
  full_name: string
  avatar_url: string | null
  specialty: string
  tarefas: ProductionTaskWithDetails[]
}
```

### `useAtribuirTarefa()`

Mutation:

```ts
{
  taskId: string
  assignedTo: string
}
```

Persistencia:

```ts
supabase
  .from('production_tasks')
  .update({ assigned_to: assignedTo })
  .eq('id', taskId)
  .select()
  .single()
```

Ao concluir com sucesso, invalida:

```ts
queryClient.invalidateQueries({ queryKey: ['pauta'] })
queryClient.invalidateQueries({ queryKey: ['production-tasks'] })
```

Nao ha optimistic update. A UI depende do refetch para remover a tarefa da lista sem responsavel e inclui-la na coluna do membro.

## Banco de dados

### `production_tasks`

Principal tabela do modulo. Criada originalmente em `supabase/migrations/20260205120000_create_production_tasks.sql`.

Colunas usadas pela Pauta:

| Coluna              | Uso                                                               |
| ------------------- | ----------------------------------------------------------------- |
| `id`                | Identificador da tarefa e parametro de navegacao para Producao    |
| `cliente_id`        | Relacao com `clientes_cadastro`                                   |
| `pipeline_stage_id` | Relacao com `client_pipeline_stages`                              |
| `assigned_to`       | Campo atualizado ao atribuir uma tarefa                           |
| `created_by`        | Relacao carregada na lista de tarefas atribuidas                  |
| `title`             | Fallback visual quando nao ha cliente                             |
| `status`            | Filtro para remover `finalizado` e outras etapas/status excluidos |
| `priority`          | Cor da borda do card                                              |
| `is_urgent`         | Icone de alerta no card                                           |
| `deadline`          | Ordenacao e indicacao de atraso                                   |

Indices existentes relevantes:

| Indice                                | Uso esperado                                            |
| ------------------------------------- | ------------------------------------------------------- |
| `idx_production_tasks_assigned_to`    | Busca por responsavel e atribuicao                      |
| `idx_production_tasks_status`         | Filtro de status                                        |
| `idx_production_tasks_pipeline_stage` | Join/filtro por etapa                                   |
| `idx_production_tasks_deadline`       | Ordenacao por prazo                                     |
| `idx_production_tasks_sort`           | Ordenacao composta antiga por urgencia/prioridade/prazo |
| `idx_prod_tasks_assigned_stage_sort`  | Otimizacao recente para visoes/RPCs de Producao         |

### `profiles`

Usada para:

- validar perfil logado via `useAuth()`;
- listar membros ativos de producao/supervisao;
- obter nome/avatar do responsavel e criador da tarefa.

Campos relevantes:

| Coluna       | Uso                                                     |
| ------------ | ------------------------------------------------------- |
| `id`         | FK de `production_tasks.assigned_to` e `created_by`     |
| `full_name`  | Nome exibido nas colunas                                |
| `avatar_url` | Avatar do membro                                        |
| `role`       | Filtro `producao`/`supervisor` e guard admin/supervisor |
| `status`     | Filtro `active`                                         |
| `specialty`  | Escopo de visibilidade por admin/supervisor             |

### `client_pipeline_stages`

Usada para exibir nome/cor da etapa e excluir etapas que nao devem entrar na Pauta.

Campos relevantes:

| Coluna        | Uso                                                            |
| ------------- | -------------------------------------------------------------- |
| `id`          | FK de `production_tasks.pipeline_stage_id`                     |
| `name`        | Exibicao e filtro de exclusao                                  |
| `slug`        | Carregado na lista de membros, mas nao usado no filtro atual   |
| `color`       | Cor do badge                                                   |
| `icon`        | Carregado para compatibilidade com `ProductionTaskWithDetails` |
| `order_index` | Carregado para compatibilidade com Producao                    |

### `clientes_cadastro`

Usada apenas como relacao de leitura para exibir dados do cliente.

Campos relevantes:

| Coluna                                               | Uso                                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `id`                                                 | Identificador do cliente                                                            |
| `code`                                               | Codigo exibido em lista/card                                                        |
| `nomecliente`                                        | Nome principal exibido                                                              |
| `celebridade`, `whatsapp`, `responsavel_atendimento` | Carregados nas tarefas atribuidas para compatibilidade com cards/modais de Producao |

## RLS, policies e permissoes de banco

### `production_tasks`

Policies originais em `20260205120000_create_production_tasks.sql`:

| Operacao | Regra atual                               |
| -------- | ----------------------------------------- |
| `SELECT` | `authenticated` pode ler todas as tarefas |
| `INSERT` | `auth.uid() = created_by`                 |
| `UPDATE` | responsavel, criador, admin ou supervisor |
| `DELETE` | criador ou admin                          |

Ponto critico: as policies antigas de `UPDATE`/`DELETE` consultam `profiles` dentro da policy. Isso contraria a regra atual do `AGENTS.md` para novas policies, porque pode causar recursao RLS (`42P17`) quando combinado com policies dependentes. Se alguem tocar nessas policies, deve migrar para helpers `SECURITY DEFINER`, como `public.is_admin_or_supervisor()` e `public.is_admin()`.

### `profiles`

A migration `supabase/migrations/20260505190000_fix_profiles_rls_recursion.sql` recria helpers seguros:

- `get_user_role(uuid)`;
- `get_user_status(uuid)`;
- `is_admin()`;
- `is_admin_or_supervisor()`;
- `is_active_user()`.

Policies vigentes documentadas ali:

| Policy                          | Operacao | Regra                               |
| ------------------------------- | -------- | ----------------------------------- |
| `profiles_select_self_or_admin` | `SELECT` | proprio usuario ou admin/supervisor |
| `profiles_insert_self_or_admin` | `INSERT` | proprio usuario ou admin            |
| `profiles_update_self_or_admin` | `UPDATE` | proprio usuario ou admin            |

A Pauta depende dessa leitura ampla de `profiles` para admin/supervisor listar membros da equipe.

### `client_pipeline_stages`

Policies originais:

| Operacao | Regra             |
| -------- | ----------------- |
| `SELECT` | leitura permitida |
| `ALL`    | escrita por admin |

Assim como em `production_tasks`, a policy antiga de escrita usa subquery em `profiles`. Nao copiar esse padrao em novas migrations.

### `clientes_cadastro`

Historicamente possui policies permissivas para leitura e update, incluindo `Allow public read on clientes_cadastro` em `20260205180000_fix_clientes_update_policy_v2.sql`. A Pauta so le campos de cliente por join, mas qualquer endurecimento de RLS nessa tabela precisa validar a tela `/pauta`.

## Integracoes e dependencias

| Dependencia             | Uso                                                     |
| ----------------------- | ------------------------------------------------------- |
| Supabase client browser | Queries e update direto em `production_tasks`           |
| React Query             | Cache, `staleTime` de 15s e invalidacao apos atribuicao |
| `useAuth()`             | User/profile e flags admin/supervisor                   |
| `next/navigation`       | Navegacao para Producao e redirecionamento de acesso    |
| `useToast()`            | Feedback de sucesso/erro na atribuicao                  |
| Lucide icons            | Icones de header, prazo, urgencia, vazio e drag handle  |

Nao ha API route propria do modulo Pauta.

Nao ha Edge Function propria do modulo Pauta.

Nao ha integracao direta com Z-API/WhatsApp neste modulo.

## Fluxos de usuario

### Atribuir tarefa

1. Admin/supervisor abre `/pauta`.
2. Localiza uma tarefa na lista "Tarefas sem responsavel".
3. Arrasta a linha para a coluna de um membro.
4. `KanbanMembros` recebe o drop e chama `useAtribuirTarefa`.
5. Supabase atualiza `production_tasks.assigned_to`.
6. React Query invalida caches da Pauta e de tarefas de producao.
7. Tarefa sai da lista sem responsavel e aparece na coluna do membro.

### Abrir detalhes da tarefa

1. Usuario clica em uma linha ou card.
2. Pauta navega para `/producao?task_id=<id>&from=pauta`.
3. Producao usa `useMainTaskWithSubtasks(taskId)` para carregar a tarefa.
4. `TaskDetailFullModal` abre automaticamente.
5. Ao fechar o modal, `ProducaoPage` verifica `from=pauta` e chama `router.replace('/pauta')`.

## Regras de negocio

- Apenas admin e supervisor devem operar a Pauta.
- A Pauta distribui tarefas entre membros de `video` e `design`.
- Admin ve membros ativos de `video` e `design`.
- Supervisor ve membros da sua propria especialidade quando ela e `video` ou `design`.
- Supervisor sem specialty operacional de pauta cai no fallback `video` + `design`.
- Tarefas com `assigned_to = null` entram na lista superior se nao estiverem finalizadas nem em etapa/status excluido.
- Tarefas ja atribuidas entram na coluna do respectivo membro, tambem excluindo finalizadas e etapas/status fora da Pauta.
- Atribuir tarefa nao altera etapa, status, prioridade, prazo, briefing nem subtarefas.
- A ordenacao principal das listas e `deadline ASC NULLS LAST`.
- Prazo vencido e calculado no cliente comparando `new Date(deadline) < new Date()`.

## Pontos de atencao

- A lista de etapas excluidas esta duplicada dentro de `useTarefasSemResponsavel` e `useMembrosEquipe`. Ao alterar regra de visibilidade, atualizar os dois pontos ou extrair constante compartilhada.
- O filtro de exclusao usa `stage.name`, nao `stage.slug`. Isso torna o comportamento sensivel a mudancas de label, acento e encoding.
- O guard de `/pauta` e client-side. Se a rota precisar de protecao forte, incluir `/pauta` no proxy ou mover leitura/mutacao para API/RPC com autorizacao.
- As policies legadas de `production_tasks` e `client_pipeline_stages` consultam `profiles` diretamente. Novas alteracoes de RLS devem seguir a regra do repo e usar helpers `SECURITY DEFINER`.
- `useAtribuirTarefa` atualiza somente `assigned_to`; se futuramente a atribuicao precisar registrar historico ou notificar usuarios, essa mutacao direta pode ficar insuficiente.
- Nao ha optimistic update nem rollback local. Em conexao lenta, a tela so reflete a atribuicao depois do refetch.
- Drag-and-drop HTML5 pode exigir alternativa acessivel/mobile se a Pauta for usada em tablets/celulares.
- A cobertura automatizada atual cobre apenas `TaskCardPauta`; lista, kanban, hooks, permissao e drag-and-drop ainda carecem de testes.
- `useMembrosEquipe` busca tarefas para todos os membros encontrados em uma unica query `.in('assigned_to', membroIds)`. Para equipes maiores, monitorar volume e considerar RPC/read model paginado.
- O modulo consome dados de Producao e deve ser validado junto de mudancas em `production_tasks`, `profiles.specialty`, roles e etapas do pipeline.

## Como testar ou validar

### Validacao estatica

1. Rodar `pnpm test -- src/components/pauta/__tests__/task-card-pauta.test.tsx` se o runner aceitar path direto.
2. Rodar `pnpm test`.
3. Rodar `pnpm build`.
4. Conferir typecheck se o fluxo de CI exigir script separado.

### Fluxo manual admin

1. Login com usuario `admin`.
2. Acessar `/pauta` pelo menu.
3. Confirmar que a lista de tarefas sem responsavel carrega.
4. Confirmar que membros de `video` e `design` aparecem.
5. Arrastar uma tarefa para um membro.
6. Confirmar toast de sucesso.
7. Confirmar no banco que `production_tasks.assigned_to` recebeu o `profiles.id` do membro.
8. Confirmar que a tarefa saiu da lista sem responsavel e apareceu na coluna correta.
9. Clicar na tarefa, abrir modal em `/producao` e fechar para retornar a `/pauta`.

### Fluxo manual supervisor

1. Login com supervisor `specialty = 'video'`.
2. Confirmar que aparecem apenas membros `video`.
3. Login com supervisor `specialty = 'design'`.
4. Confirmar que aparecem apenas membros `design`.
5. Testar supervisor com outra specialty e confirmar fallback esperado para `video`/`design`.

### Sanidade RLS

1. Acessar `/pauta` como admin e supervisor.
2. Verificar console do browser por erros Supabase.
3. Verificar logs do Supabase por `42P17` ou `infinite recursion`.
4. Tentar acessar como usuario `producao` e confirmar redirecionamento para `/producao`.
5. Confirmar que o usuario sem permissao nao consegue atualizar `assigned_to` por chamada direta se as regras de produto exigirem essa restricao.

## Lacunas conhecidas

- Nao ha README anterior do modulo Pauta.
- Nao ha testes automatizados para `TarefasSemResponsavel`.
- Nao ha testes automatizados para `KanbanMembros` e drop/erro de atribuicao.
- Nao ha testes de hook com Supabase mockado para os filtros de etapa/status.
- Nao ha protecao server-side dedicada para `/pauta`.
- Nao ha auditoria/historico proprio para atribuicoes feitas pela Pauta alem do que triggers de tarefas eventualmente registrem.
- Nao ha estado de erro explicito na pagina para falhas das queries; a experiencia depende dos estados padrao do React Query e dos componentes.
