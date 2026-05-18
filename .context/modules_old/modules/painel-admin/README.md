# Modulo Painel Admin

Documentacao tecnica do modulo Painel Admin.

Ultima atualizacao: 2026-05-08

## Objetivo

O modulo Painel Admin concentra a visao operacional administrativa da plataforma Aurea: metricas de atendimento/WhatsApp, usuarios online em tempo real e configuracao da conexao WhatsApp via Z-API.

A entrada principal fica em `/admin`. O acesso server-side e controlado pelo `proxy`, que permite apenas usuarios com `profile.role = 'admin'` ou `profile.role = 'supervisor'`. Algumas subareas aplicam restricoes adicionais no cliente ou nas Edge Functions.

Este documento cobre:

- `/admin`: dashboard administrativo e analytics WhatsApp;
- `/admin/ao-vivo`: painel de presenca em tempo real;
- `/admin/settings/whatsapp`: conexao, QR Code e desconexao do WhatsApp;
- API route de metricas administrativas;
- hooks, componentes, tabelas, RPCs e Edge Functions relacionadas.

O fluxo `/admin/equipe` e um modulo relacionado e possui documentacao propria em `.context/modules/gerenciar-equipe/README.md`.

## Principais caminhos

| Area                         | Caminho                                                            | Papel                                                                     |
| ---------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Rota principal               | `src/app/(auth)/admin/page.tsx`                                    | Dashboard administrativo com cards, graficos e analytics WhatsApp         |
| Aba Ao Vivo                  | `src/app/(auth)/admin/ao-vivo/page.tsx`                            | Lista usuarios online, idle/background e acessos do dia                   |
| Configuracao WhatsApp        | `src/app/(auth)/admin/settings/whatsapp/page.tsx`                  | Mostra status, QR Code e acao de desconectar WhatsApp                     |
| Navegacao interna            | `src/components/admin/admin-tabs.tsx`                              | Tabs entre `/admin` e `/admin/ao-vivo`                                    |
| Componentes admin            | `src/components/admin/`                                            | Cards, graficos, ranking, presenca e componentes visuais                  |
| Hook de metricas             | `src/hooks/use-dashboard-metrics.ts`                               | Consome `GET /api/admin/dashboard-metrics` com TanStack Query             |
| API de metricas              | `src/app/api/admin/dashboard-metrics/route.ts`                     | Calcula metricas com service role apos validar admin/supervisor           |
| Presenca global              | `src/contexts/presence-context.tsx`                                | Mantem subscription Realtime Presence compartilhada no layout autenticado |
| Hook de presenca             | `src/hooks/use-presence.ts`                                        | Reexporta o contexto de presenca                                          |
| Hook de acessos do dia       | `src/hooks/use-access-today.ts`                                    | Chama RPC `get_presence_metrics_today`                                    |
| Labels de rotas              | `src/lib/presence/route-labels.ts`                                 | Converte pathnames em labels exibidos no painel Ao Vivo                   |
| Hook de WhatsApp             | `src/hooks/use-whatsapp-status.ts`                                 | Consome Edge Functions de status e QR Code                                |
| Edge Function status         | `supabase/functions/zapi-connection-status/index.ts`               | Verifica conexao e dados do aparelho via Z-API                            |
| Edge Function QR Code        | `supabase/functions/zapi-qr-code/index.ts`                         | Gera QR Code de conexao via Z-API                                         |
| Edge Function status legacy  | `supabase/functions/zapi-status/index.ts`                          | Endpoint generico para status/qrcode/disconnect/restart                   |
| RPC acessos do dia           | `supabase/migrations/20260420140000_presence_session_tracking.sql` | Cria indice e `get_presence_metrics_today()`                              |
| Guard server-side            | `src/proxy.ts`                                                     | Protege rotas `/admin` para admin/supervisor                              |
| Modulo relacionado de equipe | `.context/modules/gerenciar-equipe/README.md`                      | Documenta `/admin/equipe`                                                 |

## Funcionamento geral

