# Fase 1 — Mudanças Zero Risco (executar em produção)

> **Projeto:** Supabase `cfgeilnppnlyhwnabkox` (producaoAceleraiAurea)
> **Risco operacional:** ⚪ Zero — nenhuma mudança altera comportamento de leitura/escrita do app
> **Janela necessária:** Nenhuma. Pode rodar em horário comercial.
> **Esforço total:** 2-3 horas
> **Pré-requisitos:** Apenas acesso ao SQL Editor do Supabase ou MCP `execute_sql`

---

## Visão geral da Fase 1

| # | Ação | Tempo | Reversível? |
|---|---|---|---|
| 1 | VACUUM ANALYZE em tabelas com dead tuples altos | 5 min | N/A (sem efeito colateral) |
| 2 | Criar 32 índices em FKs sem cobertura | 30 min | Sim (DROP INDEX) |
| 3 | Dropar 2 índices duplicados confirmados | 5 min | Sim (CREATE INDEX) |
| 4 | Habilitar Leaked Password Protection (HIBP) | 1 min | Sim (toggle off) |
| 5 | Documentar RPCs principais (COMMENT ON FUNCTION) | 30 min | Sim (COMMENT ... IS NULL) |
| 6 | Configurar autovacuum mais agressivo em tabelas hot | 10 min | Sim (RESET storage param) |
| 7 | Snapshot baseline antes das próximas fases | 15 min | N/A |

---

## 1. VACUUM ANALYZE em tabelas com dead tuples

### Por quê é seguro
Não altera dados nem schema. Só limpa tuplas mortas e atualiza estatísticas. Pode haver lock leve em VACUUM, mas `VACUUM` (sem FULL) é não-bloqueante.

### Pré-validação (antes)

```sql
-- Ver estado atual
SELECT
  schemaname,
  relname,
  n_live_tup,
  n_dead_tup,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
  last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND n_dead_tup > 100
ORDER BY dead_pct DESC NULLS LAST;
```

**Resultado esperado da baseline (snapshot atual):**

| Tabela | dead_pct |
|---|---:|
| sla_alerts | 18.6% |
| client_adjustments | 13.9% |
| messages | 12.4% |
| conversation_ai_analyses | 11.9% |

### Execução

```sql
VACUUM ANALYZE public.sla_alerts;
VACUUM ANALYZE public.client_adjustments;
VACUUM ANALYZE public.messages;
VACUUM ANALYZE public.conversation_ai_analyses;
VACUUM ANALYZE public.production_tasks;
VACUUM ANALYZE public.task_pecas;
VACUUM ANALYZE public.kanban_pecas;
VACUUM ANALYZE public.task_scripts;
VACUUM ANALYZE public.task_time_entries;
VACUUM ANALYZE public.system_notifications;
```

### Pós-validação

```sql
-- dead_pct deve cair próximo de 0
SELECT relname, n_dead_tup, last_vacuum, last_analyze
FROM pg_stat_user_tables
WHERE schemaname='public'
  AND relname IN ('sla_alerts','messages','conversation_ai_analyses');
```

### Rollback
Não aplicável.

---

## 2. Criar 32 índices em Foreign Keys sem cobertura

### Por quê é seguro
`CREATE INDEX CONCURRENTLY` não trava a tabela. App continua respondendo durante a criação. No pior caso, se algum falhar, fica em estado `INVALID` e pode ser refeito (não corrompe nada).

### Pré-validação

```sql
-- Listar FKs sem índice antes
SELECT
  c.conrelid::regclass AS tabela,
  a.attname AS coluna,
  c.conname AS fk_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND c.connamespace = 'public'::regnamespace
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND a.attnum = ANY(i.indkey)
      AND a.attnum = i.indkey[0]  -- coluna deve ser a primeira do índice
  )
ORDER BY tabela, coluna;
```

### Execução

> ⚠️ `CREATE INDEX CONCURRENTLY` **não pode rodar dentro de transação**. Executar cada comando isoladamente. Se usar MCP, executar um por um (não combinar com `;`).

