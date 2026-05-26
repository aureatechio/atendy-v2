# Relatório de Schema — Supabase `producaoAceleraiAurea`

> **Projeto Supabase:** `cfgeilnppnlyhwnabkox`
> **Schema analisado:** `public`
> **Data da análise:** 2026-05-26
> **Fonte:** MCP Supabase (`list_tables`, `execute_sql`, `list_edge_functions`, `list_extensions`, `get_advisors`)

---

## Sumário Executivo

| Item | Quantidade |
|------|-----------:|
| **Tabelas** (schema `public`) | **66** |
| **Views** | 10 |
| **Functions/RPCs** (não-internas) | ~50 (excl. funções `pg_trgm`/C) |
| **Enums customizados** | 11 |
| **Triggers ativos** | 43 |
| **Foreign Keys** | 117 |
| **RLS Policies** | 137 |
| **Jobs `pg_cron`** | 1 |
| **Edge Functions** | 58 |
| **Extensions ativas** | 6 (`pgcrypto`, `pg_stat_statements`, `pg_trgm`, `pg_net`, `pg_cron`, `uuid-ossp`, `supabase_vault`, `plpgsql`) |
| **Findings de Security Advisor** | 145 (6 ERROR, 138 WARN, 1 INFO) |
| **Findings de Performance Advisor** | 168 (91 WARN, 77 INFO) |

A base tem 4 domínios principais bem definidos:

1. **CRM Operacional** — `clientes_cadastro` (legado denormalizado, 63 colunas, 876 linhas) é o hub central; migrando para o par normalizado `clients` + `purchases`.
2. **Atendimento (WhatsApp)** — `conversations` → `messages` com classificação/sumarização por IA (`conversation_ai_analyses`, `ai_classification_logs`).
3. **Produção** — `production_tasks` + `task_history` + `kanban_pecas` + `task_pecas` formam o motor da esteira criativa, com aprovação de celebridade (`celebrity_approvals`).
4. **Onboarding & IA Generativa** — Fluxo de 8 etapas (`onboarding_links`, `onboarding_progress`, `onboarding_identity`, `onboarding_briefings`, `onboarding_enrichment_jobs`) culminando em geração de criativos (`ai_campaign_jobs` → `ai_campaign_assets`).

---

## 1. Tabelas (66)

### 1.1 CRM Operacional

| Tabela | Linhas | Descrição |
|---|---:|---|
| `clientes_cadastro` | **876** | Hub central do CRM (63 colunas). Agrupa dados comerciais, branding, produção e onboarding. **Em migração** para `clients` + `purchases`. |
| `clients` | 19 | Entidade normalizada de cliente. Liga ao legado via `legacy_cliente_id`. |
| `purchases` | 16 | Compra/contrato/campanha (55 colunas) — proposta, ClickSign, upsell, MGS, vendedor, checkout. |
| `client_pipeline_stages` | 32 | Etapas configuráveis do funil (Kanban). Suporta hierarquia (`parent_stage_id`) e SLA. |
| `client_stage_history` | 1.761 | Timeline de movimentações entre etapas e mudanças de responsável. |
| `client_stage_history_cleanup_backup` | 833 | Backup de linhas removidas em limpezas operacionais. **RLS sem policy.** |
| `client_comments` | 2.298 | Comentários internos da equipe sobre o cliente, com anexos. |
| `client_meetings` | 9 | Reuniões/calls agendadas com clientes. |
| `client_phones` | 810 | Múltiplos telefones por cliente (1 primário + N rotulados). |
| `client_adjustments` | 2.959 | Pedidos de ajuste/refação. |
| `client_productions` | 0 | Granularidade alternativa a `production_tasks` (provavelmente legado). |
| `segmentos` / `subsegmentos` / `negocios` | 64 / 344 / 359 | Catálogo de segmentação (3 níveis). |

### 1.2 Atendimento (WhatsApp)