1. O usuario autenticado acessa uma rota `/admin`.
2. `src/proxy.ts` valida sessao e busca `profiles.status`/`profiles.role`.
3. Se o usuario nao for `admin` ou `supervisor`, o proxy redireciona para `/chat`.
4. A pagina `/admin` renderiza cards e graficos com dados de `useDashboardMetrics()`.
5. `useDashboardMetrics()` chama `GET /api/admin/dashboard-metrics`.
6. A API valida novamente se o solicitante e `admin` ou `supervisor`, cria um client Supabase com `SUPABASE_SERVICE_ROLE_KEY` e calcula metricas sobre `conversations`, `messages` e `profiles`.
7. A presenca em tempo real vem de uma subscription unica em `PresenceProvider`; `/admin` usa o contador e `/admin/ao-vivo` usa a lista detalhada.
8. A tela `/admin/settings/whatsapp` chama Edge Functions autenticadas para consultar conexao, buscar QR Code e desconectar a instancia Z-API.

## Telas e componentes

### `/admin`

Arquivo: `src/app/(auth)/admin/page.tsx`

Responsabilidades:

- exibir cabecalho com saudacao do usuario logado;
- mostrar contador de usuarios online via `usePresence()`;
- permitir refresh manual das metricas;
- linkar para `/admin/settings/whatsapp`;
- renderizar `AdminTabs`;
- carregar graficos dinamicamente com `next/dynamic` para evitar SSR em componentes dependentes de browser/graficos;
- renderizar estados de loading, erro e conteudo.

Cards principais:

| Card              | Origem no contrato                                     |
| ----------------- | ------------------------------------------------------ |
| Conversas Hoje    | `metrics.conversationsToday`                           |
| Mensagens Hoje    | `metrics.messagesToday`                                |
| Msgs Enviadas     | `metrics.whatsappMetrics.messagesSentToday`            |
| Msgs Recebidas    | `metrics.whatsappMetrics.messagesReceivedToday`        |
| Tempo 1a Resposta | `metrics.whatsappMetrics.avgFirstResponseTime`         |
| Resolvidas Hoje   | `metrics.resolvedToday`                                |
| Aguardando Resp.  | `metrics.whatsappMetrics.conversationsWithoutResponse` |
| Em Atendimento    | `metrics.statusDistribution[status='active']`          |

Graficos e blocos:

- `ConversationsChart`: conversas criadas/resolvidas nos ultimos 7 dias;
- `WhatsAppMessageTypes`: distribuicao por `messages.message_type`;
- `WhatsAppTopSenders`: ranking de mensagens de agentes;
- `OnlineAttendants`: equipe ativa com status online/offline;
- `WhatsAppPeakHours`: mensagens por hora no fuso do Brasil;
- `WhatsAppDayOfWeek`: mensagens enviadas/recebidas por dia da semana.

### `/admin/ao-vivo`

Arquivo: `src/app/(auth)/admin/ao-vivo/page.tsx`

Responsabilidades:

- restringir a tela a `isAdmin` no cliente;
- redirecionar usuario nao admin para `/admin`;
- mostrar contadores de online agora, acessaram hoje, ativos, ociosos e abas em background;
- renderizar cards por usuario online com pagina atual, role, especialidade e ultima atividade.

Ponto de atencao: o proxy permite `admin` e `supervisor` em `/admin`, mas esta pagina aplica `isAdmin` client-side. Se a restricao virar requisito de seguranca forte, mover tambem para uma validacao server-side ou middleware especifico.

Componentes principais:

| Componente     | Papel                                                              |
| -------------- | ------------------------------------------------------------------ |
| `LiveUserCard` | Mostra usuario online, status ativo/ocioso/background e rota atual |
| `CounterCard`  | Card local de contagem usado apenas na pagina Ao Vivo              |
| `AdminTabs`    | Mantem navegacao entre Dashboard e Ao Vivo                         |

### `/admin/settings/whatsapp`

Arquivo: `src/app/(auth)/admin/settings/whatsapp/page.tsx`

Responsabilidades:

- mostrar status da conexao WhatsApp;
- exibir avatar/nome/telefone quando conectado;
- buscar QR Code quando desconectado;
- executar desconexao via Edge Function `zapi-status?action=disconnect`;
- exibir instrucoes para conectar aparelho;
- mostrar dialog de confirmacao antes de desconectar.

Hooks usados:

- `useWhatsAppStatus()`;
- `useWhatsAppQRCode(enabled)`.

O status tem polling de 30s quando conectado e 10s quando desconectado. O QR Code recarrega a cada 30s quando habilitado.

## Componentes do modulo

Diretorio: `src/components/admin/`

| Arquivo                      | Papel                                                          |
| ---------------------------- | -------------------------------------------------------------- |
| `admin-tabs.tsx`             | Tabs de navegacao do modulo                                    |
| `metric-card.tsx`            | Card visual reutilizado para metricas principais               |
| `conversations-chart.tsx`    | Grafico de conversas por dia                                   |
| `whatsapp-message-types.tsx` | Distribuicao de tipos de mensagem                              |
| `whatsapp-peak-hours.tsx`    | Grafico de volume por horario                                  |
| `whatsapp-day-of-week.tsx`   | Grafico por dia da semana                                      |
| `whatsapp-top-senders.tsx`   | Ranking de agentes por mensagens enviadas                      |
| `online-attendants.tsx`      | Lista equipe ativa, mesclando `profiles` com Presence Realtime |
| `live-user-card.tsx`         | Card individual do painel Ao Vivo                              |
| `attendants-ranking.tsx`     | Ranking legado/alternativo de atendentes                       |
| `status-distribution.tsx`    | Distribuicao visual por status de conversa                     |

## Hook `useDashboardMetrics`

Arquivo: `src/hooks/use-dashboard-metrics.ts`

Assinatura:

```ts
export function useDashboardMetrics()
```

Query:

```ts
queryKey: ['dashboard-metrics']
```

Comportamento:

- chama `fetch('/api/admin/dashboard-metrics')`;
- propaga erro com mensagem da resposta JSON quando disponivel;
- usa `refetchInterval: 60_000`;
- usa `staleTime: 45_000`.

### Contrato `DashboardMetrics`

```ts
interface DashboardMetrics {
  conversationsToday: number
  conversationsTrend: number
  messagesToday: number
  messagesTrend: number
  pendingConversations: number
  avgResponseTime: string
  avgResponseTimeMinutes: number
  avgResponseTrend: number
  resolvedToday: number
  onlineAttendants: number
  conversationsByDay: Array<{
    date: string
    total: number
    resolved: number
  }>
  statusDistribution: Array<{
    name: string
    value: number
    status: 'active' | 'pending' | 'resolved'
  }>
  attendantsRanking: Array<{
    id: string
    name: string
    avatar_url: string | null
    conversations_count: number
    resolved_count: number
    messages_sent: number
    avg_response_time: string | null
  }>
  whatsappMetrics: WhatsAppMetrics
}
```

### Contrato `WhatsAppMetrics`

```ts
interface WhatsAppMetrics {
  messagesSentToday: number
  messagesReceivedToday: number
  messagesByType: Array<{ type: string; count: number; percentage: number }>
  peakHours: Array<{ hour: number; count: number }>
  messagesByDayOfWeek: Array<{ day: string; sent: number; received: number }>
  topSenders: Array<{
    id: string
    name: string
    avatar_url: string | null
    messages_sent: number
    avg_response_time_seconds: number | null
  }>
  avgFirstResponseTime: string
  avgFirstResponseTimeMinutes: number
  conversationsWithoutResponse: number
  unattributedMessages: number
}
```

## API `GET /api/admin/dashboard-metrics`

Arquivo: `src/app/api/admin/dashboard-metrics/route.ts`

Objetivo: retornar metricas administrativas agregadas usando service role, sem depender das RLS das tabelas operacionais para a leitura.

### Autorizacao

