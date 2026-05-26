# Análise de Melhorias — Supabase `producaoAceleraiAurea`

> **Projeto:** `cfgeilnppnlyhwnabkox` · **Data:** 2026-05-26
> **Escopo:** Auditoria focada em pontos acionáveis (segurança, performance, modelagem, dívida técnica).
> **Complementa:** [SUPABASE_SCHEMA_REPORT.md](SUPABASE_SCHEMA_REPORT.md)

---

## TL;DR — As 10 melhorias com maior ROI

| # | Melhoria | Categoria | Esforço | Impacto |
|---|---|---|---|---|
| 1 | Mover `Authorization: Bearer <SERVICE_ROLE>` do `cron.job` para `vault.secrets` | Segurança | 30 min | 🔴 Crítico |
| 2 | Trocar RLS de `clientes_cadastro` (hoje `public + using true`) para auth-based | Segurança | 2-3h | 🔴 Crítico |
| 3 | Wrappar `auth.uid()` em `(SELECT auth.uid())` nas 26 policies sinalizadas | Performance | 2h | 🟠 Alto (queries que tocam muitas linhas) |
| 4 | Criar 32 índices em FKs não cobertas (priorizar `sla_alerts`, `onboarding_*`, `ai_campaign_*`) | Performance | 2h | 🟠 Alto |
| 5 | Revogar EXECUTE de `ensure_purchase_for_cliente` para `anon` | Segurança | 5 min | 🟠 Alto |
| 6 | Fixar `SET search_path = public, extensions` nas 28 funções SECURITY DEFINER/trigger | Segurança | 2h | 🟡 Médio |
| 7 | Converter 6 views `SECURITY DEFINER` para `security_invoker = on` | Segurança | 1h | 🟡 Médio |
| 8 | Dropar 44 índices não usados + 2 duplicados (recupera ~30% do `index_size` em algumas tabelas) | Performance | 1h | 🟡 Médio |
| 9 | Restringir 3 buckets storage públicos para impedir LIST (manter só GET por URL) | Segurança | 30 min | 🟡 Médio |
| 10 | Implementar TTL/limpeza para `system_notifications` (20 MB, 33k linhas, sem cleanup) | Storage | 2h | 🟡 Médio |

---

## 1. 🔴 Segurança — Issues Críticos

### 1.1 Credencial hard-coded no `pg_cron`

```sql
-- cron.job atual (id=1):
SELECT net.http_post(
  url := 'https://cfgeilnppnlyhwnabkox.supabase.co/functions/v1/ai-analysis-cron',
  headers := '{"Content-Type":"application/json",
               "Authorization":"Bearer eyJhbGciOi...JWlNeJaS97f03kkPzAy_Udb8DAjSQ"}'::jsonb,
  body := '{}'::jsonb
);
```

**Problema:** O JWT `service_role` com expiração em 2055 está em texto puro na configuração do cron. Qualquer um com SELECT em `cron.job` (admin/dev) vê o token.

