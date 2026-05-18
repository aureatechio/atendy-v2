# Modulo Database

Indice seletivo de contratos de banco herdados dos modulos legados.

Ultima atualizacao: 2026-05-18

## Descritivo completo das tabelas

- [schema-tabelas.md](schema-tabelas.md) — descritivo das 61 tabelas do schema `public` (objetivo, colunas-chave, relacionamentos), agrupadas por dominio. Levantamento via MCP Supabase em 2026-05-18.
- Os mesmos comentarios foram aplicados como `COMMENT ON TABLE/COLUMN` no banco (migrations `comments_atendimento_conversas`, `comments_crm_producao_celebridade`, `comments_onboarding_ia_plataforma` em 2026-05-18) — visiveis no Studio Supabase.

## Fontes legadas

- `.context/modules_old/modules/*/README.md`
- `.context/modules_old/modules/supabase-mcp/README.md`

## Tabelas centrais por dominio

| Dominio | Tabelas |
| ------- | ------- |
| Auth/governanca | `profiles`, `user_roles`, `activity_log` |
| CRM | `clientes_cadastro`, `client_pipeline_stages`, `segmentos`, `subsegmentos`, `negocios` |
| Chat | `conversations`, `messages`, `tags`, `conversation_tags`, `conversation_tag_history`, `conversation_ai_analyses` |
| Producao | `production_tasks`, `task_history`, `task_pecas`, `kanban_pecas`, `client_adjustments` |
| Celebridade | `celebrity_approvals`, campos de celebridade em `clientes_cadastro` |
| Notificacoes | `alarms`, `system_notifications` |
| Compras/relatorios | `purchases`, views e RPCs de relatorio |

## Views e RPCs preservadas como contratos

| Recurso | Uso |
| ------- | --- |
| `v_clientes_lista_base` | Base de listagem de clientes |
| `get_clientes_lista_page(...)` | Listagem paginada/filtros de clientes |
| `get_clientes_metrics(...)` | Cards de metricas de clientes |
| `v_producao_task_cards` | Cards do board de producao |
| `get_producao_board(...)` | Board agregado por etapa |
| `get_producao_stage_tasks(...)` | Mais tasks por etapa |
| `get_production_dashboard_metrics(...)` | Dashboard de producao |
| `get_team_members_with_email()` | Gestao de equipe |
| `get_presence_metrics_today()` | Presenca/admin |
| `get_relatorio_clientes_page(...)` | Relatorio administrativo de clientes |

## Regras de banco e RLS

- Toda tabela exposta em `public` deve ter RLS quando houver dados sensiveis.
- Views usadas por client/anon/authenticated devem ser `security_invoker = true` em Postgres 15+ ou ter grants restritos.
- Helpers `SECURITY DEFINER` devem evitar recursao em policies e nao devem expor mais do que o necessario.
- UPDATE sob RLS exige SELECT policy compativel; sem SELECT pode retornar zero linhas sem erro.
- Service role deve ficar em API/Edge/server controlado.

## Lacunas de validacao

- Este workspace nao contem todas as migrations antigas; validar schema remoto antes de implementar.
- Confirmar quais views foram criadas antes de `security_invoker` e precisam revisao.
- Rodar advisors de seguranca/performance antes de qualquer migracao.