| Tabela | Linhas | Descrição |
|---|---:|---|
| `conversations` | 297 | Núcleo do atendimento — uma conversa por contato/telefone. Suporta grupos. Classificação/sumarização por IA. |
| `messages` | **7.968** | Cada mensagem (texto, mídia, sticker, location, contato). |
| `conversation_ai_analyses` | 776 | Histórico completo de análises de IA sobre conversas. |
| `ai_classification_logs` | 15 | Log de overrides manuais de classificação. |
| `conversation_notes` | 4 | Notas internas vinculadas a uma conversa. |
| `note_history` | 0 | Versões/edições históricas. |
| `note_reactions` | 0 | Reações emoji a notas. |
| `note_acknowledgments` | 5 | Confirmação de leitura/ciência. |
| `tags` | 6 | Catálogo de etiquetas (manuais/AI-only). |
| `conversation_tags` | 2 | Junção N-N conversas↔tags. |
| `conversation_tag_history` | 70 | Auditoria de aplicação/remoção. |
| `message_reactions` | 193 | Reações emoji a mensagens. |
| `mensagens_padrao` | 4 | Respostas rápidas (`/atalho`) com placeholder `{nome}`. |
| `message_templates` | 1 | Templates categorizados (`{{nome}}`). |
| `contacts` | 3.534 | Catálogo simples (telefone + nome). |

### 1.3 Produção (Kanban / Tasks / Celebridade)

| Tabela | Linhas | Descrição |
|---|---:|---|
| `production_tasks` | **2.679** | Tarefas/cards do Kanban de produção. Suporta hierarquia parent/subtask e vínculo a `pipeline_stage`. |
| `task_history` | **40.194** | Audit log granular (timeline) das tasks. |
| `task_checklist_items` | 91 | Checklist dentro de uma task. |
| `task_comments` | 0 | Comentários em tasks com menções/anexos. |
| `task_scripts` | 3.211 | Roteiros (textos/links Google Docs) vinculados a task ou peça. |
| `task_time_entries` | 3.699 | Apontamentos de tempo (start/pause). `duration_seconds` é coluna gerada. |
| `task_pecas` | 5.466 | Junção tasks↔peças do Kanban. |
| `task_step_reminders` | 0 | Lembretes automáticos por step. |
| `kanban_pecas` | **10.181** | Peças individuais (arte/vídeo) do Kanban de produção. |
| `celebrity_approvals` | 2.967 | Fluxo de aprovação de peças pela celebridade (registro corrente por peça). |
| `celebrity_approval_history` | 350 | Arquivo de ciclos anteriores (resubmissões pós-rejeição). |
| `celebridadesReferencia` | 229 | Catálogo de celebridades (fotos, nível, agrupamento, seguidores). |
| `celebridade_frases` | 0 | Banco de frases gravadas extraídas de PDFs CELEB. |

### 1.4 Onboarding & IA Generativa

| Tabela | Linhas | Descrição |
|---|---:|---|
| `onboarding_links` | 2 | Links públicos revogáveis (token hash). |
| `onboarding_progress` | 1 | Estado da jornada (passo 1-8, respostas). |
| `onboarding_acceptances` | 1 | Aceites item-por-item (`item_hash` para auditoria). |
| `onboarding_identity` | 0 | Identidade visual: logo, paleta, fonte, brand name. |
| `onboarding_identity_submissions` | 0 | Snapshots imutáveis (jsonb). |
| `onboarding_logo_history` | 0 | Histórico de uploads de logo. |
| `onboarding_briefings` | 0 | Briefing gerado por IA (Perplexity). |
| `onboarding_enrichment_jobs` | 0 | Orquestrador de enrichment (cores, fonte, briefing, campanha). |
| `onboarding_copy` | 1 | **Singleton** com a copy viva. `id bool DEFAULT true CHECK (id)`. |
| `onboarding_copy_versions` | 0 | Histórico versionado. |
| `ai_campaign_jobs` | 0 | Job orquestrador de geração de criativos (com snapshot de prompt). |
| `ai_campaign_assets` | 0 | Assets gerados (imagens). |
| `ai_campaign_errors` | 0 | Log estruturado de erros. |
| `perplexity_config` / `nanobanana_config` / `enrichment_config` | 1 cada | **Singletons** de configuração. |