**Fix:**
```sql
-- 1. armazenar no Vault
SELECT vault.create_secret('eyJhbGc...', 'service_role_jwt');

-- 2. atualizar o cron para ler do vault
SELECT cron.schedule(
  'ai-analysis-cron-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cfgeilnppnlyhwnabkox.supabase.co/functions/v1/ai-analysis-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='service_role_jwt')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

### 1.2 RLS "always true" em tabelas críticas (52 policies)

**`clientes_cadastro`** é o caso mais grave — TODAS as operações estão liberadas para o role `public` (que inclui `anon`):

| Tabela | Role | Comando | Policy |
|---|---|---|---|
| **`clientes_cadastro`** | `public` | SELECT | `Allow public read on clientes_cadastro` |
| **`clientes_cadastro`** | `public` | INSERT | `Allow public insert on clientes_cadastro` |
| **`clientes_cadastro`** | `public` | UPDATE | `Allow public update on clientes_cadastro` |
| **`clientes_cadastro`** | `public` | DELETE | `Allow authenticated delete on clientes_cadastro` |

Significa que **a chave `anon` pode ler, criar, editar e deletar qualquer cliente**. Em conjunto com a função `ensure_purchase_for_cliente` (DEFINER, exposta a anon), um atacante pode criar registros comerciais com a chave pública do projeto.

**Tabelas similares com policy `using true`** (lista completa):

| Domínio | Tabelas afetadas |
|---|---|
| **Conversas** | `conversations` (ALL), `messages` (ALL), `conversation_notes` (ALL), `conversation_tags` (ALL), `conversation_tag_history` (INSERT), `note_history` (ALL), `note_reactions` (ALL), `tags` (ALL) |
| **CRM** | `clientes_cadastro` (3 ops), `client_phones` (DELETE/INSERT/UPDATE), `client_adjustments` (DELETE/INSERT/UPDATE) |
| **Produção** | `kanban_pecas` (DELETE/INSERT/UPDATE), `task_pecas` (ALL), `task_checklist_items` (INSERT/UPDATE/DELETE), `task_scripts` (INSERT/UPDATE/DELETE), `task_history` (INSERT), `task_time_entries` (INSERT/UPDATE), `celebrity_approvals` (INSERT/UPDATE), `celebrity_approval_history` (INSERT) |
| **Outros** | `contacts` (INSERT/DELETE), `system_notifications` (INSERT), `ai_classification_logs` (INSERT), `landing_leads` (INSERT/anon — esperado), `celebridade_frases` (INSERT/anon — provavelmente não esperado) |

**Padrão recomendado** (usar os helpers já existentes):

```sql
-- Substituir
DROP POLICY "Allow public read on clientes_cadastro" ON clientes_cadastro;
DROP POLICY "Allow public insert on clientes_cadastro" ON clientes_cadastro;
DROP POLICY "Allow public update on clientes_cadastro" ON clientes_cadastro;
DROP POLICY "Allow authenticated delete on clientes_cadastro" ON clientes_cadastro;

