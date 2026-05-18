# Modulo Atendimento Multicanal via WhatsApp

Documentacao seletiva criada a partir dos modulos legados, mantendo apenas regras de negocio e contratos Supabase.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/chat/README.md`
- `.context/modules_old/modules/mensagens-rapidas/README.md`
- `.context/modules_old/modules/notificacoes/README.md`

## Regras de negocio preservadas

- O WhatsApp operacional gira em torno de `conversations` e `messages`.
- Conversas podem ser individuais ou grupos; grupos exigem tratamento especifico no envio Z-API com sufixo `-group`.
- Conversa "sem resposta" segue a regra: ultima mensagem do cliente ha mais de 2 horas, conversa nao resolvida, nao marcada como respondida e sem resposta posterior de agente, com tolerancia de 30 minutos.
- Ao enviar mensagem de saida, o sistema cria registro local com status `sending` antes de chamar Z-API e depois atualiza para `sent` ou `failed`.
- Se uma conversa outbound nao tem `assigned_to`, o primeiro envio pode atribuir a conversa ao usuario atual.
- Novas conversas outbound devem sempre validar numero via `zapi-check-number` e persistir o `zapId` retornado; nao basta salvar apenas telefone numerico.
- Midias usam Storage e devem respeitar limite e MIME types do bucket `chat-media`.
- Audio deve priorizar formatos aceitos pelo WhatsApp, especialmente OGG/MP4/MPEG antes de WebM.

## Supabase, Edge Functions e Storage

| Recurso | Papel |
| ------- | ----- |
| `conversations` | Estado atual da conversa, responsavel, leitura, ultima mensagem e classificacao IA |
| `messages` | Historico de mensagens, status de envio, midia, notas e metadados |
| Bucket `chat-media` | Armazena imagens, audios, videos e documentos enviados pelo chat |
| `zapi-send` | Edge Function autenticada para envio de texto/midia |
| `zapi-check-number` | Edge Function que valida numero e retorna formato/ZapId correto |
| `zapi-webhook` | Edge Function que recebe mensagens, status e midias da Z-API |

## RLS e autorizacao

- Leituras e escritas dependem das policies de `conversations`, `messages` e Storage.
- Edge Functions que validam usuario internamente devem usar helper compartilhado de auth e ser deployadas com `--no-verify-jwt` quando a validacao acontece no codigo.
- Buckets com upsert precisam de `INSERT`, `SELECT` e `UPDATE`; apenas `INSERT` nao cobre substituicao de arquivo.

## Lacunas de validacao

- Confirmar no codigo atual se as Edge Functions e bucket ainda usam os mesmos nomes.
- Validar policies reais de `conversations`, `messages` e `storage.objects` antes de expor anon key.
- Confirmar se a regra de "sem resposta" continua alinhada entre Chat, Dashboard e relatorios.