```sql
-- =========================================
-- sla_alerts (4 FKs sem índice) - PRIORIDADE
-- =========================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sla_alerts_cliente_id   ON public.sla_alerts (cliente_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sla_alerts_stage_id    ON public.sla_alerts (stage_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sla_alerts_task_id     ON public.sla_alerts (task_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sla_alerts_resolved_by ON public.sla_alerts (resolved_by);

-- =========================================
-- ai_campaign_* (4)
-- =========================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aic_assets_cliente   ON public.ai_campaign_assets (clientes_cadastro_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aic_assets_purchase  ON public.ai_campaign_assets (purchase_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aic_errors_purchase  ON public.ai_campaign_errors (purchase_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aic_jobs_cliente     ON public.ai_campaign_jobs (clientes_cadastro_id);

-- =========================================
-- onboarding_* (12)
-- =========================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_acceptances_cliente   ON public.onboarding_acceptances (clientes_cadastro_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_briefings_cliente     ON public.onboarding_briefings (clientes_cadastro_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_enrich_jobs_campaign  ON public.onboarding_enrichment_jobs (campaign_job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_enrich_jobs_cliente   ON public.onboarding_enrichment_jobs (clientes_cadastro_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_identity_cliente      ON public.onboarding_identity (clientes_cadastro_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_identity_sub_cliente  ON public.onboarding_identity_submissions (clientes_cadastro_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_identity_sub_purchase ON public.onboarding_identity_submissions (purchase_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_links_created_by      ON public.onboarding_links (created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_logo_hist_cliente     ON public.onboarding_logo_history (clientes_cadastro_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_logo_hist_uploader    ON public.onboarding_logo_history (uploaded_by_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_progress_cliente      ON public.onboarding_progress (clientes_cadastro_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_copy_published_by     ON public.onboarding_copy (published_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_onb_copy_v_published_by   ON public.onboarding_copy_versions (published_by);

-- =========================================
-- celebridade (2)
-- =========================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cap_hist_cliente     ON public.celebrity_approval_history (cliente_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cap_submitted_by     ON public.celebrity_approvals (submitted_by);

-- =========================================
-- task_time_entries (2)
-- =========================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tte_pipeline_stage   ON public.task_time_entries (pipeline_stage_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tte_started_by       ON public.task_time_entries (started_by);

-- =========================================
-- demais (5)
-- =========================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meetings_organizer   ON public.client_meetings (organizer_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_note_react_user      ON public.note_reactions (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productions_assigned ON public.client_productions (assigned_to);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productions_created  ON public.client_productions (created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrichment_updated_by ON public.enrichment_config (updated_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nanobanana_updated_by ON public.nanobanana_config (updated_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_perplexity_updated_by ON public.perplexity_config (updated_by);
```

### Pós-validação

```sql
-- 1. Conferir que todos foram criados com sucesso (não INVALID)
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_sla_alerts_%'
   OR indexname LIKE 'idx_aic_%'
   OR indexname LIKE 'idx_onb_%'
   OR indexname LIKE 'idx_cap_%'
   OR indexname LIKE 'idx_tte_%'
ORDER BY tablename, indexname;

-- 2. Verificar índices INVALID (devem retornar 0 linhas)
SELECT
  c.relname AS index_name,
  i.indrelid::regclass AS table_name
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE NOT i.indisvalid
  AND i.indrelid::regclass::text LIKE 'public.%';
```

### Rollback

```sql
-- Se algum índice estiver causando problema (improvável):
DROP INDEX CONCURRENTLY IF EXISTS public.idx_sla_alerts_cliente_id;
-- (etc para os outros)
```

---

## 3. Dropar 2 índices duplicados

### Por quê é seguro
Ambos são prefixo perfeito de outro índice maior. Postgres usa o índice maior para qualquer query que usaria o menor.

### Pré-validação

```sql
-- Confirmar duplicação:
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    (tablename = 'kanban_pecas' AND indexname IN ('idx_kanban_pecas_client_status_order','idx_kanban_pecas_ordem'))
    OR
    (tablename = 'system_notifications' AND indexname IN ('idx_system_notifications_unread','idx_system_notifications_user_unread_created'))
  );

-- Salvar o `indexdef` em algum lugar (para rollback se precisar)
```

### Execução