### 1.5 Infraestrutura / Auditoria

| Tabela | Linhas | Descrição |
|---|---:|---|
| `profiles` | 66 | Perfil estendido do usuário (espelha `auth.users`). |
| `system_notifications` | **33.611** | Notificações in-app. |
| `alarms` | 4 | Alarmes/lembretes entre usuários. |
| `activity_log` | 6.625 | Log genérico de ações (auditoria global). |
| `sla_alerts` | 1.735 | Alertas de SLA. |
| `business_holidays` | 26 | Feriados (cálculo de SLA). |
| `meeting_contact_logs` | 1 | Histórico de contatos em agendamentos. |
| `landing_leads` | 0 | Leads externos. |

---

## 2. Relacionamentos (Foreign Keys)

São **117 FKs** no schema `public`. Os hubs com mais referências entrantes:

| Tabela referenciada | FKs entrantes (aprox.) | Papel |
|---|---:|---|
| `clientes_cadastro` | **22** | Hub absoluto do CRM. |
| `profiles` | **30+** | Quem fez/é responsável por quase tudo (audit/assigned). |
| `production_tasks` | **10** | Hub da produção (checklist, scripts, comments, pecas, history, time, sla, celebrity, adjustments). |
| `purchases` | **8** | Hub do onboarding (todas as tabelas `onboarding_*` e `ai_campaign_*` referenciam). |
| `client_pipeline_stages` | **7** | Hub do funil. |
| `kanban_pecas` | **4** | task_pecas, celebrity_approvals, celebrity_approval_history, task_scripts. |
| `conversations` | **6** | messages, notes, AI analyses, tags, tag_history, reactions. |

### 2.1 Diagrama lógico (núcleos)

```
clientes_cadastro ──┬─< client_phones / client_meetings / client_comments / client_adjustments
                    ├─< client_stage_history (with from/to profiles)
                    ├─< production_tasks ──┬─< task_checklist_items
                    │                      ├─< task_comments
                    │                      ├─< task_scripts ──> kanban_pecas
                    │                      ├─< task_time_entries
                    │                      ├─< task_history (with from/to profiles + stage)
                    │                      ├─< task_pecas >── kanban_pecas
                    │                      └─< sla_alerts
                    ├─< kanban_pecas ──< celebrity_approvals ──< celebrity_approval_history
                    ├─< conversations ──< messages
                    │                  └─< conversation_ai_analyses / tags / notes / tag_history
                    ├─< client_productions (legado)
                    ├─> client_pipeline_stages (current_stage_id)
                    ├─> profiles (assigned_to, responsavel_atendimento)
                    └─> segmentos / subsegmentos / negocios

clientes_cadastro <─── clients (legacy_cliente_id) ───< purchases
                                                       │
purchases ──< onboarding_links / onboarding_progress / onboarding_acceptances
          ├─< onboarding_identity / onboarding_identity_submissions / onboarding_logo_history
          ├─< onboarding_briefings / onboarding_enrichment_jobs
          ├─< ai_campaign_jobs ──< ai_campaign_assets
          │                    └─< ai_campaign_errors
```

### 2.2 FKs de auto-referência

- `production_tasks.parent_task_id → production_tasks.id` — hierarquia task/subtask.
- `client_pipeline_stages.parent_stage_id → client_pipeline_stages.id` — sub-etapas.

---

## 3. Views (10)