CREATE POLICY clientes_cadastro_read    ON clientes_cadastro FOR SELECT TO authenticated USING (is_active_user());
CREATE POLICY clientes_cadastro_insert  ON clientes_cadastro FOR INSERT TO authenticated WITH CHECK (is_active_user());
CREATE POLICY clientes_cadastro_update  ON clientes_cadastro FOR UPDATE TO authenticated USING (is_active_user()) WITH CHECK (is_active_user());
CREATE POLICY clientes_cadastro_delete  ON clientes_cadastro FOR DELETE TO authenticated USING (is_admin_or_supervisor());
```

> **Note:** Há tabelas onde `using true` pode ser intencional (ex.: `task_history` INSERT é feito por trigger DEFINER). Antes de mexer, mapear quem cria registros em cada tabela.

---

### 1.3 Functions SECURITY DEFINER executáveis por `anon`

26 funções DEFINER têm GRANT EXECUTE para `anon`. As mais sensíveis:

| Função | Risco |
|---|---|
| **`ensure_purchase_for_cliente(uuid)`** | Cria `purchases` para qualquer cliente — **escrita comercial via anon** |
| `get_clientes_optimized(...)` | Bypassa RLS de clientes — leitura completa via anon |
| `get_conversations_optimized(...)` | Bypassa RLS de conversas — leitura via anon |
| `get_messages_paginated(...)` | Idem para mensagens |
| `get_production_tasks_optimized(...)` | Idem para tasks |
| `get_relatorio_clientes_page(...)` (2x) | Relatório completo via anon |
| `get_team_members_with_email()` | **Vaza e-mails do time** via anon |
| `get_celebrity_board_data(...)` | Board de aprovações via anon |
| `list_onboarding_runs(...)` | Lista todos os onboardings em curso via anon |
| `search_onboarding_client_candidates(...)` | Permite enumerar clientes |

**Fix:**

```sql
REVOKE EXECUTE ON FUNCTION public.ensure_purchase_for_cliente(uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.ensure_purchase_for_cliente(uuid) TO authenticated;

-- Repetir para todas as funções DEFINER que não devem ser anon-callable.
-- Manter EXECUTE em anon APENAS para helpers usados em RLS (is_admin, is_active_user, etc.)
-- pois sem isso o próprio RLS quebra.
```

Os helpers que **devem permanecer com EXECUTE anon** (por serem chamados em policies):
- `is_active_user()`, `is_admin()`, `is_admin_or_supervisor()`
- `get_user_role(uuid)`, `get_user_status(uuid)`
- Triggers (não precisam de GRANT — são chamados pelo sistema)

---

### 1.4 `search_path` mutável em 28 funções

Vulnerabilidade clássica de schema-poisoning: uma função DEFINER sem `search_path` fixado pode chamar tabelas/funções de um schema controlado pelo atacante (se ele conseguir criar objetos em algum schema do search_path).

**Fix em massa**:

```sql
-- Para cada função listada abaixo:
ALTER FUNCTION public.log_client_created()           SET search_path = public, pg_catalog;
ALTER FUNCTION public.record_task_history()          SET search_path = public, pg_catalog;
ALTER FUNCTION public.handle_new_user()              SET search_path = public, auth, pg_catalog;
-- (etc.)
```

Funções afetadas (28): `__mcp_migration_smoke_test`, `auto_generate_client_code`, `create_onboarding_task_on_active`, `fn_finalize_linked_pecas`, `fn_set_meeting_contacted_at`, `get_clientes_optimized`, `get_dashboard_metrics`, `get_dashboard_overview_metrics`, `get_production_dashboard_metrics`, `log_client_created`, `log_client_stage_change`, `prevent_return_to_mais_novo`, `record_task_history`, `set_default_client_stage`, `set_task_initial_timestamps`, `sync_phone_delete_to_client`, `sync_primary_phone_to_client`, `sync_whatsapp_to_client_phones`, `update_client_comments_updated_at`, `update_client_stage_from_task`, `update_clientes_cadastro_updated_at`, `update_conversation_on_message`, `update_kanban_pecas_updated_at`, `update_production_tasks_updated_at`, `update_task_checklist_items_updated_at`, `update_task_comments_updated_at`, `update_task_scripts_updated_at`, `update_task_timestamps`.

> 💡 `__mcp_migration_smoke_test()` parece ser função de teste deixada por engano — verificar se pode ser dropada.

---

### 1.5 6 Views `SECURITY DEFINER` (ERROR-level)

Views afetadas (todas críticas, são as views centrais do dashboard):

- `clients_with_stage`
- `pipeline_stage_counts`
- `production_tasks_with_subtasks`
- `cliente_last_interaction`
- `v_dashboard_daily_metrics`
- `v_attendants_ranking`

Views SECURITY DEFINER ignoram RLS do chamador. Como RLS de `clientes_cadastro` é "always true" hoje, na prática não faz diferença — mas DEPOIS que o fix da §1.2 estiver aplicado, essas views passariam por cima do controle.

**Fix:**
```sql
ALTER VIEW public.clients_with_stage SET (security_invoker = on);
ALTER VIEW public.pipeline_stage_counts SET (security_invoker = on);
ALTER VIEW public.production_tasks_with_subtasks SET (security_invoker = on);
ALTER VIEW public.cliente_last_interaction SET (security_invoker = on);
ALTER VIEW public.v_dashboard_daily_metrics SET (security_invoker = on);
ALTER VIEW public.v_attendants_ranking SET (security_invoker = on);
```

> ⚠️ Testar em staging — pode haver casos onde a view era intencionalmente DEFINER para somar dados que o usuário não deveria poder ler diretamente.

---

### 1.6 Storage buckets públicos com LIST aberto

Três buckets públicos permitem listar todos os arquivos (mesmo não sendo necessário para acesso direto via URL):

- `chat-media` — anexos de mensagens WhatsApp (potencialmente sensível)
- `comment-attachments` — anexos de comentários do CRM
- `pronuncias` — áudios de pronúncia de marca

**Fix:**
```sql
-- Manter o bucket público para GET (acesso via URL), mas remover LIST:
DROP POLICY chat_media_select_policy ON storage.objects;
CREATE POLICY chat_media_read ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'chat-media'
    AND auth.role() IN ('authenticated', 'service_role')  -- ou outra regra
  );