```sql
-- kanban_pecas: idx_kanban_pecas_ordem é prefixo de idx_kanban_pecas_client_status_order
DROP INDEX CONCURRENTLY IF EXISTS public.idx_kanban_pecas_ordem;

-- system_notifications: idx_system_notifications_unread é prefixo de idx_system_notifications_user_unread_created
DROP INDEX CONCURRENTLY IF EXISTS public.idx_system_notifications_unread;
```

### Pós-validação

```sql
-- Verificar que os índices "maiores" ainda existem:
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_kanban_pecas_client_status_order','idx_system_notifications_user_unread_created');
-- Deve retornar 2 linhas

-- Smoke test: garantir que queries comuns ainda usam índice
EXPLAIN ANALYZE
  SELECT * FROM kanban_pecas WHERE cliente_id = '<algum-uuid>' ORDER BY ordem LIMIT 50;
-- Deve mostrar "Index Scan using idx_kanban_pecas_client_status_order"

EXPLAIN ANALYZE
  SELECT * FROM system_notifications WHERE target_user_id = '<uuid>' AND read_at IS NULL ORDER BY created_at DESC LIMIT 20;
-- Deve mostrar "Index Scan using idx_system_notifications_user_unread_created"
```

### Rollback

```sql
-- Se precisar (raríssimo):
CREATE INDEX CONCURRENTLY idx_kanban_pecas_ordem ON public.kanban_pecas (ordem);
CREATE INDEX CONCURRENTLY idx_system_notifications_unread
  ON public.system_notifications (target_user_id) WHERE read_at IS NULL;
-- (consultar o indexdef salvo na pré-validação para a definição exata)
```

---

## 4. Habilitar Leaked Password Protection (HIBP)

### Por quê é seguro
Afeta apenas **novos** signups/password changes. Usuários existentes não são impactados.

### Execução

**Via painel Supabase:**
1. Acessar https://supabase.com/dashboard/project/cfgeilnppnlyhwnabkox/auth/policies
2. Authentication → Settings → Password Settings
3. Toggle ON em "Leaked Password Protection"
4. Save

**Via API Management** (se preferir):
```bash
curl -X PATCH "https://api.supabase.com/v1/projects/cfgeilnppnlyhwnabkox/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password_hibp_enabled": true}'
```

### Pós-validação
Tentar fazer signup com password fraco/conhecido (ex.: `password123`). Deve retornar erro.

### Rollback
Toggle OFF no painel.

---

## 5. Documentar funções principais (COMMENT ON FUNCTION)

### Por quê é seguro
Metadata-only. Não muda comportamento.

### Execução

```sql
-- RPCs do frontend
COMMENT ON FUNCTION public.get_clientes_lista_page IS
  'Paginação de clientes para listagem do CRM com filtros multi-dimensão (search, stages, classificacao, etiquetas, responsaveis, prazo, vigencia, segmento, celebridade) e sort configurável. Retorna {data, total, has_more}.';

COMMENT ON FUNCTION public.get_clientes_metrics IS
  'Métricas agregadas de clientes (total, por estágio, por classificação) para o header da listagem do CRM.';

COMMENT ON FUNCTION public.get_producao_board IS
  'Retorna o board de produção agrupado por etapa, com limit por etapa (p_stage_limit) e filtros (responsável, prioridade, urgência, cliente, datas).';

COMMENT ON FUNCTION public.get_producao_stage_tasks IS
  'Tasks de uma etapa específica do board de produção com paginação. Usado quando o usuário clica "ver mais" numa coluna.';

COMMENT ON FUNCTION public.get_production_dashboard_metrics IS
  'Métricas do dashboard de produção (tasks por status, por urgência, tempo médio) num range de datas.';

COMMENT ON FUNCTION public.get_relatorio_clientes_page IS
  'Relatório admin de clientes com 24 dimensões de filtro. Substitui consulta direta a v_admin_relatorio_clientes.';

COMMENT ON FUNCTION public.get_relatorio_tempo_medio IS
  'Tempo médio de cada cliente em cada etapa do pipeline (para relatório de SLA).';

COMMENT ON FUNCTION public.get_celebrity_board_data IS
  'Dados do board de aprovação de celebridade (peças por status, com limite no estado "concluido").';

COMMENT ON FUNCTION public.list_onboarding_runs IS
  'Lista runs do onboarding (CS) com search, status, paginação.';

COMMENT ON FUNCTION public.get_onboarding_run_detail IS
  'Detalhe completo de um onboarding (progress + acceptances + identity + briefing).';

-- Helpers de auth
COMMENT ON FUNCTION public.is_active_user IS
  'Helper de RLS: true se auth.uid() existe em profiles com status=active.';

COMMENT ON FUNCTION public.is_admin IS
  'Helper de RLS: true se auth.uid() tem role=admin e status=active em profiles.';

COMMENT ON FUNCTION public.is_admin_or_supervisor IS
  'Helper de RLS: true se auth.uid() tem role=admin OR supervisor e status=active.';

-- Triggers críticos
COMMENT ON FUNCTION public.record_task_history IS
  'Trigger AFTER INSERT/UPDATE em production_tasks - cria entrada em task_history com diff (action_type, field, from→to, changed_by).';

COMMENT ON FUNCTION public.update_client_stage_from_task IS
  'Trigger AFTER INS/UPD em production_tasks - propaga mudança de pipeline_stage_id para clientes_cadastro.current_stage_id.';

COMMENT ON FUNCTION public.handle_new_user IS
  'Trigger em auth.users - cria profile correspondente em public.profiles. SECURITY DEFINER.';
```