| View | Propósito |
|---|---|
| `clients_with_stage` | Clientes ativos enriquecidos com stage *efetivo* (deriva do task ativo + fallback para `current_stage_id`), `days_in_stage`, dados do responsável. **Centro do dashboard CRM.** |
| `pipeline_stage_counts` | Contagem de clientes e somatório de `deal_value` por estágio (Kanban summary). |
| `cliente_last_interaction` | UNION de eventos (comments, stage_history, meetings, adjustments, tasks) com `max(at)` por cliente. |
| `production_tasks_with_subtasks` | Tasks denormalizadas com cliente, stage, assignee + contagem de subtasks. |
| `v_admin_relatorio_clientes` | View "monstro" para relatório admin: agrega peças/tarefas/ajustes/compras via lateral joins. |
| `v_clientes_lista_base` | Base de listagem de clientes com stage/responsável. |
| `v_producao_task_cards` | Cards de produção com JSON pré-montado (cliente/stage/assignee), peças preview, flags `has_rejected_pecas`, `has_aguardando_pecas`, `has_troca_solicitada`. |
| `v_dashboard_daily_metrics` | Conversas por dia (últimos 30 dias). |
| `v_attendants_ranking` | Ranking de atendentes por # de conversas. |
| `v_relatorio_tempo_medio` *(via função)* | Tempo médio por etapa do funil. |

> ⚠️ **Atenção:** 6 views estão marcadas como `security_definer_view` pelo advisor (`pipeline_stage_counts`, `clients_with_stage`, etc.) — executam com permissões do dono, bypassando RLS do chamador.

---

## 4. Functions / RPCs (50+)

### 4.1 RPCs de leitura otimizada (chamadas pelo frontend)

| Função | Argumentos | Retorno | SECURITY |
|---|---|---|---|
| `get_clientes_lista_page` | search, archived, paginação, **muitos filtros** (stages, classificacoes, etiquetas, responsaveis, prazo, vigencia, segmento) + sort | `jsonb` | INVOKER |
| `get_clientes_metrics` | `p_show_archived` | `jsonb` | INVOKER |
| `get_clientes_celebridades_filter` | `p_show_archived` | `text[]` | INVOKER |
| `get_clientes_optimized` | search, stage, segmento, assigned_to, classificacao, paginação | `json` | **DEFINER** |
| `get_conversations_optimized` | status, assigned_to, search, archived, has_unread, tag_ids, paginação | `json` | **DEFINER** |
| `get_messages_paginated` | conversation_id, limit, before_id | `json` | **DEFINER** |
| `get_production_tasks_optimized` | status, assigned_to, cliente_id, is_urgent, paginação | `json` | **DEFINER** |
| `get_producao_board` | filtros + `p_stage_limit` | `jsonb` | INVOKER |
| `get_producao_stage_tasks` | stage_id + filtros + paginação | `jsonb` | INVOKER |
| `get_production_dashboard_metrics` | date range | `jsonb` | INVOKER |
| `get_relatorio_clientes_page` | **24 parâmetros** de filtro/sort | `jsonb` | **DEFINER** (2 overloads) |
| `get_relatorio_tempo_medio` | paginação, search, stage_slug, assigned_to | TABLE(...) | **DEFINER** |
| `get_dashboard_metrics` | — | `json` | **DEFINER** |
| `get_dashboard_overview_metrics` | — | `jsonb` | INVOKER |
| `get_celebrity_board_data` | `p_concluido_limit` | `jsonb` | **DEFINER** |
| `get_onboarding_run_detail` | `p_purchase_id` | `jsonb` | **DEFINER** |
| `list_onboarding_runs` | search, status, paginação | TABLE | **DEFINER** |
| `search_onboarding_client_candidates` | search, limit | TABLE | **DEFINER** |
| `get_team_members_with_email` | — | TABLE | **DEFINER** |
| `get_presence_metrics_today` | — | TABLE(users_today, sessions_today) | **DEFINER** |

### 4.2 Helpers de autorização (chamadas em RLS policies)

| Função | Retorno | SECURITY |
|---|---|---|
| `is_active_user()` | bool | **DEFINER** |
| `is_admin()` | bool | **DEFINER** |
| `is_admin_or_supervisor()` | bool | **DEFINER** |
| `get_user_role(uuid)` | text | **DEFINER** |
| `get_user_status(uuid)` | text | **DEFINER** |

### 4.3 Funções utilitárias / mutações

| Função | Propósito |
|---|---|
| `ensure_purchase_for_cliente(uuid)` | Garante registro em `purchases` para um cliente (DEFINER — **executável por anon/authenticated**, ver advisors). |
| `calc_sla_deadline(entered_at, sla_amount, sla_unit)` | Cálculo de deadline de SLA. |
| `increment_unread_count(uuid)` / `reset_unread_count(uuid)` | Manipulação de contador de mensagens não lidas. |

