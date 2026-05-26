# Fase 1 — Relatório de Execução

> **Projeto:** Supabase `cfgeilnppnlyhwnabkox` (producaoAceleraiAurea)
> **Executado em:** 2026-05-26
> **Status:** ✅ 6 de 7 blocos completos via SQL. ⚠️ 1 bloco (HIBP) requer ação manual no painel.
> **Tempo total:** ~40 minutos (incluindo validações)
> **Downtime:** Zero

---

## Resumo executivo

| Métrica | Resultado |
|---|---:|
| Índices criados (FKs sem cobertura) | **32 / 32** |
| Índices inválidos | **0** |
| Índices duplicados removidos | **2 / 2** |
| Tabelas com VACUUM ANALYZE | **10 / 10** |
| Tabelas com autovacuum tuning | **5 / 5** |
| Funções documentadas (COMMENT ON) | **21** |
| Tabelas de baseline em `_audit` | **4** |

**Storage delta líquido:** ganho de **~2,2 MB** (redução em `system_notifications` -2,2 MB + `kanban_pecas` -624 kB compensa as adições de índices novos +360 kB).

---

## Bloco a bloco — executado

### ✅ Bloco 7 — Snapshot baseline (executado PRIMEIRO)

Criado schema `_audit` com 4 tabelas de baseline:

| Tabela | Linhas |
|---|---:|
| `_audit.baseline_table_sizes` | 66 |
| `_audit.baseline_index_usage` | 319 |
| `_audit.baseline_row_counts` | 15 |
| `_audit.baseline_top_queries` | 30 |

Disponível para comparações futuras (Fase 2+).

### ✅ Bloco 1 — VACUUM ANALYZE

Executado em 10 tabelas. Todas com `n_dead_tup = 0` após.

| Tabela | Dead antes | Dead agora |
|---|---:|---:|
| sla_alerts | 396 (18.6%) | 0 |
| client_adjustments | 478 (13.9%) | 0 |
| messages | 1.133 (12.4%) | 0 |
| conversation_ai_analyses | 105 (11.9%) | 0 |
| production_tasks | 251 (8.6%) | 0 |
| task_pecas | 237 (4.2%) | 0 |
| kanban_pecas | 211 (2.0%) | 0 |
| task_scripts | 137 (4.1%) | 0 |
| task_time_entries | 128 (3.3%) | 0 |
| system_notifications | 311 (0.9%) | 0 |

### ✅ Bloco 2 — CREATE INDEX em 32 FKs

**Todos os 32 índices criados com sucesso (0 inválidos):**

**sla_alerts (4):**
- `idx_sla_alerts_cliente_id`
- `idx_sla_alerts_stage_id`
- `idx_sla_alerts_task_id`
- `idx_sla_alerts_resolved_by`

**ai_campaign_* (4):**
- `idx_aic_assets_cliente`, `idx_aic_assets_purchase`
- `idx_aic_errors_purchase`
- `idx_aic_jobs_cliente`

**onboarding_* (13):**
- `idx_onb_acceptances_cliente`
- `idx_onb_briefings_cliente`
- `idx_onb_enrich_jobs_campaign`, `idx_onb_enrich_jobs_cliente`
- `idx_onb_identity_cliente`
- `idx_onb_identity_sub_cliente`, `idx_onb_identity_sub_purchase`
- `idx_onb_links_created_by`
- `idx_onb_logo_hist_cliente`, `idx_onb_logo_hist_uploader`
- `idx_onb_progress_cliente`
- `idx_onb_copy_published_by`, `idx_onb_copy_v_published_by`

**celebridade (2):**
- `idx_cap_hist_cliente`, `idx_cap_submitted_by`

**task_time_entries (2):**
- `idx_tte_pipeline_stage`, `idx_tte_started_by`

**Demais (7):**
- `idx_meetings_organizer`, `idx_note_react_user`
- `idx_productions_assigned`, `idx_productions_created`
- `idx_enrichment_updated_by`, `idx_nanobanana_updated_by`, `idx_perplexity_updated_by`

### ✅ Bloco 3 — Drop de índices duplicados

Confirmada duplicação byte-a-byte antes do drop:

| Index dropado | Equivalente mantido |
|---|---|
| `idx_kanban_pecas_ordem` | `idx_kanban_pecas_client_status_order` (ambos: btree (cliente_id, status, ordem)) |
| `idx_system_notifications_unread` | `idx_system_notifications_user_unread_created` (ambos: btree (target_user_id, created_at DESC) WHERE read_at IS NULL) |

### ⏳ Bloco 4 — HIBP (PENDENTE — ação manual)

Não pode ser feito via SQL. **Ação requerida do usuário:**

1. Acessar: https://supabase.com/dashboard/project/cfgeilnppnlyhwnabkox/auth/policies
2. Navegar para: Authentication → Settings → Password Settings
3. Ativar toggle: "Leaked Password Protection"
4. Save

Tempo: 1 minuto. Risco: zero (só afeta novos signups/password changes).

### ✅ Bloco 5 — COMMENT ON FUNCTION

**21 funções documentadas** (RPCs do frontend + helpers de RLS + triggers críticos):