1. Cria client server-side comum com `createServerClient()`.
2. Chama `supabase.auth.getUser()`.
3. Busca `profiles.role` do usuario autenticado.
4. Permite apenas `admin` ou `supervisor`.
5. Se autorizado, cria client admin com `SUPABASE_SERVICE_ROLE_KEY`.

Resposta de erro de permissao:

```ts
NextResponse.json({ error: authError }, { status: 403 })
```

### Variaveis de ambiente

```txt
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Sem essas variaveis, `createAdminClient()` lanca erro e a API retorna `500`.

### Tabelas consultadas

| Tabela          | Uso                                                              |
| --------------- | ---------------------------------------------------------------- |
| `conversations` | contagem de conversas, status, resolvidas, grupos, `assigned_to` |
| `messages`      | volume, tipo, direcao, resposta media, ranking de agentes        |
| `profiles`      | agentes ativos de atendimento para ranking                       |

### Janela temporal

A API calcula o dia atual, ontem e ultimos 7 dias no fuso `America/Sao_Paulo`.

Helpers locais:

- `getBrazilTodayStr()`;
- `brazilMidnightToUTC(dateStr)`;
- `getBrazilHour(dateStr)`;
- `getBrazilDayOfWeek(dateStr)`;
- `getBrazilDateStr(dateStr)`.

### Regras de agregacao

| Metrica                    | Regra principal                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------ |
| Conversas hoje             | `conversations.created_at >= todayISO` e `is_group = false`                          |
| Conversas ontem            | `created_at` entre ontem e hoje, sem grupos                                          |
| Mensagens hoje             | `messages.created_at >= todayISO`, excluindo conversas de grupo                      |
| Resolvidas hoje            | `conversations.status = 'resolved'`, `is_archived = false`, `updated_at >= todayISO` |
| Em atendimento             | conversa nao grupo, nao arquivada e `status != 'resolved'`                           |
| Pendentes                  | `conversations.status = 'pending'`, sem grupos                                       |
| Aguardando resposta        | `unread_count > 0`, nao grupo, nao arquivada                                         |
| Tipos de mensagem          | agrega `messages.message_type` nos ultimos 7 dias                                    |
| Horarios de pico           | agrega `messages.created_at` por hora Brasil                                         |
| Dias da semana             | agrega mensagens enviadas/recebidas por dia Brasil                                   |
| Tempo de primeira resposta | calcula pares cliente -> proxima mensagem de agente dentro de 24h                    |
| Ranking de agentes         | conta mensagens `sender_type = 'agent'` nos ultimos 7 dias                           |

### Excluir grupos

A API primeiro busca IDs de conversas com `is_group = true` e aplica `not('conversation_id', 'in', (...))` nas queries de `messages`.

Ponto de atencao: quando houver muitos grupos, essa abordagem monta uma lista `in` no client. Se a quantidade crescer, considerar uma RPC ou query com join/view.

### Deduplicacao de mensagens de agente

O ranking tenta lidar com duplicidade entre mensagens criadas pela plataforma e pelo webhook:

1. Ordena mensagens de agentes por `created_at`.
2. Agrupa por `conversation_id` e primeiros 50 caracteres de `content`.
3. Considera duplicata quando o timestamp fica em uma janela de 5 segundos.
4. Prioriza a versao com `sender_id`.
5. Para mensagens sem `sender_id`, tenta atribuir pelo agente encontrado na mesma conversa ou por `conversations.assigned_to`.

Ponto de atencao: esta deduplicacao e heuristica. Mudancas em webhook, conteudo vazio, midias ou mensagens repetidas podem afetar o ranking.

## Presenca em tempo real

### `PresenceProvider`

Arquivo: `src/contexts/presence-context.tsx`

O provider cria uma unica subscription ao canal Supabase Realtime:

```ts
supabase.channel('online-users', {
  config: { presence: { key: user.id } },
})
```

Payload publicado por usuario:

```ts
interface OnlineUser {
  user_id: string
  username: string
  avatar_url?: string
  online_at: string
  role?: string
  specialty?: string
  pathname?: string
  page_label?: string
  entity_type?: string | null
  entity_id?: string | null
  last_activity_at?: string
  is_idle?: boolean
  tab_focused?: boolean
}
```

Comportamentos importantes:

- `onlineUsers` e derivado de `channel.presenceState()`;
- usa `user.id` como chave de presence, entao multiplas abas do mesmo usuario tendem a aparecer como um usuario consolidado;
- `IDLE_TIMEOUT_MS = 60_000`;
- activity local e enviada com throttle de 5s;
- mudancas de rota atualizam `pathname`, `page_label`, `entity_type` e `entity_id`;
- tab em background e detectada via `document.visibilitychange`.

### Registro de sessoes no `activity_log`

Quando o canal fica `SUBSCRIBED`, o provider insere um evento:

```ts
{
  user_id: user.id,
  action: 'session.started',
  entity_type: 'session',
  metadata: {
    pathname,
    user_agent: navigator.userAgent,
  },
}
```

Ha throttle local por usuario no `localStorage`:

```txt
aurea:presence:last_session:<user_id>
```

Intervalo atual: 30 minutos.

Falhas nesse insert sao silenciosas para nao derrubar a presenca em tempo real.

### RPC `get_presence_metrics_today`

Criada em `supabase/migrations/20260420140000_presence_session_tracking.sql`.

Contrato:

```sql
public.get_presence_metrics_today()
returns table (
  users_today integer,
  sessions_today integer
)
```

Comportamento:

- `LANGUAGE sql`;
- `STABLE`;
- `SECURITY DEFINER`;
- `SET search_path = public`;
- filtra `activity_log.action = 'session.started'`;
- calcula o inicio do dia em `America/Sao_Paulo`;
- retorna usuarios distintos e total de sessoes do dia.

Indice criado:

```sql
CREATE INDEX IF NOT EXISTS idx_activity_log_sessions
  ON public.activity_log (created_at DESC, user_id)
  WHERE action = 'session.started' AND user_id IS NOT NULL;