### 4.4 Trigger functions (43 triggers ativos)

| Função | Tabela(s) afetadas |
|---|---|
| `auto_generate_client_code()` | clientes_cadastro (BEFORE INSERT) |
| `set_default_client_stage()` | clientes_cadastro (BEFORE INSERT) |
| `log_client_created()` / `log_client_stage_change()` | clientes_cadastro |
| `prevent_return_to_mais_novo()` | clientes_cadastro (impede regressão de etapa) |
| `update_clientes_cadastro_updated_at()` | clientes_cadastro |
| `sync_whatsapp_to_client_phones()` | clientes_cadastro → client_phones |
| `sync_primary_phone_to_client()` / `sync_phone_delete_to_client()` | client_phones → clientes_cadastro |
| `record_task_history()` | production_tasks (DEFINER, AFTER INS/UPD) |
| `set_task_initial_timestamps()` / `update_task_timestamps()` | production_tasks |
| `update_client_stage_from_task()` | production_tasks (AFTER INS/UPD) → atualiza stage do cliente |
| `fn_finalize_linked_pecas()` | production_tasks (AFTER UPDATE) |
| `update_conversation_on_message()` | messages (AFTER INSERT) — atualiza last_message |
| `create_onboarding_task_on_active()` | conversations (AFTER UPDATE) |
| `fn_set_meeting_contacted_at()` | meeting_contact_logs (AFTER INSERT) |
| `handle_new_user()` | auth.users → cria profile (DEFINER) |
| `update_updated_at_column()` | múltiplas tabelas (BEFORE UPDATE) |

---

## 5. Enums (11)

| Enum | Valores |
|---|---|
| `user_role` | `admin, supervisor, attendant, producao, cs_head, dev, designer` |
| `user_specialty` | `roteirista, video, design, audio, celebridade, atendimento, gestor, aprovacao_celebridade, video_kv, customer_success` |
| `user_status` | `pending, active, blocked, inativo` |
| `task_status` | `a_fazer, fazendo, concluido, cancelado` |
| `task_priority` | `baixa, media, alta, critica` |
| `task_history_action` | 18 valores: `created, stage_change, status_change, assignment_change, priority_change, deadline_change, title_change, description_change, script_added/updated/removed, subtask_added/removed, checklist_added/completed, adjustment_added/completed, comment_added` |
| `kanban_status` | `a_fazer, fazendo, feitas` |
| `peca_tipo` | `imagem, video` |
| `script_status` | `rascunho, em_revisao, aprovado, em_uso, produzindo, em_aprovacao` |
| `message_template_type` | `boas_vindas, lembrete, atualizacao, finalizacao, cobranca, outro` |
| `note_reaction_type` | `heart, thumbsup, clap, angry, sad` |

---

## 6. RLS Policies (137)

### 6.1 Padrões observados

- **Liberal-por-padrão (`true`)**: a maioria das tabelas concede SELECT/INSERT/UPDATE/DELETE para qualquer `authenticated` sem filtro adicional (ex.: `conversations`, `messages`, `kanban_pecas`, `tasks`, `production_tasks` exceto UPDATE/DELETE).
- **Helper-based** (mais recente/recomendado): `is_active_user()`, `is_admin()`, `is_admin_or_supervisor()`. Usado nas tabelas novas: `clients`, `purchases`, `ai_campaign_*`, `onboarding_*`.
- **Ownership-based**: `client_comments`, `task_comments`, `alarms`, `task_step_reminders`, `system_notifications` — author/target_user/created_by.
- **`{public}` role**: várias policies legadas estão concedendo a `public` (anon + authenticated) em vez de só `authenticated`.

### 6.2 Itens críticos identificados

