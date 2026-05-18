# Modulo Notificacoes

Documentacao tecnica do modulo Notificacoes.

Ultima atualizacao: 2026-05-08

## Objetivo

O modulo Notificacoes cobre os avisos operacionais exibidos para usuarios autenticados no produto. Hoje ele e composto por tres frentes principais:

- alarmes/lembretes agendados entre membros do time;
- notificacoes do sistema persistidas em `system_notifications`, usadas principalmente pelo fluxo de aprovacao de celebridade;
- utilitarios de som para chamar atencao do usuario.

Nao confundir este modulo com `toast` de UI. Os toasts (`src/components/ui/toast.tsx`) sao feedbacks efemeros de acoes locais, como "Alarme criado" ou "Erro ao salvar". As notificacoes deste documento sao dados persistidos, popups globais ou sinais sonoros que atravessam telas.

## Principais caminhos

| Area                    | Caminho                                                             | Papel                                                                  |
| ----------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Rota de alarmes         | `src/app/(auth)/alarmes/page.tsx`                                   | Tela de gestao de alarmes recebidos e criados                          |
| Provider global         | `src/components/alarmes/alarm-notification-provider.tsx`            | Escuta alarmes vencidos, mostra popups e controla som repetitivo       |
| Dropdown do header      | `src/components/alarmes/alarm-header-dropdown.tsx`                  | Sino do header, lista `system_notifications` e linka para `/alarmes`   |
| Popup de alarme         | `src/components/alarmes/alarm-notification-popup.tsx`               | Aviso flutuante exibido quando um alarme vence                         |
| Card de alarme          | `src/components/alarmes/alarm-card.tsx`                             | Renderiza status, metadata e acoes de um alarme                        |
| Lista de alarmes        | `src/components/alarmes/alarms-list.tsx`                            | Ordena pendentes, realizados e cancelados                              |
| Formulario de alarme    | `src/components/alarmes/alarm-form-modal.tsx`                       | Cria/edita alarmes                                                     |
| Metricas de alarmes     | `src/components/alarmes/alarms-metrics-bar.tsx`                     | Mostra pendentes, realizados hoje e criados pelo usuario               |
| Hooks de alarmes        | `src/hooks/use-alarms.ts`                                           | Queries, mutacoes e realtime/polling da tabela `alarms`                |
| Hooks de notificacoes   | `src/hooks/use-system-notifications.ts`                             | Lista, contador e reconhecimento de `system_notifications`             |
| Som de alarme           | `src/hooks/use-alarm-sound.ts`                                      | Toca `/sounds/notification.mp3` em loop enquanto houver alarme ativo   |
| Som de mensagem         | `src/hooks/use-notification-sound.ts`                               | Hook/global de som baseado em arquivo MP3; atualmente sem uso direto   |
| Som via Web Audio       | `src/lib/notification-sound.ts`                                     | Beep sintetico testado em unidade; atualmente sem uso direto           |
| Asset de audio          | `public/sounds/notification.mp3`                                    | Arquivo usado por alarmes e hooks de som                               |
| Documentacao do asset   | `public/sounds/README.md`                                           | Especificacao esperada para o arquivo de som                           |
| Layout autenticado      | `src/app/(auth)/layout.tsx`                                         | Injeta `AlarmNotificationProvider` e `AlarmHeaderDropdown` globalmente |
| Tipos Supabase          | `src/types/supabase.ts`                                             | Define `Alarm`, `SystemNotification` e `AlarmWithProfiles`             |
| Fluxo celebridade       | `src/hooks/use-celebrity-approvals.ts`                              | Cria `system_notifications` para analises/aprovacoes/reprovacoes       |
| Migration de alarmes    | `supabase/migrations/20260204165746_create_alarms_table.sql`        | Cria tabela `alarms`, indices, RLS e realtime                          |
| Cancelamento de alarmes | `supabase/migrations/20260204171405_add_cancelled_at_to_alarms.sql` | Adiciona `cancelled_at` e policy de cancelamento                       |
| Testes de alarmes       | `src/components/alarmes/__tests__/*.test.tsx`                       | Cobre cards, lista, metricas e popup                                   |
| Teste de som sintetico  | `src/lib/__tests__/notification-sound.test.ts`                      | Cobre utilitario `src/lib/notification-sound.ts`                       |
| E2E autenticado         | `e2e/authenticated.spec.ts`                                         | Verifica navegacao basica para `/alarmes`                              |