```

Ponto de atencao: a migration concede `EXECUTE` para `authenticated` e `anon`. Como a RPC retorna apenas contadores agregados, isso pode ser aceitavel, mas se a politica de privacidade ficar mais restrita, revisar o grant.

## WhatsApp e Z-API

### Hook `useWhatsAppStatus`

Arquivo: `src/hooks/use-whatsapp-status.ts`

Chama:

```ts
supabase.functions.invoke('zapi-connection-status')
```

Contrato:

```ts
interface WhatsAppStatus {
  connected: boolean
  phone?: string
  name?: string
  profilePic?: string
  smartphoneConnected?: boolean
}
```

Polling:

- conectado: 30s;
- desconectado: 10s;
- `staleTime: 5000`.

### Hook `useWhatsAppQRCode`

Chama:

```ts
supabase.functions.invoke('zapi-qr-code')
```

Contrato:

```ts
interface QRCodeResponse {
  qrCode: string | null
  expiresAt?: string
  error?: string
}
```

Comportamento:

- roda apenas quando `enabled = true`;
- refaz busca a cada 30s;
- retry 2 vezes;
- aceita QR Code em data URL, URL HTTP ou base64 puro.

### `zapi-connection-status`

Arquivo: `supabase/functions/zapi-connection-status/index.ts`

Fluxo:

1. Trata CORS com `handleCors(req)`.
2. Valida usuario com `requireAuth(req)`.
3. Le variaveis `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN` e opcional `ZAPI_CLIENT_TOKEN`.
4. Chama `GET /status` da Z-API.
5. Considera conectado se `connected === true` ou `smartphoneConnected === true`.
6. Se conectado, chama `GET /device` para obter telefone, nome e foto.
7. Retorna `WhatsAppStatus`.

Permissao: qualquer usuario autenticado consegue consultar status.

### `zapi-qr-code`

Arquivo: `supabase/functions/zapi-qr-code/index.ts`

Fluxo:

1. Trata CORS.
2. Valida usuario com `requireAuth(req)`.
3. Busca `profiles.role` com `serviceClient`.
4. Permite apenas `admin` ou `supervisor`.
5. Verifica status atual na Z-API.
6. Se ja conectado, retorna `{ qrCode: null, error: 'WhatsApp ja esta conectado' }`.
7. Busca QR Code em `GET /qr-code/image`.
8. Normaliza base64 para `data:image/png;base64,...` quando necessario.

Variaveis:

```txt
ZAPI_INSTANCE_ID
ZAPI_TOKEN
ZAPI_CLIENT_TOKEN
```

### `zapi-status`

Arquivo: `supabase/functions/zapi-status/index.ts`

Endpoint generico usado atualmente pela tela de configuracao para desconectar:

```ts
GET /functions/v1/zapi-status?action=disconnect
```

Acoes aceitas:

- `status`;
- `qrcode`;
- `disconnect`;
- `restart`.

Ponto de atencao: a funcao valida autenticacao, mas nao valida role admin/supervisor antes de executar `disconnect` ou `restart`. Como a tela so e acessivel via `/admin`, a protecao pratica vem do proxy; se esta funcao puder ser chamada diretamente por qualquer autenticado, reforcar permissao dentro da Edge Function.

## Banco de dados e entidades relacionadas

### `conversations`

Uso no Painel Admin:

- contagem de conversas criadas hoje/ontem;
- status `active`, `pending`, `resolved`;
- filtro `is_group`;
- filtro `is_archived`;
- calculo de aguardando resposta via `unread_count`;
- lookup de `assigned_to` para atribuir mensagens sem `sender_id`.

Campos relevantes:

- `id`;
- `created_at`;
- `updated_at`;
- `status`;
- `is_group`;
- `is_archived`;
- `unread_count`;
- `assigned_to`.

### `messages`

Uso:

- volume diario;
- direcao por `sender_type`;
- tipos por `message_type`;
- horarios de pico;
- dias da semana;
- primeira resposta;
- ranking de agentes.

Campos relevantes:

- `id`;
- `conversation_id`;
- `sender_id`;
- `sender_type`;
- `message_type`;
- `content`;
- `created_at`;
- `message_id`.

### `profiles`

Uso:

- validacao de role na API de metricas;
- profiles ativos com `specialty = 'atendimento'` para ranking;
- `OnlineAttendants` lista todos os profiles ativos e mescla com presenca;
- Edge Function de QR Code valida `admin`/`supervisor`.

Campos relevantes:

- `id`;
- `full_name`;
- `avatar_url`;
- `role`;
- `specialty`;
- `status`.

Regra critica: ao alterar RLS de `profiles`, seguir o `AGENTS.md` e usar helpers `SECURITY DEFINER` (`is_admin()`, `is_admin_or_supervisor()`, `is_active_user()`) em vez de subqueries diretas em policies.

### `activity_log`

Uso:

- persistir eventos `session.started`;
- alimentar contador "Acessaram hoje" e "sessoes hoje".

Campos usados:

- `user_id`;
- `action`;
- `entity_type`;
- `metadata`;
- `created_at`.

## Permissoes e RLS

### Camadas de autorizacao

| Camada                            | Comportamento                                                     |
| --------------------------------- | ----------------------------------------------------------------- |
| `src/proxy.ts`                    | Permite `/admin` apenas para `admin` ou `supervisor` ativos       |
| `/admin/ao-vivo`                  | Aplica `isAdmin` no cliente e redireciona nao admin para `/admin` |
| `/api/admin/dashboard-metrics`    | Revalida `admin` ou `supervisor` antes de usar service role       |
| `zapi-connection-status`          | Exige usuario autenticado                                         |
| `zapi-qr-code`                    | Exige `admin` ou `supervisor` dentro da funcao                    |
| `zapi-status`                     | Exige autenticacao, mas nao valida role por acao                  |
| `get_presence_metrics_today()`    | `SECURITY DEFINER`; grant para `authenticated` e `anon`           |
| Queries client-side de `profiles` | Dependem das RLS vigentes de `profiles`                           |

### Proxy

Arquivo: `src/proxy.ts`

Comportamento especifico para `/admin`:

1. Se nao ha sessao, redireciona para `/login`.
2. Busca `profiles.status` e `profiles.role`.
3. Se profile ausente, faz sign out e redireciona com `error=profile_missing`.
4. Se `status = 'blocked'`, faz sign out e redireciona com `error=blocked`.
5. Se role nao for `admin` nem `supervisor`, redireciona para `/chat`.
6. Caso contrario, permite.

Ponto de atencao: rotas `/api` sao excluidas do matcher do proxy. APIs precisam validar permissao internamente, como `dashboard-metrics` faz.

## Regras de negocio

- Painel Admin e visivel para `admin` e `supervisor` pelo proxy.
- Aba Ao Vivo hoje e restrita a `admin` no cliente.
- O dashboard exclui conversas de grupo das metricas principais.
- A janela de analytics do dashboard e ultimos 7 dias.
- O dia operacional usa `America/Sao_Paulo`.
- Tempo de primeira resposta conta pares cliente -> agente com diferenca positiva e menor que 24h.
- Ranking de atendimento considera profiles ativos com `specialty = 'atendimento'`.
- Mensagens de agente sem `sender_id` podem ser atribuidas por conversa, usando agente ja identificado na conversa ou `conversations.assigned_to`.
- Presence mostra estado atual via Realtime, nao por tabela persistida.
- "Acessaram hoje" vem de eventos persistidos em `activity_log`, com throttle local de 30 minutos por usuario.
- Configuracao WhatsApp opera uma unica instancia Z-API configurada por ambiente.

## Dependencias externas e ambiente

### Supabase

- Auth;
- Postgres;
- RLS;
- Realtime Presence;
- Edge Functions.

### Z-API

Edge Functions usam:

```txt
ZAPI_INSTANCE_ID
ZAPI_TOKEN
ZAPI_CLIENT_TOKEN
```

Endpoints externos usados:

- `/status`;
- `/device`;
- `/qr-code/image`;
- `/disconnect`;
- `/restart`.

### Next.js / frontend

- TanStack Query para cache/polling;
- Recharts nos componentes de graficos;
- Supabase client browser para Edge Functions e queries de profiles;
- `date-fns` para labels de distancia temporal no painel Ao Vivo.

## Pontos de atencao e riscos conhecidos

- A API de metricas usa service role; qualquer falha de autorizacao nela teria impacto amplo de leitura.
- `verifyAdminOrSupervisor()` depende de leitura em `profiles`; se RLS quebrar, usuario valido pode receber 403.
- A API de metricas faz varias queries server-side e processa ate 10.000 mensagens dos ultimos 7 dias; monitorar performance conforme volume cresce.
- Excluir grupos via lista de IDs pode ficar pesado se houver muitos grupos.
- Deduplicacao do ranking de agentes e heuristica e pode errar com midias, conteudo vazio ou mensagens repetidas.
- `zapi-status` permite `disconnect` e `restart` para qualquer autenticado que consiga chamar a funcao diretamente; revisar role check se isso for sensivel.
- `zapi-connection-status` permite qualquer autenticado consultar status da instancia WhatsApp.
- `get_presence_metrics_today()` tem grant para `anon`; avaliar se contador agregado deve ser publico.
- `PresenceProvider` silencia falhas ao inserir `activity_log`; o painel Ao Vivo continua funcionando, mas "Acessaram hoje" pode ficar subcontado.
- Presence usa `localStorage` para throttle; usuario em outro navegador/dispositivo pode gerar uma nova sessao.
- Varios textos e logs exibem encoding quebrado em arquivos existentes. Evitar misturar correcao de encoding com mudancas funcionais grandes.
- Alguns componentes admin exportados (`attendants-ranking`, `status-distribution`) podem estar legados ou nao usados diretamente na pagina atual; confirmar antes de remover.

## Como testar e validar

### Validacao automatizada

Rodar typecheck:

```bash
npm run type-check
```

Rodar testes relacionados a hooks quando houver mudancas de presenca:

```bash
npm run test -- use-access-today
```

Antes de PR, seguir padrao do repositorio:

```bash
npm run build && npm run test
```

### Validacao manual do dashboard

1. Login com usuario `admin`.
2. Acessar `/admin`.
3. Confirmar cards de metricas sem erro.
4. Confirmar que o contador online aparece no header.
5. Clicar em `Atualizar` e verificar refetch sem quebrar a UI.
6. Conferir graficos de conversas, tipos, horarios, dias da semana e ranking.
7. Validar que conversas de grupo nao entram nos totais principais.
8. Login com `supervisor` e confirmar acesso ao dashboard.
9. Login com usuario `producao` e confirmar redirecionamento para `/chat`.

### Validacao manual do Ao Vivo

1. Login com usuario `admin`.
2. Acessar `/admin/ao-vivo`.
3. Abrir outra sessao/aba com outro usuario ativo.
4. Confirmar aparicao do usuario em tempo real.
5. Trocar de rota no outro usuario e confirmar alteracao de `page_label`.
6. Deixar usuario sem atividade por mais de 60s e verificar estado "Ocioso".
7. Colocar aba em background e verificar estado correspondente.
8. Conferir contador "Acessaram hoje" depois de registrar sessao.
9. Login com `supervisor` e confirmar comportamento esperado atual: redirecionamento client-side para `/admin`.

### Validacao manual WhatsApp

1. Login como `admin` ou `supervisor`.
2. Acessar `/admin/settings/whatsapp`.
3. Confirmar status conectado/desconectado.
4. Se desconectado, verificar exibicao do QR Code.
5. Confirmar que o QR Code atualiza periodicamente.
6. Se conectado, validar nome, telefone e avatar quando retornados pela Z-API.
7. Testar fluxo de desconexao com dialog de confirmacao.
8. Verificar logs das Edge Functions e confirmar que o primeiro `console.log` aparece.
9. Confirmar que as Edge Functions foram deployadas com `--no-verify-jwt`, pois elas usam `requireAuth(req)` internamente.

### Validacao SQL sugerida

Contador de sessoes do dia:

```sql
select * from public.get_presence_metrics_today();
```

Eventos recentes de presenca:

```sql
select user_id, action, entity_type, metadata, created_at
from public.activity_log
where action = 'session.started'
order by created_at desc
limit 20;
```

Profiles usados no ranking:

```sql
select id, full_name, role, specialty, status
from public.profiles
where status = 'active'
  and specialty = 'atendimento'
