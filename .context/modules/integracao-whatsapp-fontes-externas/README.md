# Modulo Integracao com WhatsApp e Fontes Externas

Documentacao seletiva criada a partir dos modulos legados, mantendo apenas regras de negocio e contratos Supabase.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/chat/README.md`
- `.context/modules_old/modules/painel-admin/README.md`
- `.context/modules_old/modules/clientes/README.md`

## Regras de negocio preservadas

- Envio de WhatsApp deve usar identificador correto da Z-API (`zapId`/telefone formatado), especialmente para outbound.
- Grupos exigem sufixo/tratamento especifico e nao entram em algumas metricas administrativas.
- Webhook Z-API e fonte de verdade para mensagens recebidas, status e atualizacao de conversa.
- Integracao com cliente deve procurar cliente por telefone exato ou sufixo quando cria conversa.
- Configuracao WhatsApp administrativa precisa refletir status real da conexao.

## Supabase, Edge Functions e dados

| Recurso | Papel |
| ------- | ----- |
| `zapi-send` | Envio autenticado de texto/midia |
| `zapi-check-number` | Validacao de numero antes de criar conversa outbound |
| `zapi-webhook` | Recebimento de mensagens/status |
| `zapi-connection-status` | Status de conexao no painel admin |
| `zapi-qr-code` | QR Code de conexao |
| `zapi-status` | Status legado/complementar |
| `conversations` | Conversas sincronizadas com WhatsApp |
| `messages` | Mensagens enviadas/recebidas |

## RLS e seguranca

- Webhooks externos devem validar segredo/origem antes de gravar dados.
- Funcoes com service role devem limitar payload e atualizar apenas tabelas esperadas.
- Variaveis Z-API nao podem ser expostas ao client.

## Lacunas de validacao

- Confirmar nomes e variaveis atuais das Edge Functions Z-API.
- Validar se QR Code aceita data URL, URL HTTP e base64 puro como no legado.
- Confirmar se grupos continuam excluidos das metricas principais.