```

Alternativa mais segura: tornar buckets privados e gerar Signed URLs no backend.

---

### 1.7 Outros pontos de segurança

| Item | Fix |
|---|---|
| `client_stage_history_cleanup_backup` tem RLS habilitado mas nenhuma policy → inacessível mesmo para legítimos. Decidir: arquivar/dropar ou criar policy. | `DROP TABLE` se backup já cumpriu propósito, ou `CREATE POLICY ... TO admin` |
| `auth_leaked_password_protection` desabilitado | Habilitar no painel Supabase Auth (zero código) |
| `pg_trgm` e `pg_net` no schema `public` | Mover para `extensions` schema |

---

## 2. 🟠 Performance — Issues de Alto Impacto

### 2.1 `auth.uid()` re-avaliado por linha (26 policies)

PostgreSQL executa `auth.uid()` por linha quando referenciado diretamente. Wrappar em subquery faz o planner avaliar uma vez só (initplan).

**Tabelas afetadas:**

| Tabela | # policies |
|---|---:|
| `alarms` | 6 |
| `client_comments` | 3 |
| `production_tasks` | 3 |
| `task_comments` | 3 |
| `task_step_reminders` | 3 |
| `note_acknowledgments` | 2 |
| `system_notifications` | 2 |
| `client_pipeline_stages` | 1 |
| `mensagens_padrao` | 1 |
| `message_templates` | 1 |
| `profiles` | 1 |

**Padrão de fix:**
```sql
-- ANTES (re-avaliado por linha):
USING (target_user_id = auth.uid())