order by full_name;
```

Mensagens de agentes sem `sender_id`:

```sql
select id, conversation_id, sender_id, sender_type, message_type, created_at
from public.messages
where sender_type = 'agent'
  and sender_id is null
order by created_at desc
limit 20;
```

## Checklist para futuros agentes

- Abrir `src/app/(auth)/admin/page.tsx` e `src/hooks/use-dashboard-metrics.ts` antes de alterar cards ou contrato.
- Se mudar metricas, atualizar tambem `src/app/api/admin/dashboard-metrics/route.ts` e os tipos locais do hook.
- Se mudar regras de permissao, revisar `src/proxy.ts`, API routes e Edge Functions; o proxy nao cobre `/api`.
- Se alterar `/admin/ao-vivo`, revisar `PresenceProvider`, `route-labels.ts` e a RPC `get_presence_metrics_today`.
- Se alterar WhatsApp admin, seguir regra do `AGENTS.md`: Edge Function chamada pelo frontend deve usar `_shared/auth.ts` e deploy com `--no-verify-jwt`.
- Se alterar RLS de `profiles`, usar helpers `SECURITY DEFINER` e testar ausencia de erro `42P17`.
- Se mexer em ranking de agentes, validar mensagens com e sem `sender_id` e duplicatas app/webhook.
- Se corrigir encoding, fazer em mudanca separada para reduzir ruido no diff.
- Se adicionar nova aba admin, atualizar `AdminTabs`, `route-labels.ts` e este README.