1. **`clientes_cadastro`**: TODAS as policies estão liberadas para o role `public` com `using_expression='true'` — qualquer chave anon pode ler/escrever. ⚠️ **(SELECT, INSERT, UPDATE, DELETE)**
2. **`client_pipeline_stages`**: SELECT liberado para `public`.
3. **`celebridade_frases`** e **`celebridadesReferencia`**: SELECT para `anon`.
4. **`landing_leads`**: INSERT permitido para `anon` (esperado p/ landing).
5. **`client_stage_history_cleanup_backup`**: RLS habilitado mas **sem nenhuma policy** — efetivamente inacessível, mas o advisor o sinaliza.

---

## 7. Jobs `pg_cron`

| jobid | nome | schedule | comando | ativo |
|------:|------|----------|---------|------:|
| 1 | `ai-analysis-cron-job` | `*/5 * * * *` | `net.http_post → ai-analysis-cron` Edge Function | ✅ |

> ⚠️ **Risco crítico**: o `Authorization: Bearer <SERVICE_ROLE_KEY>` está embedded em texto puro no comando do cron. Mover para `vault.secrets`.

---

## 8. Edge Functions (58 ativas)

Agrupadas por domínio:

### 8.1 Z-API (WhatsApp legado) — 14 funções
`zapi-webhook`, `zapi-send`, `zapi-status`, `zapi-qr-code`, `zapi-check-number`, `zapi-sync`, `zapi-sync-history`, `zapi-connection-status`, `zapi-get-profile-picture`, `zapi-create-group`, `zapi-group-metadata`, `zapi-send-reaction`, `zapi-read-chat`, `zapi-update-auto-read`, `zapi-list-users`

### 8.2 UAZ-API (migração WhatsApp) — 13 funções
Espelham as anteriores: `uazapi-webhook`, `uazapi-send`, `uazapi-status`, `uazapi-qr-code`, `uazapi-check-number`, `uazapi-sync`, `uazapi-sync-history`, `uazapi-connection-status`, `uazapi-get-profile-picture`, `uazapi-create-group`, `uazapi-group-metadata`, `uazapi-send-reaction`, `uazapi-read-chat`, `uazapi-list-users`

### 8.3 IA & Análise — 4 funções
`analyze-conversation`, `ai-analysis-cron`, `get-dashboard-metrics`, `daily-report-whatsapp`

### 8.4 Onboarding — 11 funções
`onboarding-search-clients`, `onboarding-create-link`, `onboarding-list`, `get-onboarding-data`, `save-onboarding-progress`, `save-onboarding-identity`, `get-onboarding-copy`, `update-onboarding-copy`, `onboarding-enrichment`, `cadastrar-cliente`

### 8.5 IA Generativa (Campanhas) — 6 funções
`generate-campaign-briefing`, `create-ai-campaign-job`, `generate-ai-campaign-image`, `get-ai-campaign-status`, `get-ai-campaign-monitor`, `retry-ai-campaign-assets`

### 8.6 Configurações & Utilitários — 10 funções
`get-perplexity-config`, `update-perplexity-config`, `get-nanobanana-config`, `update-nanobanana-config`, `read-nanobanana-reference`, `get-enrichment-config`, `update-enrichment-config`, `get-enrichment-status`, `storage-upload`, `add-watermark`, `drive-callback`, `manage-adjustments`

> ⚠️ A grande maioria das funções tem `verify_jwt: false` — incluindo webhooks (esperado) mas também várias funções de onboarding/IA que provavelmente deveriam exigir JWT.

---

## 9. Extensões instaladas

| Extension | Schema | Versão | Uso |
|---|---|---|---|
| `pgcrypto` | extensions | 1.3 | Hash/UUID. |
| `uuid-ossp` | extensions | 1.1 | `uuid_generate_v4()`. |
| `pg_stat_statements` | extensions | 1.11 | Profiling de queries. |
| `pg_trgm` | **public** ⚠️ | 1.6 | Busca por similaridade (search bars). |
| `pg_net` | **public** | 0.19.5 | HTTP async usado pelo cron. |
| `pg_cron` | pg_catalog | 1.6.4 | Job scheduler. |
| `supabase_vault` | vault | 0.3.1 | Secrets. |
| `plpgsql` | pg_catalog | 1.0 | (default) |

