# Modulo Monitoramento, Alertas e Insatisfacao

Documentacao seletiva criada a partir dos modulos legados, mantendo apenas regras de negocio e contratos Supabase.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/notificacoes/README.md`
- `.context/modules_old/modules/relatorio-insatisfeito/README.md`
- `.context/modules_old/modules/chat/README.md`

## Regras de negocio preservadas

- Alarmes sao persistentes e atravessam telas; nao confundir com toasts efemeros.
- Usuario alvo ve alarmes recebidos; criador ve alarmes criados.
- Alarme pendente futuro fica agendado; vencido exige reconhecimento (`acknowledged_at`).
- Criador pode editar/cancelar enquanto nao foi reconhecido/cancelado.
- `system_notifications` sao notificacoes persistidas do sistema, usadas principalmente por Celebridade.
- `Insatisfeito` representa reclamacao/critica real; ajuste comum deve ser classificado como `Normal`.
- Historico de insatisfacao e baseado em eventos `added`/`removed` e `source` (`ai` ou `manual`).
- Relatorio historico de insatisfacao e diferente de contagem diaria por estado atual da conversa.

## Supabase, Edge Functions e dados

| Recurso | Papel |
| ------- | ----- |
| `alarms` | Alarmes agendados, recebidos, criados, reconhecidos e cancelados |
| `system_notifications` | Notificacoes persistidas por usuario |
| `conversation_tag_history` | Historico de insatisfacao IA/manual |
| `conversation_ai_analyses` | Analises usadas como fallback de resumo |
| `conversations` | Estado atual de classificacao IA |
| `analyze-conversation` | Edge Function que classifica conversa e registra historico |
| `daily-report-whatsapp` | Conta conversas atualmente insatisfeitas |

## RLS e permissoes

- `alarms`: alvo pode ler/reconhecer; criador pode ver/editar/cancelar conforme status.
- `system_notifications`: deve expor apenas notificacoes do `target_user_id`.
- `conversation_tag_history`: leitura para admin/supervisor; insercao manual para usuario ativo; exclusao manual para admin/supervisor.
- Eventos de IA devem usar service role ou caminho autorizado; usuario comum nao deve inserir `source = 'ai'`.

## Lacunas de validacao

- Confirmar se `system_notifications` possui RLS suficiente; legado apontava lacuna.
- Validar se alarmes usam realtime ou polling no codigo atual.
- Confirmar se registro manual de insatisfacao sincroniza ou nao `conversations.ai_classification`.
