# Modulo Chat

Documentacao tecnica do modulo Chat.

Ultima atualizacao: 2026-05-11

## Objetivo

O modulo Chat e a central de atendimento em tempo real. Ele lista conversas individuais e grupos, exibe mensagens, envia texto/midia/audio via Z-API, recebe webhooks do WhatsApp, integra mensagens rapidas, associa conversas a clientes e atualiza estados de leitura/resposta.

A tela principal fica em `/chat`.

## Principais caminhos

| Area                | Caminho                                                           | Papel                                                      |
| ------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| Rota principal      | `src/app/(auth)/chat/page.tsx`                                    | Metadata e render do client                                |
| Client da pagina    | `src/app/(auth)/chat/chat-page-client.tsx`                        | Le query params `conversation` e `filter`                  |
| Layout principal    | `src/components/chat/chat-layout.tsx`                             | Monta lista, header, mensagens, input e sidebar do cliente |
| Lista de conversas  | `src/components/chat/conversation-list.tsx`                       | Busca, filtros, conversas arquivadas, sem resposta, grupos |
| Input               | `src/components/chat/chat-input.tsx`                              | Texto, anexos, audio e mensagens rapidas                   |
| Lista de mensagens  | `src/components/chat/message-list.tsx`                            | Infinite scroll, notas, reactions, retry, delete e forward |
| Criar conversa      | `src/components/chat/new-conversation-modal.tsx`                  | Contatos, cliente existente e novo numero                  |
| Hook de conversas   | `src/hooks/use-conversations.ts`                                  | Infinite query de `conversations`                          |
| Hook de mensagem    | `src/hooks/use-messages.ts`                                       | Infinite query de `messages`                               |
| Envio de texto      | `src/hooks/use-send-message.ts`                                   | Insert otimista e chamada Edge `zapi-send`                 |
| Envio de midia      | `src/hooks/use-send-media.ts`                                     | Upload em Storage e chamada API `/api/zapi-send`           |
| Gravacao de audio   | `src/hooks/use-audio-recorder.ts`                                 | MediaRecorder com prioridade OGG/MP4/MPEG                  |
| Criacao de conversa | `src/hooks/use-create-conversation.ts`                            | Valida numero via `zapi-check-number`                      |
| Realtime mensagens  | `src/hooks/use-realtime-messages.ts`                              | Assina inserts/updates de `messages`                       |
| Realtime conversas  | `src/hooks/use-realtime-conversations.ts`                         | Assina inserts/updates/deletes de `conversations`          |
| API Next Z-API      | `src/app/api/zapi-send/route.ts`                                  | Envia texto/midia autenticado por cookie                   |
| Edge envio Z-API    | `supabase/functions/zapi-send/index.ts`                           | Envia texto/midia com auth compartilhada                   |
| Edge check number   | `supabase/functions/zapi-check-number/index.ts`                   | Consulta formato correto do numero na Z-API                |
| Webhook Z-API       | `supabase/functions/zapi-webhook/index.ts`                        | Recebe mensagens, status, midia e atualiza conversas       |
| Bucket de midia     | `supabase/migrations/20260203120000_create_chat_media_bucket.sql` | Cria bucket `chat-media`                                   |

## Funcionamento geral

1. Usuario acessa `/chat`.
2. `chat-page-client` le query params:
   - `conversation`: conversa inicial;
   - `filter`: atualmente usado para `sem_resposta`.
3. `ChatLayout` inicializa subscriptions realtime de conversas e mensagens.
4. `ConversationList` carrega conversas paginadas e aplica filtros.
5. Selecionar uma conversa carrega mensagens por `useMessages`.
6. `ChatInput` envia texto, midia, audio ou mensagem rapida.
7. Mensagens de saida entram no banco com status `sending` e depois mudam para `sent` ou `failed`.
8. Webhooks da Z-API criam/atualizam mensagens recebidas, status de entrega e dados da conversa.
9. Realtime atualiza caches sem precisar recarregar a pagina.

## Query params

| Parametro      | Uso                                                   |
| -------------- | ----------------------------------------------------- |
| `conversation` | Seleciona conversa ao abrir a tela                    |
| `filter`       | `sem_resposta` ativa filtro de conversas sem resposta |

## Lista de conversas

Arquivo: `src/components/chat/conversation-list.tsx`

Filtros principais:

- busca por nome, telefone ou conteudo;
- tag;
- vendedor/responsavel;
- arquivadas;
- tipo de conversa: todas, individual, grupo;
- nao lidas;
- sem resposta.

Regra de sem resposta:

- ultima mensagem do cliente ha mais de 2 horas;
- conversa nao resolvida;
- conversa nao marcada como respondida;
- sem resposta de agente posterior, com tolerancia de 30 minutos.

Hook usado:

`src/hooks/use-conversations.ts`

Query key inclui filtros e usa infinite query com page size 30.

## Mensagens

Arquivo: `src/hooks/use-messages.ts`

Comportamento:

- page size 50;
- busca mensagens mais recentes primeiro;
- inverte a pagina para entregar ordem cronologica ao componente;
- depende de `conversationId`.

`MessageList` adiciona:

- notas internas;
- reactions;
- retry de envio;
- delete;
- forward;
- mensagens sinteticas de upload em progresso;
- leitura manual via controles do header.

## Envio de texto

Arquivo: `src/hooks/use-send-message.ts`

Fluxo:

1. Insere mensagem local em `messages` com status `sending`.
2. Atualiza `conversations.last_message`, `last_message_at` e campos relacionados.
3. Se a conversa nao tem `assigned_to`, atribui ao usuario atual.
4. Chama Edge Function `zapi-send`.
5. Atualiza mensagem para `sent` com `message_id` retornado.
6. Em erro, marca mensagem como `failed`.
7. Invalida caches de mensagens e conversas.

## Envio de midia

Arquivo: `src/hooks/use-send-media.ts`

Fluxo:

1. Faz upload do arquivo para Storage via helper `uploadFile`.
2. Insere mensagem em `messages`.
3. Atualiza conversa.
4. Chama `/api/zapi-send`.
5. Para arquivos ate o limite configurado, envia base64.
6. Para arquivos maiores, envia link textual.
7. Atualiza status `sent` ou `failed`.

Bucket:

`chat-media`

Migration:

`supabase/migrations/20260203120000_create_chat_media_bucket.sql`

Configuracao relevante:

- public bucket;
- limite de 100 MB;
- MIME types de imagem, audio, video e documentos;
- authenticated upload/update/delete;
- public read.

Ponto de atencao: ha comentario antigo citando 15 MB, mas a constante atual do fluxo trabalha com 100 MB.

## Audio

Arquivo: `src/hooks/use-audio-recorder.ts`

Prioridade de MIME type:

1. `audio/ogg;codecs=opus`;
2. `audio/ogg`;
3. `audio/mp4`;
4. `audio/mpeg`;
5. `audio/webm;codecs=opus`;
6. `audio/webm`.

Regras implementadas:

- cleanup do `useEffect` apenas no unmount;
- `requestData()` antes de `stop()`;
- validacao de `blob.size > 0`;
- parada de tracks do stream;
- URL de preview revogada no cleanup.

Isso segue a regra do projeto de evitar WebM como formato prioritario para WhatsApp.

## Mensagens rapidas

`ChatInput` integra o modulo Mensagens Rapidas:

- digitar `/` abre `QuickReplies`;
- as mensagens vem de `useMensagensPadrao()`;
- selecionar uma resposta injeta o conteudo no input;
- variaveis como `{nome}` dependem do processamento do consumidor.

Ver tambem `.context/modules/mensagens-rapidas/README.md`.

## Criacao de conversa

Arquivos:

- `src/components/chat/new-conversation-modal.tsx`;
- `src/hooks/use-create-conversation.ts`.

Fluxo para novo numero:

1. Usuario informa telefone.
2. Hook chama Edge Function `zapi-check-number`.
3. Usa `zapId`/`formattedPhone` retornado pela Z-API.
4. Procura cliente existente por telefone exato ou sufixo.
5. Procura conversa existente pelo telefone normalizado.
6. Se existir conversa, atualiza cliente/nome/responsavel quando necessario.
7. Se nao existir, cria conversa nova.

Regra critica: novas conversas outbound devem sempre usar `zapi-check-number` e salvar o `zapId` retornado. Nao salvar apenas `phone.replace(/\D/g, '')`.

## Integracoes Z-API

### `/api/zapi-send`

Arquivo: `src/app/api/zapi-send/route.ts`

Caracteristicas:

- rota Next.js;
- autentica por cookie Supabase;
- le variaveis de ambiente da Z-API;
- suporta `text`, `image`, `audio`, `video` e `document`;
- grupos recebem sufixo `-group`;
- retorna `messageId`/`zapiMessageId`.

### Edge Function `zapi-send`

Arquivo: `supabase/functions/zapi-send/index.ts`

Caracteristicas:

- usa `_shared/cors.ts`;
- usa `_shared/auth.ts`;
- valida usuario com `requireAuth(req)`;
- suporta texto e midia;
- timeout especifico para midia;
- deve ser deployada com `--no-verify-jwt`, porque a validacao acontece dentro do codigo.

### Edge Function `zapi-check-number`

Arquivo: `supabase/functions/zapi-check-number/index.ts`

Caracteristicas:

- usa `_shared/cors.ts`;
- usa `_shared/auth.ts`;
- chama endpoint `phone-exists`;
- retorna `exists`, `inputPhone`, `formattedPhone` e `zapId`.

### Edge Function `zapi-webhook`

Arquivo: `supabase/functions/zapi-webhook/index.ts`

Responsabilidades:

- receber mensagens de cliente;
- processar status de entrega;
- processar midia recebida e salvar no bucket;
- criar ou localizar conversa;
- deduplicar por `message_id` e janela de corrida;
- atualizar `last_message`, `unread_count`, `has_new_messages`;
- reabrir/retirar de arquivo em mensagens do cliente;
- manter compatibilidade com `chat_lid` e busca por sufixo.

Ponto de atencao: webhooks sao publicos por natureza, mas qualquer alteracao deve revisar autenticidade/segredo da origem se isso for exigido pelo ambiente.

## Realtime

| Hook                       | Canal principal | Responsabilidade                                          |
| -------------------------- | --------------- | --------------------------------------------------------- |
| `useRealtimeMessages`      | `messages`      | Inserir/atualizar mensagens no cache e ajustar contadores |
| `useRealtimeConversations` | `conversations` | Inserir/atualizar/remover conversas e reordenar lista     |

Ambos fazem atualizacao cirurgica em caches do React Query para evitar refetch completo.

## Banco de dados

Tabelas centrais:

- `conversations`;
- `messages`;
- `clientes_cadastro`;
- `conversation_tags`;
- `tags`;
- `profiles`;
- `contacts`;
- storage bucket `chat-media`.

Migrations relevantes:

| Migration                                          | Papel                                              |
| -------------------------------------------------- | -------------------------------------------------- |
| `20260203120000_create_chat_media_bucket.sql`      | Bucket de midia do Chat                            |
| `20260203140000_fix_conversations_profiles_fk.sql` | FK de `assigned_to` para `profiles`                |
| `20260203203000_add_conversations_cliente_id.sql`  | `conversations.cliente_id` e backfill              |
| `20260204110000_add_last_customer_message_at.sql`  | Campos/trigger para ultima mensagem do cliente     |
| `20260206190000_unarchive_on_customer_message.sql` | Reabre/desarquiva conversa quando cliente responde |

## Pontos de atencao

- Normalizacao de telefone e ponto sensivel. Outbound deve usar `zapId`; webhook deve evitar criar conversas duplicadas por variacao do nono digito.
- Alteracoes em `conversations.last_customer_message_at`, `last_agent_message_at` ou `marked_as_responded_at` afetam Chat, Dashboard e Clientes.
- A Edge Function `zapi-send` usa auth interna; deploy sem `--no-verify-jwt` pode gerar 401 antes do codigo rodar.
- Midia grande pode cair no fallback de link, nao envio binario.
- Realtime altera caches diretamente; mudar formato de mensagem/conversa exige revisar esses hooks.
- Grupos usam `group_id` e sufixo `-group`; nao tratar como telefone individual.

## Checklist de validacao

- Abrir `/chat` e selecionar conversa.
- Filtrar por busca, nao lidas, arquivadas, grupo/individual e sem resposta.
- Enviar texto e confirmar status `sent`.
- Enviar imagem/documento/audio e confirmar recebimento no WhatsApp.
- Gravar audio e confirmar que chega como audio, nao documento.
- Criar conversa nova com `zapi-check-number`.
- Receber mensagem via webhook e confirmar que aparece na mesma conversa.
- Testar conversa de grupo.
- Confirmar realtime com duas sessoes abertas.
- Validar rotas vindas do Dashboard: `/chat?filter=sem_resposta`.
