# Modulo Onboarding e Entrada de Novos Clientes

Documentacao seletiva criada a partir dos modulos legados, mantendo apenas regras de negocio e contratos Supabase.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/clientes/README.md`
- `.context/modules_old/modules/chat/README.md`
- `.context/modules_old/modules/producao/README.md`

## Regras de negocio preservadas

- Entrada de cliente deve criar/normalizar `clientes_cadastro`.
- Nome de cliente criado manualmente e normalizado em uppercase e `name_normalized`.
- Conversa outbound nova deve validar telefone via `zapi-check-number` antes de persistir identificador WhatsApp.
- Cliente pode entrar em pipeline por `current_stage_id` e `stage_entered_at`.
- Onboarding afeta CRM, Chat e Producao; nao deve criar dados duplicados de cliente/conversa.
- Vinculo por telefone deve considerar telefone exato e fallback por sufixo quando vier de WhatsApp.

## Supabase e dados

| Recurso | Papel |
| ------- | ----- |
| `clientes_cadastro` | Registro base do cliente |
| `conversations` | Conversa vinculada ao cliente |
| `client_pipeline_stages` | Etapa inicial do cliente |
| `production_tasks` | Tarefas criadas a partir da entrada |
| `zapi-check-number` | Validacao de numero outbound |

## RLS e seguranca

- Criacao de cliente deve ser permitida somente a usuarios autenticados/operacionais.
- Vinculo de conversa ao cliente deve respeitar RLS de `conversations` e `clientes_cadastro`.
- Se houver automacao server-side de onboarding, preferir API/Edge com validacao de usuario.

## Lacunas de validacao

- Confirmar qual etapa e considerada inicial no schema atual.
- Validar se onboarding cria task automaticamente ou apenas prepara cliente/conversa.
- Confirmar deduplicacao por telefone/WhatsApp antes de inserir novo cliente.