-- DEPOIS:
USING (target_user_id = (SELECT auth.uid()))
```

Particularmente importante em `system_notifications` (33.611 linhas, 20 MB) e `production_tasks` (2.679 linhas mas usado em quase todas as queries).

---

### 2.2 32 Foreign Keys sem índice

**Tabelas mais afetadas:**

| Tabela | FKs sem índice |
|---|---|
| **`sla_alerts`** (4) | `cliente_id`, `stage_id`, `task_id`, `resolved_by` |
| **`onboarding_*`** (12) | quase todas as FKs `clientes_cadastro_id` / `purchase_id` / `*_by` |
| **`ai_campaign_*`** (4) | `clientes_cadastro_id`, `purchase_id`, `job_id` |
| `task_time_entries` (2) | `pipeline_stage_id`, `started_by` |
| `client_meetings` (1) | `organizer_id` |
| `celebrity_approval_history` (1) | `cliente_id` |
| `celebrity_approvals` (1) | `submitted_by` |
| `note_reactions` (1) | `user_id` |

**Script de fix (gera CREATE INDEX para todas):**
```sql
-- sla_alerts (mais urgente — 1.735 linhas, usado em alertas em tempo real)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sla_alerts_cliente_id   ON sla_alerts (cliente_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sla_alerts_stage_id     ON sla_alerts (stage_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sla_alerts_task_id      ON sla_alerts (task_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sla_alerts_resolved_by  ON sla_alerts (resolved_by);

-- onboarding (ganha quando volume crescer)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_progress_cliente  ON onboarding_progress (clientes_cadastro_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_identity_cliente  ON onboarding_identity (clientes_cadastro_id);
-- ... etc para as 12 FKs onboarding_*

-- ai_campaign
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aic_assets_cliente   ON ai_campaign_assets (clientes_cadastro_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aic_assets_purchase  ON ai_campaign_assets (purchase_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aic_errors_purchase  ON ai_campaign_errors (purchase_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aic_jobs_cliente     ON ai_campaign_jobs (clientes_cadastro_id);

-- celebridade
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cap_hist_cliente   ON celebrity_approval_history (cliente_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cap_submitted_by   ON celebrity_approvals (submitted_by);

-- task
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tte_pipeline_stage  ON task_time_entries (pipeline_stage_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tte_started_by      ON task_time_entries (started_by);

-- meetings/notes/config
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meetings_organizer  ON client_meetings (organizer_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_react_user     ON note_reactions (user_id);
```

> **Priorizar `sla_alerts`** — é usado em alertas em tempo real (`sla_alerts_read_authenticated` policy + lookups frequentes).

---

### 2.3 Índices não usados (44) + duplicados (2)

**Duplicados (drop imediato):**

```sql
-- idx_kanban_pecas_ordem é prefixo de idx_kanban_pecas_client_status_order
DROP INDEX IF EXISTS public.idx_kanban_pecas_ordem;

-- idx_system_notifications_unread é prefixo de idx_system_notifications_user_unread_created
DROP INDEX IF EXISTS public.idx_system_notifications_unread;
```

**Não-usados notáveis:**

| Tabela | Índices unused | Observação |
|---|---|---|
| `clientes_cadastro` | 4 (incluindo `idx_clientes_cadastro_name_trgm`) | Trigram caro, nunca usado. Confirmar antes de drop. |
| `conversations` | 3 (`idx_conversations_assigned_active`, `..._has_new_messages`, `..._sem_resposta`) | Conversa só tem 297 linhas — talvez prematuro |
| `alarms` | 3 (`idx_alarms_scheduled_at`, `..._acknowledged`, `..._cancelled`) | Tabela com 4 linhas — ainda não precisa |
| `client_productions` | 3 | Tabela com 0 linhas — drop junto da tabela |
| `task_step_reminders` | 2 | Tabela com 0 linhas |
| `onboarding_*` | ~5 entre tabelas | Maturidade do produto: indexes prematuros |

**⚠️ Cuidado:** "não usado" pelo `pg_stat_user_indexes` significa "nunca usado desde o último reset de stats". Antes de dropar:

1. Confirmar `pg_stat_reset()` não foi rodado recentemente (`SELECT stats_reset FROM pg_stat_database WHERE datname=current_database();`).
2. Reservar índices "prematuros" mas semanticamente úteis (ex.: `idx_clientes_cadastro_name_trgm` provavelmente é p/ search bar — confirmar se search está usando).
3. Usar `pg_stat_statements` para ver se há queries lentas que se beneficiariam mantendo o índice.

---

### 2.4 Múltiplas policies permissivas (63 combos)

Quando uma tabela tem N policies para o mesmo (role, action), o Postgres avalia TODAS e faz OR — degradação de performance proporcional a N.

**Tabelas com mais combos múltiplos** (top): `alarms`, `client_meetings`, `client_pipeline_stages`, `client_productions`, `ai_campaign_*`, `business_holidays`, `clients`.

**Padrão típico:**
```sql
-- ANTES: duas policies para a mesma combinação
CREATE POLICY "Users can view alarms targeted to them" ON alarms FOR SELECT TO public USING (target_user_id = auth.uid());
CREATE POLICY "Users can view alarms they created"     ON alarms FOR SELECT TO public USING (created_by = auth.uid());

-- DEPOIS: consolidar em uma só
CREATE POLICY alarms_select ON alarms FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (target_user_id, created_by));
```

**Bonus:** trocar `TO public` por `TO authenticated` evita avaliação para roles do sistema (`authenticator`, `dashboard_user`, etc.) que ficam concorrendo (visível em `client_meetings [anon/SELECT]`, `[authenticator/SELECT]`, `[cli_login_postgres/SELECT]`, `[dashboard_user/SELECT]`, `[supabase_privileged_role/SELECT]` — 5 roles a mais por query).

---

### 2.5 Hotspot: `clientes_cadastro` com 19M seq_scans

```
clientes_cadastro | n_live_tup=877 | seq_scan=19.079.756 | idx_scan=97.507.470 | seq_pct=16,4%
```

19 milhões de scans sequenciais numa tabela de 877 linhas é alto, mas comportamento esperado quando o planner decide que ler tudo é mais barato (tabela pequena). **Não é um problema crítico**, mas vale validar se queries específicas (busca por nome/whatsapp/email) estão usando os índices certos.

---

## 3. 🟡 Modelagem & Dívida Técnica

### 3.1 Tabelas órfãs / candidatas a remoção

| Tabela | Linhas | Indícios |
|---|---:|---|
| `client_productions` | 0 | Substituída por `production_tasks` (comentário do schema diz "possivelmente legado") |
| `celebridade_frases` | 0 | 2.3 MB de índices, **0 linhas** — provavelmente PoC abandonada |
| `note_history` | 0 | Sem nenhuma escrita desde a criação |
| `note_reactions` | 0 | Idem |
| `task_comments` | 0 | Apesar de ter trigger ativo — feature não decolou? |
| `task_step_reminders` | 0 | Idem |
| `landing_leads` | 0 | Landing pode estar inativa |
| `client_stage_history_cleanup_backup` | 833 | Backup de operação pontual — provavelmente já pode arquivar |

**Recomendação:** validar com produto se feature ainda está no roadmap. Tabelas com 0 linhas + 0 escritas há 90+ dias são candidatas a drop com migração reversa.

### 3.2 `clientes_cadastro` — God Table

- **63 colunas**, 59 nullable, 14 com default
- Mistura: dados comerciais + branding + onboarding + produção + auditoria
- Total 4,8 MB com 877 linhas (~5,6 KB/linha — muito wide)
- Já existe migração planejada para `clients` + `purchases`, mas estagnada (19 e 16 linhas)

**Proposta de fatiamento futuro:**

```
clientes_cadastro (atual)
    │
    ├─→ clients (já existe)
    │     - dados de identidade pessoa/empresa
    │
    ├─→ purchases (já existe)
    │     - dados comerciais por contrato/campanha
    │
    ├─→ client_branding (novo?)
    │     - cores, briefing, banco_imagem, referencia_visual,
    │       pronuncia_*, locutor_genero, celebridade_*
    │
    └─→ client_drive_links (novo?)
          - link_pasta_drive, link_pasta_entrega, link_pasta_envio_cliente,
            link_pasta_estatica, link_pasta_video, drive_links jsonb, sgc_link
```

> 🎯 Sem migração agressiva, o mínimo é **parar de adicionar colunas** em `clientes_cadastro` e direcionar novas features para `clients`/`purchases`.

### 3.3 `purchases` — 55 colunas

- Mistura proposta + ClickSign + upsell + MGS + checkout + histórico CRM
- Considere splits em `purchase_proposals`, `purchase_contracts`, `purchase_upsells`, `purchase_payments`.

### 3.4 Inconsistências de naming

| Padrão | Onde |
|---|---|
| **Português + inglês misturados** | `clientes_cadastro` vs `clients`, `kanban_pecas` (pt), `production_tasks` (en), `segmentos`/`subsegmentos`/`negocios` (pt) vs `tags` (en) |
| **camelCase vs snake_case** | `celebridadesReferencia` (camelCase) ≠ rest of schema (snake_case) |
| **Datas em string** | `clientes_cadastro.vigencia` é `text` com regex matching `DD/MM/YYYY` ou `YYYY-MM-DD` em `v_admin_relatorio_clientes` |

**Sugestão:** rename `celebridadesReferencia` → `celebridades_referencia`, e migrar `vigencia` para `date` (com backfill controlado).

### 3.5 Hierarquia opcional em `client_pipeline_stages`

A coluna `parent_stage_id` permite sub-etapas, mas o índice está marcado como não usado — sub-etapas nunca implementadas. Decidir: implementar ou remover coluna+índice.

---

## 4. 🟢 Storage & Crescimento

### 4.1 Tamanhos atuais (top 10)

| Tabela | Total | Tabela | Índices | Rows | Ratio idx/data |
|---|---:|---:|---:|---:|---:|
| `system_notifications` | 20 MB | 14 MB | 6,4 MB | 31.545 | 0,46× |
| `task_history` | 12 MB | 6,6 MB | 5,5 MB | 39.259 | 0,84× |
| `clientes_cadastro` | 4,8 MB | 1,4 MB | 2,6 MB | 874 | **1,86×** |
| `messages` | 4,0 MB | 2,0 MB | 1,8 MB | 7.969 | 0,90× |
| `production_tasks` | 3,9 MB | 1,1 MB | 2,6 MB | 2.672 | **2,36×** |
| `kanban_pecas` | 3,9 MB | 1,5 MB | 2,3 MB | 10.188 | 1,53× |
| `activity_log` | 3,1 MB | 1,8 MB | 1,2 MB | 6.213 | 0,69× |
| `celebridade_frases` | 2,3 MB | **0 bytes** | **2,3 MB** | **0** | ∞ |

**Observações:**

- `celebridade_frases`: **0 linhas, 2.3 MB em índices** — drop óbvio.
- `clientes_cadastro` e `production_tasks` têm mais index que dados — confirmar se todos os 4 unused indexes podem ser removidos.

### 4.2 TTL / Limpeza ausentes

| Tabela | Rate de crescimento | Recomendação |
|---|---|---|
| `system_notifications` | 33k em ~6 meses | Cron diário deletando notifs `read_at IS NOT NULL AND created_at < NOW() - 60 days` |
| `task_history` | 40k linhas | Tabela imutável de auditoria — manter. Considerar partition por trimestre quando passar de 500k. |
| `activity_log` | 6,6k | Similar a system_notifications — TTL de 90 dias. |
| `conversation_ai_analyses` | 776 | 12% dead tuples — vacuum manual ajudaria |

**Exemplo de cron de cleanup:**

```sql
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 3 * * *',  -- 03:00 UTC todo dia
  $$
  DELETE FROM system_notifications
  WHERE read_at IS NOT NULL
    AND read_at < NOW() - INTERVAL '60 days';
  $$
);
```

### 4.3 VACUUM stats

10 tabelas com `n_dead_tup > 100` — autovacuum está rodando, mas algumas têm % alto:

| Tabela | Dead % | Live | Última auto-vacuum |
|---|---:|---:|---|
| `sla_alerts` | 18,6% | 1.735 | 2026-05-26 |
| `client_adjustments` | 13,9% | 2.959 | 2026-05-13 |
| `messages` | 12,4% | 7.968 | 2026-02-18 (!) |
| `conversation_ai_analyses` | 11,9% | 776 | nunca |

**Fix:** rodar `VACUUM ANALYZE messages, conversation_ai_analyses;` em janela de baixa carga e/ou ajustar `autovacuum_vacuum_scale_factor` por tabela.

---

## 5. 🔵 Edge Functions

### 5.1 Migração Z-API → UAZ-API duplicada

14 funções `zapi-*` + 13 funções `uazapi-*` ativas simultaneamente. Quando a migração concluir, **deprecar e remover as 14 `zapi-*`** (cada função ociosa custa cold start e supply chain).

### 5.2 `verify_jwt: false` em funções sensíveis

Vários endpoints sensíveis estão sem JWT:

- `cadastrar-cliente` (cria registros no CRM — esperado se chamado via webhook, mas validar)
- `onboarding-search-clients`, `onboarding-list`, `get-onboarding-data` (leem dados de clientes)
- `update-perplexity-config`, `update-nanobanana-config`, `update-enrichment-config` (mudam configs do sistema)
- Toda a família `ai-campaign-*` (cria/monitora jobs IA)

**Fix:** auditar quais realmente precisam ser públicas (webhooks externos). Para o resto: `verify_jwt: true` + checar role admin no body da função.

---

## 6. ⚪ Outras Melhorias

### 6.1 Habilitar HIBP

Painel Supabase → Auth → Settings → habilitar "Leaked Password Protection". Zero código.

### 6.2 Mover extensões para schema dedicado

```sql
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
ALTER EXTENSION pg_net SET SCHEMA extensions;
-- depois atualizar search_path do role authenticated/anon se necessário
```

### 6.3 `auth_db_connections_absolute` (Auth limitado a 10 conn)

Para usuários `authenticated` simultâneos > 50 isso vira gargalo. Mudar de "absolute" para "percentage" no painel Auth quando crescer.

### 6.4 Documentação de RPCs

Boa parte das RPCs não tem `COMMENT ON FUNCTION` — adicionar para auto-geração de docs:

```sql
COMMENT ON FUNCTION get_clientes_lista_page(...)
  IS 'Página de clientes para listagem do CRM. p_sort_column/direction default por created_at desc.';
```

### 6.5 Consistência em colunas `updated_at`

37 tabelas têm trigger `update_updated_at` mas algumas faltam (`message_reactions`, `note_acknowledgments`, `task_history`, `task_time_entries`). Padronizar.

---

## 7. Roadmap Sugerido (ordem de execução)

### Sprint 1 — Segurança Crítica (1-2 dias)
- [ ] §1.1 Mover service_role do cron para vault
- [ ] §1.3 Revogar EXECUTE anon das funções DEFINER sensíveis (manter helpers de RLS)
- [ ] §1.7 Habilitar HIBP no painel
- [ ] §1.7 Dropar/policy em `client_stage_history_cleanup_backup`

### Sprint 2 — RLS Hardening (2-3 dias)
- [ ] §1.2 Substituir RLS `using true` em `clientes_cadastro` por helpers (testar painel)
- [ ] §1.2 Repetir para `messages`, `conversations`, `kanban_pecas`, `production_tasks` e demais
- [ ] §1.5 Converter 6 views para `security_invoker = on`
- [ ] §1.4 Fixar `search_path` nas 28 funções
- [ ] §1.6 Restringir LIST nos 3 buckets públicos

### Sprint 3 — Performance (1-2 dias)
- [ ] §2.1 Refator das 26 policies com `(SELECT auth.uid())`
- [ ] §2.2 Criar índices nas 32 FKs (priorizar `sla_alerts`)
- [ ] §2.3 Dropar 2 índices duplicados + auditar/dropar 44 não usados
- [ ] §2.4 Consolidar policies múltiplas em `alarms` e `client_meetings`

### Sprint 4 — Limpeza e Modelagem (3-5 dias)
- [ ] §3.1 Drop tabelas órfãs (`celebridade_frases`, `client_productions`, `note_history`, etc. confirmadas)
- [ ] §4.2 Cron de cleanup para `system_notifications` e `activity_log`
- [ ] §5.1 Desativar `zapi-*` legacy quando UAZ-API completa
- [ ] §5.2 Auditar `verify_jwt: false` nas edge functions sensíveis
- [ ] §6.2 Mover `pg_trgm`/`pg_net` para schema `extensions`

### Backlog estratégico
- [ ] §3.2 Concluir migração `clientes_cadastro` → `clients` + `purchases`
- [ ] §3.3 Avaliar split de `purchases`
- [ ] §3.4 Padronizar naming (rename `celebridadesReferencia`, migrar `vigencia` para date)
- [ ] §4.2 Partition de `task_history` quando passar de 500k linhas

---

## Apêndice — Queries de Diagnóstico Úteis

```sql
-- 1. Listar policies "always true"
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname='public' AND (qual='true' OR with_check='true')
ORDER BY tablename;

-- 2. Funções DEFINER chamáveis por anon
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
  AND has_function_privilege('anon', p.oid, 'EXECUTE');

-- 3. FKs sem índice cobertor
SELECT c.conrelid::regclass AS tbl, a.attname AS col
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
WHERE c.contype='f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid=c.conrelid AND a.attnum=ANY(i.indkey)
  );

-- 4. Tamanho top-20
SELECT relname, pg_size_pretty(pg_total_relation_size(c.oid))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 20;
```

---

*Fim do documento — gerado em 2026-05-26 pela análise MCP Supabase.*