> ⚠️ `pg_trgm` está no schema `public` — advisor recomenda mover.

---

## 10. Findings dos Advisors

### 10.1 Security (145 issues)

| Nível | Tipo | Qtd | Resumo |
|---|---|---:|---|
| **ERROR** | `security_definer_view` | **6** | Views com SECURITY DEFINER bypassando RLS do chamador. |
| WARN | `rls_policy_always_true` | **52** | Policies com `USING true` — sem filtro real (ex.: `clientes_cadastro`, `conversations`, `messages`, `production_tasks`, `kanban_pecas`). |
| WARN | `function_search_path_mutable` | 28 | Funções sem `SET search_path` fixado (vulnerável a hijack). |
| WARN | `anon_security_definer_function_executable` | 26 | Funções DEFINER executáveis pelo role `anon`. |
| WARN | `authenticated_security_definer_function_executable` | 26 | Mesmas para `authenticated`. |
| WARN | `public_bucket_allows_listing` | 3 | Buckets públicos (ex.: `chat-media`) permitem listagem. |
| WARN | `extension_in_public` | 2 | `pg_trgm` e `pg_net` no schema `public`. |
| WARN | `auth_leaked_password_protection` | 1 | HIBP disabled — habilitar no Auth. |
| INFO | `rls_enabled_no_policy` | 1 | `client_stage_history_cleanup_backup`. |

### 10.2 Performance (168 issues)

| Nível | Tipo | Qtd | Resumo |
|---|---|---:|---|
| WARN | `multiple_permissive_policies` | **63** | Múltiplas policies permissivas avaliadas a cada query. |
| WARN | `auth_rls_initplan` | 26 | RLS re-avalia `auth.uid()` por linha — envolver em `(SELECT auth.uid())`. |
| INFO | `unused_index` | 44 | Índices nunca usados (candidatos a remoção). |
| INFO | `unindexed_foreign_keys` | 32 | FKs sem índice de cobertura. |
| WARN | `duplicate_index` | 2 | `kanban_pecas`: `idx_kanban_pecas_client_status_order` e `idx_kanban_pecas_ordem` redundantes. |
| INFO | `auth_db_connections_absolute` | 1 | Auth server limitado a 10 conexões absolutas. |

---

## 11. Observações & Riscos Estratégicos

### 11.1 Pontos Fortes

- ✅ **Modelo de produção rico**: hierarquia task/subtask, time tracking, history granular (40k+ linhas), SLA configurável por stage.
- ✅ **Auditoria forte** em mudanças de cliente (`client_stage_history`), task (`task_history`), tags (`conversation_tag_history`), aprovações (`celebrity_approval_history`).
- ✅ **Views denormalizadas** (`v_producao_task_cards`, `v_admin_relatorio_clientes`) reduzem N+1 no frontend.
- ✅ **RPCs paginadas e parametrizadas** evitam over-fetching.
- ✅ **Onboarding event-sourced**: aceites com `item_hash`, snapshots imutáveis, log de fases — auditoria robusta.

### 11.2 Débitos Técnicos Identificados

1. **Migração dual `clientes_cadastro` → `clients`+`purchases` inacabada** (876 vs 19 vs 16 linhas). Frontend ainda lê do legado; risco de divergência.
2. **RLS muito permissivo no domínio CRM** — todas as ops em `clientes_cadastro` autorizadas para `public`. Migrar para `is_active_user()` / `is_admin_or_supervisor()`.
3. **`auth.uid()` re-avaliado por linha** em 26 policies — refator simples e ganho de performance grande.
4. **6 views SECURITY DEFINER** — revisar se realmente precisam (provavelmente devem ser INVOKER + RPC se precisarem de privilégios).
5. **`ensure_purchase_for_cliente()` exposta a `anon`** — função DEFINER pode ser usada por chave anon para criar registros.
6. **Cron com service_role token em texto puro** — mover para `vault.secrets`.
7. **44 índices não usados** — auditar antes de deletar; alguns podem ser para queries raras (relatórios mensais).
8. **32 FKs sem índice** — JOINs em `task_*`, `onboarding_*`, `ai_campaign_*` podem estar fazendo seq scan.
9. **`production_tasks` UPDATE policy permite QUALQUER attendant editar QUALQUER task** — pode não ser intencional.
10. **Tabelas legadas com 0 linhas mantidas vivas**: `client_productions`, `celebridade_frases`, `landing_leads`, várias `onboarding_*`. Confirmar se ainda planejadas ou candidatas a drop.