### Pós-validação

```sql
-- Confirmar comentários:
SELECT
  p.proname,
  pg_catalog.obj_description(p.oid, 'pg_proc') AS comment
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND pg_catalog.obj_description(p.oid, 'pg_proc') IS NOT NULL
ORDER BY p.proname;
```

### Rollback

```sql
COMMENT ON FUNCTION public.get_clientes_lista_page IS NULL;
-- etc
```

---

## 6. Ajustar autovacuum em tabelas hot

### Por quê é seguro
Apenas faz autovacuum rodar mais cedo. Não trava nada.

### Execução

```sql
-- Tabelas com muita escrita - vacuum mais agressivo
ALTER TABLE public.messages SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE public.task_history SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE public.system_notifications SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE public.activity_log SET (autovacuum_vacuum_scale_factor = 0.05);

-- conversation_ai_analyses nunca foi vacuumed - manual primeiro
VACUUM ANALYZE public.conversation_ai_analyses;
ALTER TABLE public.conversation_ai_analyses SET (autovacuum_vacuum_scale_factor = 0.1);
```

### Pós-validação

```sql
-- Ver settings aplicados:
SELECT relname, reloptions
FROM pg_class
WHERE relname IN ('messages','task_history','system_notifications','activity_log','conversation_ai_analyses');
```

### Rollback

```sql
ALTER TABLE public.messages RESET (autovacuum_vacuum_scale_factor);
ALTER TABLE public.task_history RESET (autovacuum_vacuum_scale_factor);
ALTER TABLE public.system_notifications RESET (autovacuum_vacuum_scale_factor);
ALTER TABLE public.activity_log RESET (autovacuum_vacuum_scale_factor);
ALTER TABLE public.conversation_ai_analyses RESET (autovacuum_vacuum_scale_factor);
```

---

## 7. Snapshot baseline (para próximas fases)

### Por quê
Antes de qualquer mudança da Fase 2, ter um snapshot do estado atual permite comparar performance/comportamento depois.

### Execução