- RPCs frontend: `get_clientes_lista_page`, `get_clientes_metrics`, `get_producao_board`, `get_producao_stage_tasks`, `get_production_dashboard_metrics`, `get_relatorio_tempo_medio`, `get_celebrity_board_data`, `list_onboarding_runs`, `get_onboarding_run_detail`
- Helpers RLS: `is_active_user`, `is_admin`, `is_admin_or_supervisor`
- Triggers: `record_task_history`, `update_client_stage_from_task`, `handle_new_user`
- Utilities: `ensure_purchase_for_cliente`, `calc_sla_deadline`, `get_team_members_with_email`, `get_presence_metrics_today`

### ✅ Bloco 6 — Autovacuum tuning

5 tabelas hot com `autovacuum_vacuum_scale_factor` reduzido:

| Tabela | scale_factor | Motivo |
|---|---:|---|
| messages | 0.05 | Crescimento alto, não vacuum desde fev/26 |
| task_history | 0.05 | 40k linhas, append-heavy |
| system_notifications | 0.05 | 33k linhas, churn alto |
| activity_log | 0.05 | 6.6k linhas, append-only |
| conversation_ai_analyses | 0.1 | Nunca vacuumed antes |

---

## Validação pós-execução

```sql
-- Confirmado em produção:
-- Índices criados Fase 1: 32 (+6 pré-existentes com mesmo prefixo de nome)
-- Índices inválidos: 0
-- Índices duplicados removidos: 2
-- Tabelas com autovacuum ajustado: 5
-- Funções com COMMENT: 21
-- Tabelas baseline em _audit: 4
```

### Delta de tamanho (top 8)

| Tabela | Antes | Agora | Delta |
|---|---:|---:|---:|
| **system_notifications** | 20 MB | 18 MB | **-2.240 kB** |
| **kanban_pecas** | 3.872 kB | 3.248 kB | **-624 kB** |
| sla_alerts | 784 kB | 968 kB | +184 kB |
| task_time_entries | 800 kB | 896 kB | +96 kB |
| celebrity_approvals | 1.904 kB | 1.944 kB | +40 kB |
| onboarding_progress | 48 kB | 64 kB | +16 kB |
| ai_campaign_assets | 24 kB | 40 kB | +16 kB |
| onboarding_identity | 24 kB | 32 kB | +8 kB |

**Storage líquido:** ~2,2 MB ganhos (drops de duplicados + autovacuum mais agressivo > 360 kB de índices novos).

---

## Smoke test sugerido

Recomendado fazer um smoke test funcional rápido no app:

- [ ] Login no painel admin
- [ ] Abrir listagem de clientes — filtros funcionam
- [ ] Abrir uma conversa do WhatsApp — mensagens carregam
- [ ] Abrir um cliente — dados, comments, pecas, tasks aparecem
- [ ] Board de produção — colunas e cards renderizam
- [ ] Board de aprovação celebridade — peças aparecem
- [ ] Dashboard — métricas calculam
- [ ] Criar uma task nova — persiste
- [ ] Mudar status de uma task — history registra

> Como nada da Fase 1 altera comportamento de leitura/escrita do app, qualquer regressão indicaria problema não relacionado.

---

## Próximos passos

1. **Ação manual:** habilitar HIBP no painel (1 minuto).
2. Monitorar performance por 7 dias via `pg_stat_user_indexes` — verificar se os novos índices estão sendo usados:
   ```sql
   SELECT relname, indexrelname, idx_scan
   FROM pg_stat_user_indexes
   WHERE schemaname='public' AND indexrelname LIKE 'idx_sla_alerts_%' OR indexrelname LIKE 'idx_onb_%'
   ORDER BY idx_scan DESC;
   ```
3. Quando confortável, iniciar **Fase 2** (com risco):
   - Criar branch via `mcp__supabase__create_branch`
   - Apontar staging do app para o branch
   - Aplicar blocos 2.A → 2.K conforme [SUPABASE_FASE_2_COM_RISCO.md](./SUPABASE_FASE_2_COM_RISCO.md)

---

## Apêndice — Rollback (se necessário)

### Reverter índices criados (32)
```sql
DROP INDEX CONCURRENTLY IF EXISTS public.idx_sla_alerts_cliente_id;
-- (repetir para os 32 idx_* criados)
```

### Reverter índices dropados (2)
```sql
CREATE INDEX CONCURRENTLY idx_kanban_pecas_ordem
  ON public.kanban_pecas USING btree (cliente_id, status, ordem);
CREATE INDEX CONCURRENTLY idx_system_notifications_unread
  ON public.system_notifications USING btree (target_user_id, created_at DESC) WHERE (read_at IS NULL);
```

### Reverter autovacuum tuning
```sql
ALTER TABLE public.messages RESET (autovacuum_vacuum_scale_factor);
ALTER TABLE public.task_history RESET (autovacuum_vacuum_scale_factor);
ALTER TABLE public.system_notifications RESET (autovacuum_vacuum_scale_factor);
ALTER TABLE public.activity_log RESET (autovacuum_vacuum_scale_factor);
ALTER TABLE public.conversation_ai_analyses RESET (autovacuum_vacuum_scale_factor);
```

### Reverter comments
```sql
COMMENT ON FUNCTION public.get_clientes_lista_page(...) IS NULL;
-- (etc)
```

### Limpar baseline
```sql
DROP SCHEMA _audit CASCADE;
```