### 11.3 Hotspots de Crescimento

| Tabela | Linhas | Observação |
|---|---:|---|
| `task_history` | 40.194 | Cresce em audit de cada UPDATE em tasks. Considerar partition por mês. |
| `system_notifications` | 33.611 | Sem TTL/cleanup visível. |
| `kanban_pecas` | 10.181 | Hot table — tem índice duplicado a remover. |
| `messages` | 7.968 | Crescimento esperado proporcional ao volume de WhatsApp. |
| `activity_log` | 6.625 | Sem cleanup. |
| `task_pecas` | 5.466 | Tabela de junção (N-N). |

---

## 12. Recomendações Priorizadas

| Prioridade | Ação | Esforço | Impacto |
|---|---|---|---|
| 🔴 **P0** | Trocar `Authorization` do cron para `vault.secrets` (token de serviço hard-coded no `cron.job`). | Baixo | Segurança crítica. |
| 🔴 **P0** | Restringir RLS de `clientes_cadastro` (atualmente `public` + `using true`). | Médio | Segurança crítica. |
| 🟠 **P1** | Refatorar 26 RLS policies para usar `(SELECT auth.uid())` em vez de `auth.uid()`. | Baixo | Performance significativa em queries que retornam muitas linhas. |
| 🟠 **P1** | Revogar EXECUTE de `ensure_purchase_for_cliente` para `anon`. | Baixo | Segurança. |
| 🟠 **P1** | Adicionar índices nas 32 FKs sem cobertura (priorizar `task_*`, `onboarding_*`). | Médio | Performance. |
| 🟠 **P1** | Revisar 6 `security_definer_view` — converter para `security_invoker` quando possível. | Médio | Segurança (RLS). |
| 🟡 **P2** | Definir `search_path` fixo nas 28 funções flagadas. | Baixo | Segurança. |
| 🟡 **P2** | Consolidar/deduplicar 63 policies permissivas múltiplas. | Médio | Performance + clareza. |
| 🟡 **P2** | Dropar `idx_kanban_pecas_ordem` (duplicado). | Trivial | Performance write. |
| 🟡 **P2** | Mover `pg_trgm` e `pg_net` para schema `extensions`. | Baixo | Boas práticas. |
| 🟢 **P3** | Definir TTL/cleanup para `system_notifications` (33k linhas) e `activity_log` (6,6k). | Médio | Custo storage. |
| 🟢 **P3** | Finalizar migração `clientes_cadastro` → `clients`+`purchases`. | Alto | Arquitetura. |
| 🟢 **P3** | Avaliar partition de `task_history` por mês. | Médio | Escalabilidade futura. |
| 🟢 **P3** | Habilitar `auth_leaked_password_protection`. | Trivial | Segurança baixo risco. |

---

## 13. Apêndices

### A. Como reproduzir o relatório

```bash
# Tabelas com colunas (verbose)
mcp__supabase__list_tables(project_id="cfgeilnppnlyhwnabkox", schemas=["public"], verbose=true)

# Funções
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid), p.prosecdef
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';

# Foreign keys, triggers, policies, enums, cron, advisors
# (queries no histórico desta análise)
```

### B. Project IDs relacionados

- **Atendy (este projeto):** `cfgeilnppnlyhwnabkox` (producaoAceleraiAurea)
- **CRM Aurea (relacionado):** `awqtzoefutnfmnbomujt` (AceleraAiCRM) — cruzamento via skill `aurea-atendy-crm-match`.

---

*Fim do relatório.*