```sql
-- Salvar baseline numa tabela auxiliar (criar schema dedicado)
CREATE SCHEMA IF NOT EXISTS _audit;

-- Snapshot 1: tamanhos de tabela
CREATE TABLE _audit.baseline_table_sizes AS
SELECT
  now() AS captured_at,
  relname,
  pg_total_relation_size(c.oid) AS total_bytes,
  pg_relation_size(c.oid) AS table_bytes,
  pg_indexes_size(c.oid) AS index_bytes,
  c.reltuples::bigint AS estimated_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

-- Snapshot 2: índices e contagem de uso
CREATE TABLE _audit.baseline_index_usage AS
SELECT
  now() AS captured_at,
  schemaname, relname, indexrelname,
  idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public';

-- Snapshot 3: contagem de linhas por tabela hot
CREATE TABLE _audit.baseline_row_counts AS
SELECT
  now() AS captured_at,
  'clientes_cadastro' AS tbl, (SELECT count(*) FROM clientes_cadastro) AS cnt
UNION ALL SELECT now(), 'messages',         (SELECT count(*) FROM messages)
UNION ALL SELECT now(), 'conversations',    (SELECT count(*) FROM conversations)
UNION ALL SELECT now(), 'production_tasks', (SELECT count(*) FROM production_tasks)
UNION ALL SELECT now(), 'task_history',     (SELECT count(*) FROM task_history)
UNION ALL SELECT now(), 'kanban_pecas',     (SELECT count(*) FROM kanban_pecas)
UNION ALL SELECT now(), 'celebrity_approvals', (SELECT count(*) FROM celebrity_approvals)
UNION ALL SELECT now(), 'purchases',        (SELECT count(*) FROM purchases)
UNION ALL SELECT now(), 'clients',          (SELECT count(*) FROM clients);

-- Snapshot 4: pg_stat_statements top 20 queries (se extension habilitada)
-- Útil para detectar regressão de performance após mudanças
CREATE TABLE _audit.baseline_top_queries AS
SELECT
  now() AS captured_at,
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  rows
FROM pg_stat_statements
WHERE query NOT ILIKE '%pg_stat%'
ORDER BY total_exec_time DESC
LIMIT 20;
```

### Verificação pós-fase
Quando começar a Fase 2, comparar:

```sql
-- Tamanho ganho/perdido:
SELECT
  b.relname,
  pg_size_pretty(b.total_bytes) AS antes,
  pg_size_pretty(pg_total_relation_size(('public.'||b.relname)::regclass)) AS agora,
  pg_size_pretty(pg_total_relation_size(('public.'||b.relname)::regclass) - b.total_bytes) AS delta
FROM _audit.baseline_table_sizes b
WHERE b.relname IN ('messages','task_history','system_notifications')
ORDER BY (pg_total_relation_size(('public.'||b.relname)::regclass) - b.total_bytes) DESC;
```

---

## Checklist final de execução

Marcar conforme conclui:

- [ ] **1. VACUUM ANALYZE** rodado nas 10 tabelas com dead tuples
- [ ] **2. CREATE INDEX CONCURRENTLY** rodado para 32 FKs (todos `valid`)
- [ ] **3. DROP INDEX** dos 2 duplicados (`idx_kanban_pecas_ordem`, `idx_system_notifications_unread`)
- [ ] **4. HIBP** habilitado no painel Auth
- [ ] **5. COMMENT ON FUNCTION** aplicado nas RPCs principais
- [ ] **6. autovacuum_vacuum_scale_factor** ajustado em 5 tabelas hot
- [ ] **7. Snapshot baseline** salvo em `_audit.baseline_*`

---

## Validação final (smoke test do app)

Após terminar a Fase 1, fazer um smoke test funcional rápido:

```
□ Login no painel admin
□ Abrir listagem de clientes - verifica que filtros funcionam
□ Abrir uma conversa do WhatsApp - mensagens carregam
□ Abrir um cliente - dados, comments, pecas, tasks aparecem
□ Board de produção - colunas e cards renderizam
□ Board de aprovação celebridade - peças aparecem
□ Dashboard - métricas calculam
□ Criar uma task nova - persiste
□ Mudar status de uma task - history registra
```

Se tudo OK → 🎉 **Fase 1 completa.** Pode partir para [Fase 2](./SUPABASE_FASE_2_COM_RISCO.md).

---

## Resumo do ganho da Fase 1

| Ganho | Estimativa |
|---|---|
| **Performance** em queries JOIN com FKs sem índice | 10-100× mais rápido em tabelas grandes (`sla_alerts`, `task_time_entries`) |
| **Storage** liberado por índices duplicados | ~500 KB |
| **Performance** geral após VACUUM | Stats atualizadas → planner escolhe melhores planos |
| **Compliance** com HIBP | Habilitado |
| **Auditabilidade** | RPCs documentadas + baseline salvo |
| **Risco operacional** | **0%** — nenhuma mudança altera comportamento de leitura/escrita |