## Funcionamento geral

### Alarmes

1. Um usuario autenticado acessa `/alarmes`.
2. A tela carrega `useAlarmMetrics()`, `useMyAlarms()` e `useCreatedAlarms()`.
3. O usuario pode criar um alarme para qualquer perfil ativo retornado por `useActiveProfiles()`.
4. O alarme e persistido em `public.alarms` com `created_by`, `target_user_id`, `title`, `description` e `scheduled_at`.
5. O usuario alvo ve o alarme na aba "Meus Alarmes"; o criador ve o mesmo registro na aba "Criados por Mim".
6. O layout autenticado monta `AlarmNotificationProvider` em todas as rotas autenticadas.
7. O provider chama `useRealtimeAlarms()`, que:
   - consulta alarmes do usuario alvo que ja venceram;
   - repete essa consulta a cada 30 segundos;
   - assina realtime da tabela `alarms` filtrando por `target_user_id`;
   - invalida queries de alarmes quando ha alteracao;
   - dispara callback para mostrar o popup.
8. Enquanto houver alarmes ativos, `useAlarmSound()` toca `/sounds/notification.mp3` em loop a cada 3 segundos.
9. O usuario pode fechar temporariamente o popup. Ele reaparece no proximo ciclo enquanto o alarme continuar vencido e nao reconhecido.
10. Ao clicar em "Marcar como Visto", o modulo grava `acknowledged_at`.

### Notificacoes do sistema

1. Algum fluxo do produto insere linhas em `system_notifications`.
2. O header autenticado mostra `AlarmHeaderDropdown`.
3. O dropdown chama `useSystemNotifications(50)` para listar notificacoes do usuario logado.
4. O contador chama `useUnreadNotificationCount()` e busca notificacoes com `read_at IS NULL`.
5. O usuario pode reconhecer uma notificacao individual ou todas de uma vez.
6. Reconhecer grava `read_at`.
7. Notificacoes do tipo `celebrity_*` navegam para `/celebridade` ao clicar.

Ponto importante: diferente dos alarmes, `system_notifications` nao tem realtime no frontend atual. O contador usa `staleTime` de 30 segundos e `refetchInterval` de 60 segundos apenas no contador de nao lidas.

### Sons

Ha tres implementacoes relacionadas:

| Arquivo                               | Implementacao                                                                | Uso atual                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/hooks/use-alarm-sound.ts`        | Audio HTML com `/sounds/notification.mp3`, volume 0.8, loop manual a cada 3s | Usado pelo provider de alarmes                                       |
| `src/hooks/use-notification-sound.ts` | Hook/global com Audio HTML e preferencia `notification-sound-muted`          | Exportado em `src/hooks/index.ts`, mas sem chamada direta encontrada |
| `src/lib/notification-sound.ts`       | Web Audio API com beep sintetico e double beep                               | Testado, mas sem chamada direta encontrada                           |

Se for evoluir som de mensagem no chat, primeiro decidir qual desses caminhos deve ser canonico para evitar duplicidade.

## Autorizacao e acesso

| Camada                 | Comportamento atual                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| Layout autenticado     | `src/app/(auth)/layout.tsx` so renderiza para usuario autenticado e injeta o provider global |
| Rota `/alarmes`        | Nao tem guard por role no client; qualquer usuario autenticado pode acessar                  |
| Criacao de alarme      | Depende de RLS de `alarms` e lista perfis ativos via `profiles`                              |
| Visualizacao de alarme | Alvo ve alarmes destinados a ele; criador ve alarmes criados por ele                         |
| Reconhecimento         | Alvo pode marcar como visto via `acknowledged_at`                                            |
| Edicao/cancelamento    | Criador pode editar/cancelar enquanto o alarme ainda nao foi reconhecido/cancelado           |
| Dropdown do header     | Mostra apenas `system_notifications.target_user_id = user.id` pela query do hook             |

## Tela `/alarmes`

Arquivo: `src/app/(auth)/alarmes/page.tsx`

Responsabilidades:

- exibir botao "Voltar" para `/clientes`;
- carregar metricas de alarmes;
- alternar entre abas "Meus Alarmes" e "Criados por Mim";
- aplicar filtros de status (`all`, `pending`, `acknowledged`);
- aplicar filtros de periodo (`all`, `today`, `week`, `month`);
- abrir modal de criacao/edicao;
- reconhecer alarmes recebidos;
- cancelar alarmes criados pelo usuario;
- exibir feedback por toast.

Estados visuais:

| Estado                  | UI                                                          |
| ----------------------- | ----------------------------------------------------------- |
| Metricas carregando     | Skeletons nos tres cards                                    |
| Lista carregando        | Skeletons na grade                                          |
| Sem alarmes             | Estado vazio com icone de sino                              |
| Alarme pendente futuro  | Card "Agendado" e mensagem "Aguardando horario agendado..." |
| Alarme pendente vencido | Card "Atrasado" com acao "Marcar como Visto"                |
| Alarme reconhecido      | Card "Realizado" read-only                                  |
| Alarme cancelado        | Card "Cancelado" read-only e opacidade reduzida             |

## Componentes

### `AlarmNotificationProvider`

Arquivo: `src/components/alarmes/alarm-notification-provider.tsx`

Comportamento:

- monta contexto com `activeAlarms` e `dismissAlarm`;
- chama `useRealtimeAlarms(handleAlarmTriggered)`;
- mantem `visibleAlarms` para os popups exibidos;
- evita re-adicionar alarme que esta sendo reconhecido por meio de `acknowledgingIdsRef`;
- inicia o som enquanto `activeAlarms.length > 0`;
- para o som quando nao ha alarmes ativos;
- reexibe alarmes dispensados a cada 3 segundos;
- renderiza ate 6 popups e um contador adicional quando houver mais.

Este provider envolve todas as paginas autenticadas. Alteracoes aqui impactam o produto inteiro.

### `AlarmHeaderDropdown`

Arquivo: `src/components/alarmes/alarm-header-dropdown.tsx`

Comportamento:

- renderiza o botao de sino no header;
- mostra badge com total de notificacoes nao lidas;
- abre dropdown via portal em `document.body`;
- separa abas "Novas" e "Lidas";
- permite reconhecer uma notificacao;
- permite reconhecer todas as notificacoes novas;
- usa icones por tipo:
  - `celebrity_approved`: `CheckCircle`;
  - `celebrity_rejected`: `XCircle`;
  - outros tipos: `Star`;
- ao clicar em notificacao com tipo iniciado por `celebrity_`, navega para `/celebridade`;
- footer aponta para `/alarmes`.

Ponto de nomenclatura: apesar do nome `AlarmHeaderDropdown`, esse componente lista `system_notifications`, nao linhas da tabela `alarms`.

### `AlarmFormModal`

Arquivo: `src/components/alarmes/alarm-form-modal.tsx`

Recebe:

```ts
{
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: {
    target_user_id: string
    title: string
    description: string
    scheduled_at: string
  }) => void
  isSubmitting?: boolean
  editingAlarm?: AlarmWithProfiles | null
}
```

Comportamento:

- lista perfis ativos via `useActiveProfiles()`;
- em criacao, seleciona o proprio usuario como alvo padrao;
- em criacao, preenche data de hoje e hora da proxima hora;
- em edicao, carrega dados do alarme selecionado;
- exige alvo, titulo, descricao, data e hora;
- converte data/hora local para ISO usando `new Date(...).toISOString()`;
- limita titulo a 100 caracteres e descricao a 500 caracteres.

Atencao: o input usa timezone local do browser e a exibicao posterior usa helpers de timezone do Brasil. Testar mudancas de data/hora com usuarios no fuso `America/Sao_Paulo`.

### `AlarmCard`

Arquivo: `src/components/alarmes/alarm-card.tsx`

Responsabilidades:

- calcular se o alarme esta vencido comparando `scheduled_at` com `new Date()`;
- formatar data/hora com helpers de `src/lib/utils/timezone`;
- mostrar status `Agendado`, `Atrasado`, `Realizado` ou `Cancelado`;
- exibir criador/alvo conforme props;
- liberar "Marcar como Visto" apenas para alarme pendente cujo horario ja passou;
- liberar "Editar" e "Cancelar" quando a lista permitir.

### `AlarmNotificationPopup`

Arquivo: `src/components/alarmes/alarm-notification-popup.tsx`

Responsabilidades:

- exibir popup compacto no canto inferior da tela;
- mostrar titulo, descricao, criador e horario agendado;
- considerar "atrasado" quando passou mais de 5 minutos do horario;
- permitir fechar temporariamente;
- permitir marcar como visto.

### `AlarmsList`

Arquivo: `src/components/alarmes/alarms-list.tsx`

Comportamento:

- mostra skeleton enquanto carrega;
- mostra estado vazio quando a lista esta vazia;
- separa e renderiza nesta ordem:
  1. pendentes (`acknowledged_at` e `cancelled_at` nulos);
  2. realizados (`acknowledged_at` preenchido);
  3. cancelados (`cancelled_at` preenchido).

### `AlarmsMetricsBar`

Arquivo: `src/components/alarmes/alarms-metrics-bar.tsx`

Metricas:

| Card              | Origem                                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| Alarmes Pendentes | `alarms` do usuario alvo sem `acknowledged_at` e sem `cancelled_at`        |
| Realizados Hoje   | `alarms` do usuario alvo com `acknowledged_at >= getBrazilStartOfDayISO()` |
| Criados por Mim   | total de `alarms.created_by = profile.id`                                  |

## Hooks e contratos

### `useMyAlarms(options)`

Arquivo: `src/hooks/use-alarms.ts`

Query key:

```ts
;['my-alarms', profile?.id, filter, period]
```

Busca:

- `alarms.target_user_id = profile.id`;
- ordena por `scheduled_at ASC`;
- aplica filtros de status e periodo;
- enriquece cada alarme com perfil do criador buscado em `profiles`;
- retorna `AlarmWithProfiles[]`.

### `useCreatedAlarms(options)`

Query key:

```ts
;['created-alarms', profile?.id, filter, period]
```

Busca:

- `alarms.created_by = profile.id`;
- ordena por `scheduled_at ASC`;
- aplica filtros de status e periodo;
- enriquece cada alarme com perfil do alvo buscado em `profiles`;
- retorna `AlarmWithProfiles[]`.

### `useAlarmMetrics()`

Query key:

```ts
;['alarm-metrics', profile?.id]
```

Faz tres contagens separadas na tabela `alarms`:

- pendentes para mim;
- reconhecidos hoje;
- criados por mim.

### `useActiveProfiles()`

Query key:

```ts
;['active-profiles']
```

Busca `profiles.status = 'active'`, ordenado por `full_name ASC`, para popular o select do formulario.

### Mutacoes de alarmes

| Hook                    | Escrita                               | Observacao                                      |
| ----------------------- | ------------------------------------- | ----------------------------------------------- |
| `useCreateAlarm()`      | `insert` em `alarms`                  | Preenche `created_by` com `profile.id`          |
| `useUpdateAlarm()`      | `update` por `id`                     | Atualiza titulo, descricao, horario e/ou alvo   |
| `useDeleteAlarm()`      | `delete` por `id`                     | Ainda existe no hook, mas a UI usa cancelamento |
| `useCancelAlarm()`      | `update { cancelled_at }` por `id`    | Caminho atual da UI para cancelamento           |
| `useAcknowledgeAlarm()` | `update { acknowledged_at }` por `id` | Usado na tela e no popup global                 |

Todas invalidam queries relacionadas (`my-alarms`, `created-alarms`, `alarm-metrics`) ao concluir com sucesso.

### `useRealtimeAlarms(onAlarmTriggered)`

Responsabilidades:

- manter `activeAlarms` local;
- buscar alarmes vencidos e nao reconhecidos/cancelados;
- tentar renovar sessao caso `supabase.auth.getSession()` nao retorne sessao;
- consultar criadores dos alarmes em `profiles`;
- filtrar ids marcados localmente como reconhecidos para evitar flash;
- executar callback para novos alarmes ativos;
- rodar polling a cada 30 segundos;
- assinar realtime com filtro:

```ts
{
  event: '*',
  schema: 'public',
  table: 'alarms',
  filter: `target_user_id=eq.${profile.id}`,
}
```

### `useSystemNotifications(limit)`

Arquivo: `src/hooks/use-system-notifications.ts`

Query key:

```ts
;['system-notifications', user?.id]
```

Busca:

- `system_notifications.target_user_id = user.id`;
- ordena por `created_at DESC`;
- limita por `limit`;
- `staleTime` de 30 segundos.

### `useUnreadNotificationCount()`

Query key:

```ts
;['system-notifications-unread-count', user?.id]
```

Busca contagem exata de notificacoes do usuario com `read_at IS NULL`. Tem `staleTime` de 30 segundos e `refetchInterval` de 60 segundos.

### Mutacoes de notificacoes do sistema

| Hook                            | Escrita                                                          |
| ------------------------------- | ---------------------------------------------------------------- |
| `useMarkNotificationRead()`     | `update { read_at }` por `id`                                    |
| `useMarkAllNotificationsRead()` | `update { read_at }` para todas do usuario com `read_at IS NULL` |

Ambas invalidam lista e contador de `system_notifications`.

## Banco de dados

### `alarms`

Criada por `supabase/migrations/20260204165746_create_alarms_table.sql` e alterada por `20260204171405_add_cancelled_at_to_alarms.sql`.

| Coluna            | Tipo          | Uso                                                             |
| ----------------- | ------------- | --------------------------------------------------------------- |
| `id`              | `uuid`        | Identificador do alarme                                         |
| `created_by`      | `uuid`        | Perfil que criou o alarme                                       |
| `target_user_id`  | `uuid`        | Perfil que deve receber o alarme                                |
| `title`           | `text`        | Titulo curto                                                    |
| `description`     | `text`        | Descricao opcional no tipo, mas obrigatoria no formulario atual |
| `scheduled_at`    | `timestamptz` | Horario em que o alarme deve disparar                           |
| `acknowledged_at` | `timestamptz` | Preenchido quando o alvo marca como visto                       |
| `cancelled_at`    | `timestamptz` | Preenchido quando o criador cancela                             |
| `created_at`      | `timestamptz` | Criacao                                                         |
| `updated_at`      | `timestamptz` | Atualizado por trigger `update_updated_at_column()`             |

Indices:

- `idx_alarms_target_user`;
- `idx_alarms_created_by`;
- `idx_alarms_scheduled_at`;
- `idx_alarms_acknowledged`;
- `idx_alarms_pending` parcial para `target_user_id, scheduled_at` quando `acknowledged_at IS NULL`;
- `idx_alarms_cancelled`.

Realtime:

- a migration adiciona `public.alarms` na publication `supabase_realtime` se ainda nao estiver presente.

### `system_notifications`

O tipo existe em `src/types/supabase.ts` e os hooks consultam/inserem nessa tabela, mas nao ha migration criando `public.system_notifications` encontrada em `supabase/migrations` ou `supabase/seed.sql` no momento deste mapeamento.

Contrato esperado pelo tipo:

| Coluna           | Tipo esperado        | Uso                              |
| ---------------- | -------------------- | -------------------------------- |
| `id`             | `uuid`/`string`      | Identificador da notificacao     |
| `target_user_id` | `uuid`/`string`      | Usuario que recebe a notificacao |
| `type`           | `text`/`string`      | Tipo funcional da notificacao    |
| `title`          | `text`/`string`      | Titulo exibido no dropdown       |
| `message`        | `text`/`string/null` | Texto auxiliar                   |
| `metadata`       | `json/jsonb`         | Dados de navegacao/contexto      |
| `read_at`        | `timestamptz/null`   | Reconhecimento pelo usuario      |
| `created_at`     | `timestamptz`        | Ordenacao da lista               |

Tipos usados hoje:

| Tipo                           | Origem                                                      | Navegacao atual                               |
| ------------------------------ | ----------------------------------------------------------- | --------------------------------------------- |
| `celebrity_analysis_submitted` | envio de pecas para analise em `use-celebrity-approvals.ts` | `/celebridade` porque inicia com `celebrity_` |
| `celebrity_approved`           | aprovacao de peca por celebridade                           | `/celebridade`                                |
| `celebrity_rejected`           | reprovacao de peca por celebridade                          | `/celebridade`                                |

## RLS, policies e permissoes

### Policies de `alarms`

`20260204165746_create_alarms_table.sql` cria:

| Policy                                   | Operacao | Regra                               |
| ---------------------------------------- | -------- | ----------------------------------- |
| `Users can view alarms targeted to them` | `SELECT` | `target_user_id = auth.uid()`       |
| `Users can view alarms they created`     | `SELECT` | `created_by = auth.uid()`           |
| `Active users can create alarms`         | `INSERT` | usuario logado ativo e alvo ativo   |
| `Creators can update pending alarms`     | `UPDATE` | criador e `acknowledged_at IS NULL` |
| `Targets can acknowledge alarms`         | `UPDATE` | alvo do alarme                      |
| `Creators can delete pending alarms`     | `DELETE` | criador e nao reconhecido           |

`20260204171405_add_cancelled_at_to_alarms.sql` remove a policy de delete e adiciona:

| Policy                               | Operacao | Regra                                    |
| ------------------------------------ | -------- | ---------------------------------------- |
| `Creators can cancel pending alarms` | `UPDATE` | criador, nao reconhecido e nao cancelado |

### Risco de RLS

A policy `Active users can create alarms` faz subqueries em `public.profiles` dentro do `WITH CHECK`.

Isso e um ponto de atencao porque o `AGENTS.md` deste repo marca subquery em tabela protegida por RLS dentro de policy como code smell que pode causar `42P17: infinite recursion detected in policy`.

Antes de alterar essa area, validar:

- se `profiles` esta com RLS habilitado no ambiente alvo;
- se as policies atuais de `profiles` chamam `alarms` ou outras tabelas dependentes;
- se existe funcao `SECURITY DEFINER` aplicavel, como `public.is_active_user()`;
- login completo, acesso a `/alarmes` e criacao de alarme com usuario real.

Padrao preferido para evolucao:

```sql
WITH CHECK (
  public.is_active_user()
  AND public.get_user_status(target_user_id) = 'active'
)
```

Confirmar assinatura e retorno das funcoes auxiliares antes de aplicar qualquer migration.

### Lacuna de RLS em `system_notifications`

Como nao foi localizada migration de `system_notifications`, tambem nao ha fonte versionada clara para:

- RLS habilitado;
- policy de `SELECT` por `target_user_id`;
- policy de `UPDATE read_at` pelo proprio alvo;
- policy de `INSERT` para fluxos autorizados;
- indices para `target_user_id`, `read_at` e `created_at`.

Se essa tabela for recriada ou migrada, seguir o padrao de nao consultar tabelas protegidas por RLS diretamente em policies.

## Contratos de payload

### Criar alarme

Payload recebido pela tela:

```ts
{
  target_user_id: string
  title: string
  description: string
  scheduled_at: string
}
```

Linha inserida:

```ts
{
  target_user_id,
  title,
  description,
  scheduled_at,
  created_by: profile.id,
}
```

Erros esperados:

- usuario sem `profile.id`: `Usuario nao autenticado`;
- cliente Supabase ausente: `Supabase client not configured`;
- violacao de RLS em `alarms`;
- alvo inexistente/inativo;
- horario invalido ou convertido de forma inesperada pelo browser.

### Atualizar alarme

Payload:

```ts
{
  alarmId: string
  data: {
    title?: string
    description?: string | null
    scheduled_at?: string
    target_user_id?: string
  }
}
```

Somente o criador deveria conseguir atualizar enquanto o alarme nao estiver reconhecido, conforme RLS.

### Cancelar alarme

Escrita:

```ts
{
  cancelled_at: new Date().toISOString()
}
```

Usado pela UI no lugar de delete fisico.

### Reconhecer alarme

Escrita:

```ts
{
  acknowledged_at: new Date().toISOString()
}
```

Usado na tela `/alarmes` e no popup global.

### Criar notificacao do sistema

Formato usado por `use-celebrity-approvals.ts`:

```ts
{
  target_user_id: userId,
  type: 'celebrity_approved' | 'celebrity_rejected' | 'celebrity_analysis_submitted',
  title: string,
  message: string,
  metadata: {
    cliente_id?: string
    task_id?: string
    peca_id?: string
    approval_id?: string
    action?: 'aprovado' | 'reprovado'
  }
}
```

O insert de notificacao no fluxo de envio para analise e protegido por `try/catch` e nao bloqueia o fluxo principal se falhar.

## Integracoes e dependencias

### Supabase

O modulo depende de:

- `createClient()` em `src/lib/supabase/client.ts`;
- `auth.getSession()` e `auth.refreshSession()` no polling de alarmes;
- tabelas `alarms`, `system_notifications` e `profiles`;
- publication `supabase_realtime` para updates de `alarms`;
- TanStack Query para cache, invalidacao e refetch.

### Celebridade

`src/hooks/use-celebrity-approvals.ts` cria notificacoes para:

- usuarios com `profiles.specialty = 'celebridade'` e `status = 'active'` quando uma nova analise e submetida;
- responsavel e admins quando uma peca e aprovada/reprovada.

As notificacoes nao carregam tela especifica por metadata; o dropdown so roteia por prefixo de tipo para `/celebridade`.

### Audio/browser

Alarmes usam API `HTMLAudioElement` com asset local:

```ts
new Audio('/sounds/notification.mp3')
```

Browsers podem bloquear autoplay se o usuario ainda nao interagiu com a pagina. O codigo captura falhas de `play()` silenciosamente.

### Edge Functions

Nao ha Edge Function dedicada ao modulo Notificacoes no estado atual. As notificacoes de sistema sao criadas no frontend/hook de celebridade, e os alarmes sao persistidos diretamente pelo cliente Supabase.

## Fluxos de usuario

### Criar alarme

1. Usuario abre `/alarmes`.
2. Clica em "Novo Alarme".
3. Seleciona alvo, titulo, descricao, data e horario.
4. Formulario chama `useCreateAlarm()`.
5. Supabase insere em `alarms`.
6. Queries de alarmes sao invalidadas.
7. Tela mostra toast de sucesso.
8. O usuario alvo recebe o alarme na propria lista e, quando vencer, no popup global.

### Editar alarme criado

1. Usuario abre aba "Criados por Mim".
2. Clica em "Editar" em um alarme pendente.
3. Modal reabre preenchido.
4. `useUpdateAlarm()` atualiza a linha.
5. Queries sao invalidadas.

### Cancelar alarme criado

1. Usuario abre aba "Criados por Mim".
2. Clica em "Cancelar".
3. Browser mostra `confirm()`.
4. `useCancelAlarm()` grava `cancelled_at`.
5. Alarme passa a aparecer como cancelado/read-only.

### Reconhecer alarme recebido

1. Usuario alvo ve card vencido ou popup.
2. Clica em "Marcar como Visto".
3. UI remove o popup localmente para evitar flash.
4. `useAcknowledgeAlarm()` grava `acknowledged_at`.
5. O som para quando nao ha mais alarmes ativos.

### Reconhecer notificacao do sistema

1. Usuario clica no sino do header.
2. Dropdown lista notificacoes novas.
3. Usuario clica "Reconhecer" ou "Reconhecer Todas".
4. Hook grava `read_at`.
5. Lista e contador sao invalidados.

## Regras de negocio

- Qualquer usuario autenticado pode acessar `/alarmes` no frontend atual.
- Um alarme sempre tem criador (`created_by`) e alvo (`target_user_id`).
- O formulario exige descricao, embora o tipo permita `description?: string | null`.
- Alarmes futuros nao podem ser marcados como vistos pela UI.
- Alarmes vencidos podem ser reconhecidos pelo alvo.
- Alarmes reconhecidos e cancelados ficam read-only na lista.
- A UI cancela alarmes por `cancelled_at`; nao usa delete fisico.
- Popups dispensados reaparecem enquanto o alarme continuar vencido e sem `acknowledged_at`.
- O som de alarme fica ativo enquanto houver ao menos um alarme ativo.
- Notificacoes `system_notifications` sao reconhecidas por `read_at`, nao por delete.
- Tipos iniciados com `celebrity_` navegam para `/celebridade`.

## Pontos de atencao

- `system_notifications` nao tem migration localizada. Antes de depender dela em novo ambiente, confirmar schema, RLS e indices.
- `AlarmHeaderDropdown` lista `system_notifications`, apesar do nome sugerir alarmes.
- `useDeleteAlarm()` ainda existe, mas a UI atual usa `useCancelAlarm()`. Evitar reintroduzir delete sem decisao explicita.
- A policy de insert em `alarms` consulta `profiles` dentro de RLS. Validar risco de recursao antes de alterar.
- `useRealtimeAlarms()` depende de `acknowledgedIds` no array de dependencias; mudancas ali podem recriar polling/callbacks com frequencia.
- `useRealtimeAlarms()` combina polling e realtime. Remover um deles pode atrasar ou quebrar disparos dependendo da configuracao Realtime do ambiente.
- O popup considera atraso somente apos 5 minutos, mas o card marca atrasado assim que `scheduled_at < now`.
- O formulario converte data/hora local para ISO; testar horario de Verao/inconsistencias de fuso se o publico sair de `America/Sao_Paulo`.
- `public/sounds/README.md` diz que som de chat toca via `useNotificationSound`, mas nao ha chamada direta encontrada no codigo atual.
- Ha duas funcoes chamadas `playNotificationSound`: uma em `src/hooks/use-notification-sound.ts` e outra em `src/lib/notification-sound.ts`. Importar a errada pode mudar comportamento.
- Falhas de audio por autoplay sao silenciosas; testes manuais precisam incluir interacao real no browser.
- Inserts de `system_notifications` em celebridade ignoram erro para nao bloquear fluxo principal. Isso pode esconder falhas de notificacao.

## Como testar ou validar

### Validacao estatica

```bash
pnpm test -- src/components/alarmes
pnpm test -- src/lib/__tests__/notification-sound.test.ts
```

Para uma validacao ampla antes de PR:

```bash
pnpm build && pnpm test
```

### Fluxo manual de alarmes

1. Logar com usuario ativo.
2. Abrir `/alarmes`.
3. Criar alarme para si mesmo com horario de poucos minutos no futuro.
4. Confirmar que aparece em "Meus Alarmes" e "Criados por Mim".
5. Esperar passar o horario.
6. Confirmar popup no canto inferior e som repetitivo.
7. Fechar popup e confirmar que ele reaparece.
8. Marcar como visto.
9. Confirmar que o popup some, o som para e o card vira "Realizado".

### Fluxo manual de cancelamento

1. Criar alarme para outro usuario.
2. Abrir aba "Criados por Mim".
3. Cancelar o alarme.
4. Confirmar `cancelled_at` preenchido no banco.
5. Confirmar que o alvo nao recebe popup quando o horario passar.

### Fluxo manual de notificacoes do sistema

1. Gerar evento de celebridade que insira `system_notifications`.
2. Logar como usuario alvo.
3. Confirmar badge no sino do header.
4. Abrir dropdown e validar titulo, mensagem e tempo relativo.
5. Clicar na notificacao e confirmar navegacao para `/celebridade`.
6. Reconhecer notificacao e confirmar `read_at` preenchido.
7. Usar "Reconhecer Todas" com multiplas notificacoes novas.

### Sanidade RLS

Executar com usuarios reais, nao apenas service role:

1. Usuario A cria alarme para Usuario B.
2. Usuario A ve em "Criados por Mim".
3. Usuario B ve em "Meus Alarmes".
4. Usuario C nao ve o alarme.
5. Usuario B reconhece o alarme.
6. Usuario A nao consegue editar/cancelar depois de reconhecido.
7. Verificar console/browser por `42P17`.
8. Verificar logs do Supabase por `infinite recursion detected in policy`.

### Validacao de audio

1. Abrir o app e interagir com a pagina ao menos uma vez.
2. Criar alarme vencido.
3. Confirmar que `/sounds/notification.mp3` carrega.
4. Confirmar que o som toca em loop a cada 3 segundos.
5. Reconhecer o alarme e confirmar que o som para.
6. Repetir com aba em background.

## Lacunas conhecidas

- Falta migration versionada de `system_notifications`.
- Falta realtime para `system_notifications`; o contador pode demorar ate o proximo refetch.
- Falta teste unitario direto para `use-system-notifications.ts`.
- Falta teste unitario direto para `use-alarm-sound.ts`.
- Falta teste unitario/integracao para `useRealtimeAlarms()`.
- Falta E2E criando, vencendo e reconhecendo um alarme.
- Falta decisao tecnica sobre qual utilitario de som deve ser canonico.
- Falta rota especifica para metadata de notificacoes; tipos de celebridade sempre vao para `/celebridade`.
- Falta documentar no banco se `description` deve ser obrigatoria ou opcional.
- Falta revisao de RLS de `alarms` para evitar subqueries diretas em `profiles`.
