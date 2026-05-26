# Fase 2 — Mudanças Com Risco (exigem branch + staging)

> **Projeto:** Supabase `cfgeilnppnlyhwnabkox` (producaoAceleraiAurea)
> **Risco operacional:** 🟠 Médio a 🔴 Alto — várias podem quebrar features se aplicadas sem cuidado
> **Pré-requisito:** [Fase 1](./SUPABASE_FASE_1_ZERO_RISCO.md) concluída e baseline salvo em `_audit.*`
> **Janela necessária:** Para os blocos 🔴, agendar manutenção
> **Esforço total:** 2-3 semanas distribuídas
> **Ferramentas obrigatórias:** Supabase Database Branch + ambiente de staging do app

---

## ⚠️ Antes de qualquer coisa: criar branch

```typescript
// Via MCP Supabase
mcp__supabase__create_branch({
  project_id: "cfgeilnppnlyhwnabkox",
  name: "security-hardening-fase2",
  confirm_cost_id: "<obter via mcp__supabase__get_cost>"
})
// → retorna novo project_ref. Use esse ID daqui pra frente em STAGING.
```

**Toda mudança da Fase 2 é aplicada PRIMEIRO no branch.**
**Staging do app aponta para o branch.**
**Só após smoke test passar, faz merge.**

---

## Visão geral da Fase 2

| Bloco | Risco | Janela necessária | Pode ser feito antes de outras? |
|---|---|---|---|
| 2.A — Cron para vault | 🟡 Médio | Não (cron paralelo) | Sim |
| 2.B — `(SELECT auth.uid())` em 26 policies | 🟢 Baixo | Não | Sim |
| 2.C — Fixar `search_path` em 28 funções | 🟡 Médio | Não | Sim |
| 2.D — Revogar EXECUTE anon de funções DEFINER | 🟠 Médio-Alto | Não | Após 2.C |
| 2.E — Restringir LIST em buckets storage | 🟡 Médio | Não | Sim |
| 2.F — `verify_jwt: true` em edge functions internas | 🟡 Médio | Não | Sim |
| 2.G — Mover `pg_trgm`/`pg_net` para schema extensions | 🟠 Alto | Sim (curta) | Após 2.C |
| 2.H — Apertar RLS de `clientes_cadastro` e similares | 🔴 Alto | **Sim** | Após 2.D, 2.F |
| 2.I — Views `security_invoker = on` | 🔴 Alto | **Sim** | **Após 2.H** |
| 2.J — Drop tabelas/índices órfãs | 🟡 Médio | Não | Quando confortável |
| 2.K — TTL `system_notifications` | 🟢 Baixo | Não | Sim |

---

## 2.A — Mover service_role JWT do cron para vault

**Risco:** 🟡 Médio. Se o vault falhar, `pg_net.http_post` falha silenciosamente — análise de IA das conversas para de rodar a cada 5min sem alarme óbvio.

### Como mitigar
1. Criar secret no vault
2. Criar **novo** cron job paralelo (com nome diferente)
3. Monitorar `net._http_response` por 24h
4. Só então desativar o cron antigo

### Execução (no branch primeiro)

```sql
-- 1) Criar secret
SELECT vault.create_secret(
  '<colar-o-service-role-jwt-aqui>',  -- mesmo token que está hoje no cron.job
  'service_role_jwt'
);

-- 2) Confirmar que o secret pode ser lido
SELECT name, decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_jwt';

-- 3) Criar novo cron PARALELO (não substitui o atual ainda)
SELECT cron.schedule(
  'ai-analysis-cron-job-v2',
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

-- 4) Desativar TEMPORARIAMENTE o antigo (não dropar ainda)
UPDATE cron.job SET active = false WHERE jobname = 'ai-analysis-cron-job';
```

### Validação (24h)

```sql
-- Status das chamadas
SELECT
  status_code,
  count(*) AS calls,
  max(created) AS last_call
FROM net._http_response
WHERE created > NOW() - INTERVAL '6 hours'
GROUP BY status_code
ORDER BY status_code;
-- Esperado: status_code = 200 em todas
```

Checar também os logs da Edge Function `ai-analysis-cron` no painel.

### Rollback

```sql
-- Re-ativar o antigo, desativar o novo:
UPDATE cron.job SET active = true  WHERE jobname = 'ai-analysis-cron-job';
UPDATE cron.job SET active = false WHERE jobname = 'ai-analysis-cron-job-v2';
```

### Cleanup (após 7 dias estável)

```sql
SELECT cron.unschedule('ai-analysis-cron-job');
```

---

## 2.B — Wrapping `auth.uid()` em `(SELECT auth.uid())` (26 policies)

**Risco:** 🟢 Baixo. Mudança é semanticamente idêntica para o planner. Ganho de performance é real em queries que tocam muitas linhas.

### Tabelas afetadas

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

### Execução (uma tabela por vez)

> **Princípio:** salvar a definição atual antes de drop, recriar com fix, validar.

#### Exemplo completo — `alarms`

```sql
-- 1) Backup das definições atuais (consultar e SALVAR antes)
SELECT policyname, cmd, roles, qual AS using_expr, with_check
FROM pg_policies WHERE tablename = 'alarms';

-- 2) Aplicar fix (uma policy por vez, dentro de transação)
BEGIN;

DROP POLICY "Users can view alarms targeted to them" ON alarms;
CREATE POLICY alarms_select_targeted ON alarms
  FOR SELECT TO authenticated
  USING (target_user_id = (SELECT auth.uid()));

DROP POLICY "Users can view alarms they created" ON alarms;
CREATE POLICY alarms_select_created ON alarms
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

DROP POLICY "Active users can create alarms" ON alarms;
CREATE POLICY alarms_insert ON alarms
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND status='active')
    AND
    EXISTS (SELECT 1 FROM profiles WHERE id = alarms.target_user_id AND status='active')
  );

DROP POLICY "Targets can acknowledge alarms" ON alarms;
CREATE POLICY alarms_update_target ON alarms
  FOR UPDATE TO authenticated
  USING (target_user_id = (SELECT auth.uid()))
  WITH CHECK (target_user_id = (SELECT auth.uid()));

DROP POLICY "Creators can update pending alarms" ON alarms;
CREATE POLICY alarms_update_creator ON alarms
  FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()) AND acknowledged_at IS NULL)
  WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY "Creators can cancel pending alarms" ON alarms;
CREATE POLICY alarms_cancel ON alarms
  FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()) AND acknowledged_at IS NULL AND cancelled_at IS NULL)
  WITH CHECK (created_by = (SELECT auth.uid()));

-- 3) Smoke test antes de commit
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = '<uuid-de-um-usuario-real>';
SELECT count(*) FROM alarms;  -- comparar com baseline
RESET role;

COMMIT;
-- ou ROLLBACK; se algo errado
```

#### Para as demais tabelas — padrão simplificado

```sql
-- profiles
BEGIN;
DROP POLICY profiles_select_self_or_admin_supervisor ON profiles;
CREATE POLICY profiles_select_self_or_admin_supervisor ON profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR is_admin_or_supervisor());
COMMIT;

-- client_comments
BEGIN;
DROP POLICY "Users can create client comments" ON client_comments;
CREATE POLICY client_comments_insert ON client_comments
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = author_id);

DROP POLICY "Users can update own comments" ON client_comments;
CREATE POLICY client_comments_update ON client_comments
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = author_id);

DROP POLICY "Users can delete own comments" ON client_comments;
CREATE POLICY client_comments_delete ON client_comments
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = author_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id=(SELECT auth.uid()) AND role='admin')
  );
COMMIT;

-- production_tasks, task_comments, task_step_reminders, note_acknowledgments,
-- system_notifications, client_pipeline_stages, mensagens_padrao, message_templates
-- seguir o mesmo padrão substituindo auth.uid() por (SELECT auth.uid())
```

### Validação

```sql
-- 1) Nenhuma policy deveria mais ter auth.uid() solto
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname='public'
  AND (qual ~ 'auth\.uid\(\)' AND qual !~ '\(\s*SELECT\s+auth\.uid')
  OR (with_check ~ 'auth\.uid\(\)' AND with_check !~ '\(\s*SELECT\s+auth\.uid');

-- 2) EXPLAIN deve mostrar InitPlan ao invés de re-eval por linha
EXPLAIN (ANALYZE, BUFFERS)
  SELECT * FROM system_notifications WHERE target_user_id = '<uuid>';
-- procurar por "InitPlan" no topo do plano
```

### Rollback
Restaurar do backup das definições salvas no início (`USING` e `WITH CHECK` originais).

---

## 2.C — Fixar `search_path` em 28 funções

**Risco:** 🟡 Médio. Se a função usa objetos de outro schema sem qualificar (`auth.uid()` por ex.), e o `search_path` não incluir esse schema, **a função quebra na próxima execução**.

### Mapeamento de schemas necessários

Para cada função, primeiro inspecionar o corpo e identificar referências:

```sql
SELECT
  proname,
  CASE
    WHEN prosrc ILIKE '%auth.uid%' OR prosrc ILIKE '%auth.jwt%' THEN 'auth'
    WHEN prosrc ILIKE '%vault.%' THEN 'vault'
    WHEN prosrc ILIKE '%net.%' THEN 'public,extensions' -- pg_net pode ser em public ou extensions
    ELSE 'public,pg_catalog'
  END AS sugestao_search_path,
  prosrc
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND proname IN (
    'log_client_created','update_task_comments_updated_at','update_client_comments_updated_at',
    'update_production_tasks_updated_at','sync_primary_phone_to_client','sync_phone_delete_to_client',
    'set_task_initial_timestamps','update_task_scripts_updated_at','log_client_stage_change',
    'prevent_return_to_mais_novo','update_client_stage_from_task','sync_whatsapp_to_client_phones',
    'update_conversation_on_message','get_production_dashboard_metrics','auto_generate_client_code',
    'record_task_history','update_kanban_pecas_updated_at','set_default_client_stage',
    'update_task_checklist_items_updated_at','update_clientes_cadastro_updated_at',
    'get_dashboard_metrics','update_task_timestamps','fn_finalize_linked_pecas',
    'fn_set_meeting_contacted_at','create_onboarding_task_on_active','get_clientes_optimized',
    'get_dashboard_overview_metrics','__mcp_migration_smoke_test'
  );
```

### Execução

```sql
-- Funções que usam auth.* → search_path inclui auth
ALTER FUNCTION public.log_client_created()             SET search_path = public, auth, pg_catalog;
ALTER FUNCTION public.log_client_stage_change()        SET search_path = public, auth, pg_catalog;
ALTER FUNCTION public.update_client_stage_from_task()  SET search_path = public, auth, pg_catalog;
ALTER FUNCTION public.record_task_history()            SET search_path = public, auth, pg_catalog;
ALTER FUNCTION public.set_task_initial_timestamps()    SET search_path = public, auth, pg_catalog;
ALTER FUNCTION public.update_task_timestamps()         SET search_path = public, auth, pg_catalog;
ALTER FUNCTION public.update_conversation_on_message() SET search_path = public, auth, pg_catalog;
ALTER FUNCTION public.fn_finalize_linked_pecas()       SET search_path = public, auth, pg_catalog;
ALTER FUNCTION public.fn_set_meeting_contacted_at()    SET search_path = public, auth, pg_catalog;
ALTER FUNCTION public.create_onboarding_task_on_active() SET search_path = public, auth, pg_catalog;
ALTER FUNCTION public.get_dashboard_metrics()          SET search_path = public, auth, pg_catalog;
ALTER FUNCTION public.get_clientes_optimized(text, uuid, uuid, uuid, text, integer, integer)
                                                       SET search_path = public, auth, pg_catalog;
ALTER FUNCTION public.get_dashboard_overview_metrics() SET search_path = public, auth, pg_catalog;
ALTER FUNCTION public.get_production_dashboard_metrics(timestamp with time zone, timestamp with time zone)
                                                       SET search_path = public, auth, pg_catalog;

-- Funções de "updated_at" → só public
ALTER FUNCTION public.update_clientes_cadastro_updated_at()      SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_kanban_pecas_updated_at()           SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_production_tasks_updated_at()       SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_client_comments_updated_at()        SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_task_comments_updated_at()          SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_task_scripts_updated_at()           SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_task_checklist_items_updated_at()   SET search_path = public, pg_catalog;

-- Funções de sync
ALTER FUNCTION public.sync_primary_phone_to_client()             SET search_path = public, pg_catalog;
ALTER FUNCTION public.sync_phone_delete_to_client()              SET search_path = public, pg_catalog;
ALTER FUNCTION public.sync_whatsapp_to_client_phones()           SET search_path = public, pg_catalog;
ALTER FUNCTION public.auto_generate_client_code()                SET search_path = public, pg_catalog;
ALTER FUNCTION public.set_default_client_stage()                 SET search_path = public, pg_catalog;
ALTER FUNCTION public.prevent_return_to_mais_novo()              SET search_path = public, pg_catalog;

-- Função de teste deixada por engano - dropar
DROP FUNCTION IF EXISTS public.__mcp_migration_smoke_test();
```

### Validação

```sql
-- Confirmar search_path setado:
SELECT
  p.proname,
  pg_get_function_arguments(p.oid) AS args,
  p.proconfig AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proconfig IS NOT NULL
ORDER BY p.proname;
-- Cada uma deve ter "search_path=..." em proconfig
```

**Smoke test funcional:**

- Criar um cliente novo → deve disparar `auto_generate_client_code`, `set_default_client_stage`, `log_client_created`, `sync_whatsapp_to_client_phones`
- Mover task entre stages → deve disparar `update_client_stage_from_task`, `record_task_history`
- Postar comentário → deve disparar `update_client_comments_updated_at`

### Rollback

```sql
ALTER FUNCTION public.log_client_created() RESET search_path;
-- (etc para cada uma)
```

---

## 2.D — Revogar EXECUTE anon de funções DEFINER

**Risco:** 🟠 Médio-Alto. Se revogar do helper errado, **TODAS as RLS policies que usam o helper quebram**. Confiar em whitelist explícita.

### ⚠️ NÃO REVOGAR DE ANON

Estes helpers **devem permanecer com EXECUTE anon** (são chamados em RLS policies, sem eles tudo quebra):

- `is_active_user()`
- `is_admin()`
- `is_admin_or_supervisor()`
- `get_user_role(uuid)`
- `get_user_status(uuid)`

### Execução

```sql
-- 1) Funções DEFINER sensíveis que NÃO devem ser chamáveis por anon
REVOKE EXECUTE ON FUNCTION public.ensure_purchase_for_cliente(uuid)
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.ensure_purchase_for_cliente(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_team_members_with_email()
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_team_members_with_email() TO authenticated;

-- Atenção: get_relatorio_clientes_page tem 2 overloads. Revogar dos dois.
REVOKE EXECUTE ON FUNCTION public.get_relatorio_clientes_page(
  integer, integer, text, text, text, uuid[], uuid[], uuid[], uuid[], uuid[],
  text[], text, date, date, date, date, timestamp with time zone, timestamp with time zone,
  date, date, numeric, numeric, boolean, boolean, boolean
) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_relatorio_clientes_page(
  integer, integer, text, text, text, uuid[], uuid[], uuid[], uuid[], uuid[],
  text[], text, date, date, date, date, timestamp with time zone, timestamp with time zone,
  date, date, numeric, numeric, boolean, boolean, boolean
) TO authenticated;

-- (segundo overload sem o argumento "celebridade")
REVOKE EXECUTE ON FUNCTION public.get_relatorio_clientes_page(
  integer, integer, text, text, text, uuid[], uuid[], uuid[], uuid[], uuid[],
  text[], date, date, date, date, timestamp with time zone, timestamp with time zone,
  date, date, numeric, numeric, boolean, boolean, boolean
) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_relatorio_clientes_page(
  integer, integer, text, text, text, uuid[], uuid[], uuid[], uuid[], uuid[],
  text[], date, date, date, date, timestamp with time zone, timestamp with time zone,
  date, date, numeric, numeric, boolean, boolean, boolean
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_relatorio_tempo_medio
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_relatorio_tempo_medio TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_celebrity_board_data(integer)
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_celebrity_board_data(integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_onboarding_run_detail(uuid)
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_onboarding_run_detail(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_onboarding_runs(text, text, integer, integer)
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.list_onboarding_runs(text, text, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.search_onboarding_client_candidates(text, integer)
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.search_onboarding_client_candidates(text, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_presence_metrics_today()
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_presence_metrics_today() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_messages_paginated(uuid, integer, uuid)
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_messages_paginated(uuid, integer, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_clientes_optimized(text, uuid, uuid, uuid, text, integer, integer)
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_clientes_optimized(text, uuid, uuid, uuid, text, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_conversations_optimized
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_conversations_optimized TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_production_tasks_optimized
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_production_tasks_optimized TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_metrics()
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_metrics() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_unread_count(uuid)
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.increment_unread_count(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reset_unread_count(uuid)
  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.reset_unread_count(uuid) TO authenticated;
```

### Validação OBRIGATÓRIA

```sql
-- 1) Confirmar que os helpers de RLS AINDA são executáveis por anon
SET ROLE anon;
SELECT is_active_user();       -- deve funcionar (retorna false, sem erro)
SELECT is_admin();              -- deve funcionar
SELECT is_admin_or_supervisor();-- deve funcionar
RESET ROLE;

-- 2) Confirmar que as sensíveis NÃO são executáveis por anon
SET ROLE anon;
SELECT get_team_members_with_email();  -- deve dar "permission denied"
RESET ROLE;

-- 3) Testar do app autenticado (smoke test)
-- Login → listagem de clientes deve carregar
-- Login → board de produção deve carregar
-- Login → dashboard deve carregar
```

### Rollback

```sql
GRANT EXECUTE ON FUNCTION public.ensure_purchase_for_cliente(uuid) TO anon, public;
-- etc
```

---

## 2.E — Restringir LIST nos buckets storage públicos

**Risco:** 🟡 Médio. Pode quebrar se o frontend chama `.storage.from(...).list(...)` em algum lugar.

### Pré-validação obrigatória

```bash
# No codebase do app:
grep -rn "\.storage\.from.*\.list(" --include="*.ts" --include="*.tsx" --include="*.js"
grep -rn "\.storage\.from.*\.move(" --include="*.ts" --include="*.tsx"
grep -rn "\.storage\.from.*\.remove(" --include="*.ts" --include="*.tsx"
```

Se aparecer uso de `.list()` em `chat-media`, `comment-attachments` ou `pronuncias`, mapear ANTES.

### Execução

```sql
-- 1) Salvar policies atuais (backup):
SELECT policyname, definition, check_definition
FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
-- copiar resultado em local seguro

-- 2) Substituir as 3 policies por versões mais restritas
DROP POLICY chat_media_select_policy ON storage.objects;
CREATE POLICY chat_media_select_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media');

DROP POLICY "Anyone can view comment attachments" ON storage.objects;
CREATE POLICY comment_attachments_select_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'comment-attachments');

DROP POLICY pronuncias_select_policy ON storage.objects;
CREATE POLICY pronuncias_select_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pronuncias');

-- 3) Para acesso via URL direta (sem JWT), os buckets continuam públicos
-- mas só permitem leitura GET de objeto específico, não LIST do diretório.
```

### Validação

```bash
# Tentar listar via anon (deve falhar):
curl "https://cfgeilnppnlyhwnabkox.supabase.co/storage/v1/object/list/chat-media" \
  -H "apikey: $SUPABASE_ANON_KEY"
# Esperado: erro de permissão

# Acessar objeto específico via URL pública (deve funcionar):
curl "https://cfgeilnppnlyhwnabkox.supabase.co/storage/v1/object/public/chat-media/path/to/file.jpg" -I
# Esperado: 200 OK
```

### Rollback

```sql
DROP POLICY chat_media_select_authenticated ON storage.objects;
CREATE POLICY chat_media_select_policy ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'chat-media');
-- etc
```

---

## 2.F — `verify_jwt: true` em Edge Functions internas

**Risco:** 🟡 Médio. Webhooks externos PRECISAM ficar com `verify_jwt: false` — Z-API/UAZ-API não mandam JWT.

### Mapeamento

| Função | Hoje | Recomendado | Justificativa |
|---|---|---|---|
| `zapi-webhook` / `uazapi-webhook` | false | **manter false** | Webhook externo. Adicionar `X-Webhook-Secret`. |
| `cadastrar-cliente` | false | **investigar** | Verificar caller (provavelmente CRM externo) |
| `onboarding-search-clients` | false | true | Chamada de painel autenticado |
| `onboarding-list` | false | true | Idem |
| `get-onboarding-data` | false | true | Idem |
| `save-onboarding-progress` | false | depende | Se for fluxo público com token, manter false |
| `save-onboarding-identity` | false | depende | Idem |
| `update-perplexity-config` | false | **true** | Config admin |
| `update-nanobanana-config` | false | **true** | Config admin |
| `update-enrichment-config` | false | **true** | Config admin |
| `update-onboarding-copy` | false | **true** | Config admin |
| `get-perplexity-config` | false | **true** | Config admin |
| `create-ai-campaign-job` | false | **true** | Sensível |
| `retry-ai-campaign-assets` | false | **true** | Sensível |
| `get-ai-campaign-monitor` | false | **true** | Idem |

### Execução

Para cada função, redeployar com `verify_jwt: true`:

```bash
supabase functions deploy update-perplexity-config --no-verify-jwt=false
supabase functions deploy update-nanobanana-config --no-verify-jwt=false
supabase functions deploy update-enrichment-config --no-verify-jwt=false
supabase functions deploy update-onboarding-copy --no-verify-jwt=false
supabase functions deploy get-perplexity-config --no-verify-jwt=false
supabase functions deploy create-ai-campaign-job --no-verify-jwt=false
supabase functions deploy retry-ai-campaign-assets --no-verify-jwt=false
supabase functions deploy get-ai-campaign-monitor --no-verify-jwt=false
supabase functions deploy onboarding-search-clients --no-verify-jwt=false
supabase functions deploy onboarding-list --no-verify-jwt=false
supabase functions deploy get-onboarding-data --no-verify-jwt=false
```

Para os webhooks (manter `verify_jwt: false`), adicionar validação por secret no código:

```typescript
// supabase/functions/zapi-webhook/index.ts
const expectedSecret = Deno.env.get('ZAPI_WEBHOOK_SECRET');
const providedSecret = req.headers.get('x-webhook-secret');

if (!expectedSecret || providedSecret !== expectedSecret) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

E configurar o secret na Z-API/UAZ-API para enviar o header.

### Validação

```bash
# Sem JWT (deve falhar agora):
curl -X POST "https://cfgeilnppnlyhwnabkox.supabase.co/functions/v1/update-perplexity-config"
# Esperado: 401

# Com JWT válido (deve funcionar):
curl -X POST "https://cfgeilnppnlyhwnabkox.supabase.co/functions/v1/update-perplexity-config" \
  -H "Authorization: Bearer $USER_JWT"
# Esperado: 200 ou 4xx de negócio
```

### Rollback
Redeployar com `verify_jwt: false`.

---

## 2.G — Mover `pg_trgm` e `pg_net` para schema `extensions`

**Risco:** 🟠 Alto. Pode quebrar:
- Operador `%` (similarity) em queries de busca
- Função `similarity()` em RPCs ou views
- Cron que usa `net.http_post`

### Pré-validação OBRIGATÓRIA

```sql
-- 1) Caçar usos não-qualificados de pg_trgm
SELECT proname, prosrc FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND (prosrc ILIKE '%similarity(%' OR prosrc ILIKE '%word_similarity(%' OR prosrc ~ '\\s%\\s');

SELECT viewname, definition FROM pg_views
WHERE schemaname='public'
  AND (definition ILIKE '%similarity(%' OR definition ~ '\\s%\\s');

-- 2) Caçar usos de pg_net
SELECT proname, prosrc FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND prosrc ILIKE '%net.http%';

-- 3) Verificar search_path dos roles
SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('authenticated','anon','service_role');
```

### Execução

```sql
-- 1) PRIMEIRO ajustar search_path dos roles (adicionar extensions)
ALTER ROLE authenticated SET search_path = "$user", public, extensions;
ALTER ROLE anon          SET search_path = "$user", public, extensions;
ALTER ROLE service_role  SET search_path = "$user", public, extensions;

-- (cron usa o user 'postgres' por padrão — verificar)
ALTER ROLE postgres SET search_path = "$user", public, extensions;

-- 2) Garantir que schema extensions existe e roles têm USAGE
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;

-- 3) DESATIVAR temporariamente o cron (evita erro durante a movimentação)
UPDATE cron.job SET active=false WHERE jobname IN ('ai-analysis-cron-job', 'ai-analysis-cron-job-v2');

-- 4) MOVER as extensions
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
ALTER EXTENSION pg_net  SET SCHEMA extensions;

-- 5) Reativar o cron
UPDATE cron.job SET active=true WHERE jobname = 'ai-analysis-cron-job-v2';
```

### Validação

```sql
-- 1) Confirmar schema das extensions
SELECT extname, extnamespace::regnamespace FROM pg_extension WHERE extname IN ('pg_trgm','pg_net');
-- Ambos devem retornar 'extensions'

-- 2) Smoke test de pg_trgm
SELECT similarity('teste', 'testes');  -- com search_path correto, funciona

-- 3) Smoke test de pg_net (esperar ~5 min até o cron rodar)
SELECT status_code, count(*) FROM net._http_response
WHERE created > now() - interval '10 minutes'
GROUP BY status_code;
```

**Smoke test do app:**
- Caixa de search com `%` em listagem de clientes/conversas deve funcionar
- Próximo ciclo do cron de análise IA deve gerar log

### Rollback

```sql
UPDATE cron.job SET active=false WHERE jobname LIKE 'ai-analysis-cron%';
ALTER EXTENSION pg_trgm SET SCHEMA public;
ALTER EXTENSION pg_net  SET SCHEMA public;
UPDATE cron.job SET active=true WHERE jobname='ai-analysis-cron-job-v2';

-- Reverter search_path (opcional):
ALTER ROLE authenticated RESET search_path;
ALTER ROLE anon RESET search_path;
ALTER ROLE service_role RESET search_path;
```

---

## 2.H — Apertar RLS de `clientes_cadastro` e tabelas com `using true`

**Risco:** 🔴 ALTO. Esta é a mudança mais perigosa. Vai quebrar:
- Edge Functions com `verify_jwt: false` que escrevem (`cadastrar-cliente`, possivelmente outras)
- Qualquer chamada com chave anon
- Webhooks externos que dependem de anon

### Pré-requisitos OBRIGATÓRIOS
- [ ] Fase 1 concluída
- [ ] 2.D concluída (revogações de anon das funções DEFINER)
- [ ] 2.F concluída (`verify_jwt: true` ativado onde apropriado)
- [ ] Edge Functions que precisam escrever em `clientes_cadastro` foram atualizadas para usar **SERVICE_ROLE_KEY** internamente (não `SUPABASE_ANON_KEY`)
- [ ] Branch de DB criada e staging do app apontado para ela
- [ ] Janela de manutenção agendada para a aplicação em produção

### Mapeamento das tabelas (52 policies "always true")

```
GRUPO A — apertar para is_active_user / is_admin_or_supervisor:
  clientes_cadastro, client_phones, client_adjustments, client_meetings,
  client_pipeline_stages, client_productions, client_stage_history,
  conversations, messages, message_reactions, conversation_notes, conversation_tags,
  conversation_tag_history, note_history, note_reactions, tags,
  kanban_pecas, task_pecas, task_checklist_items, task_scripts,
  task_history, task_time_entries, celebrity_approvals, celebrity_approval_history,
  contacts, ai_classification_logs

GRUPO B — apertar com regra de ownership/role:
  system_notifications, mensagens_padrao, message_templates

GRUPO C — manter aberto para anon (intencional):
  landing_leads (INSERT/anon), celebridade_frases (revisar se ainda usado),
  celebridadesReferencia (catálogo público)
```

### Estratégia: aplicar policies novas ANTES de dropar as antigas

```sql
-- =============================================
-- PRIMEIRO: garantir que service_role tem ALL
-- =============================================
-- (já é o default, mas explicitar)
CREATE POLICY service_role_full_access ON public.clientes_cadastro
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================
-- clientes_cadastro
-- =============================================
BEGIN;

-- Criar policies novas (autenticadas)
CREATE POLICY clientes_cadastro_authenticated_read ON public.clientes_cadastro
  FOR SELECT TO authenticated USING (is_active_user());

CREATE POLICY clientes_cadastro_authenticated_insert ON public.clientes_cadastro
  FOR INSERT TO authenticated WITH CHECK (is_active_user());

CREATE POLICY clientes_cadastro_authenticated_update ON public.clientes_cadastro
  FOR UPDATE TO authenticated USING (is_active_user()) WITH CHECK (is_active_user());

CREATE POLICY clientes_cadastro_admin_delete ON public.clientes_cadastro
  FOR DELETE TO authenticated USING (is_admin_or_supervisor());

-- AGORA dropar as antigas:
DROP POLICY "Allow public read on clientes_cadastro"      ON public.clientes_cadastro;
DROP POLICY "Allow public insert on clientes_cadastro"    ON public.clientes_cadastro;
DROP POLICY "Allow public update on clientes_cadastro"    ON public.clientes_cadastro;
DROP POLICY "Allow authenticated delete on clientes_cadastro" ON public.clientes_cadastro;

-- Validar dentro da transação:
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = '<uuid-real-de-active-user>';
SELECT count(*) FROM clientes_cadastro;  -- deve ser > 0
-- comparar com baseline em _audit.baseline_row_counts

RESET role;

-- Se número bate:
COMMIT;
-- Se não:
ROLLBACK;
```

### Repetir o padrão para cada tabela do GRUPO A

Modelo genérico:

```sql
BEGIN;

CREATE POLICY {tbl}_read    ON public.{tbl} FOR SELECT TO authenticated USING (is_active_user());
CREATE POLICY {tbl}_insert  ON public.{tbl} FOR INSERT TO authenticated WITH CHECK (is_active_user());
CREATE POLICY {tbl}_update  ON public.{tbl} FOR UPDATE TO authenticated USING (is_active_user()) WITH CHECK (is_active_user());
CREATE POLICY {tbl}_delete  ON public.{tbl} FOR DELETE TO authenticated USING (is_admin_or_supervisor());

-- Dropar policies "always true" antigas (consultar nomes em pg_policies primeiro)
DROP POLICY ... ON public.{tbl};

-- Validar count
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = '<uuid>';
SELECT count(*) FROM public.{tbl};

RESET role;
COMMIT;
```

### Tabelas que precisam de tratamento especial

#### `conversations` e `messages` — atendimento WhatsApp
Webhooks Z-API/UAZ-API criam mensagens. Edge Functions devem usar service_role internamente:

```typescript
// supabase/functions/zapi-webhook/index.ts
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // ← garantir que é o service_role
);
```

#### `task_history` — INSERT por trigger
A policy atual `[authenticated/INSERT] System can insert task_history` é para permitir o trigger. Manter para service_role:

```sql
DROP POLICY "System can insert task_history" ON task_history;
CREATE POLICY task_history_insert ON task_history
  FOR INSERT TO authenticated, service_role
  WITH CHECK (true);  -- trigger é confiável, mantém true
```

#### `landing_leads` — INSERT de anon (intencional)
**MANTER** a policy de anon. Não tocar.

### Validação pós-aplicação

```sql
-- 1) Confirmar que não há mais "using true" em tabelas sensíveis
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('clientes_cadastro','conversations','messages','kanban_pecas','production_tasks')
  AND (qual='true' OR with_check='true');
-- esperado: zero linhas (exceto para service_role)

-- 2) Comparar counts com baseline
SELECT b.tbl, b.cnt AS antes, c.cnt AS agora
FROM _audit.baseline_row_counts b
JOIN (
  SELECT 'clientes_cadastro' AS tbl, count(*) AS cnt FROM clientes_cadastro
  UNION ALL SELECT 'messages', count(*) FROM messages
  -- ...
) c USING (tbl);
```

**Smoke test do app (logado como cada role):**

```
Admin:
  □ Listagem de clientes - todos os clientes aparecem
  □ Criar/editar/deletar cliente - funciona
  □ Board de produção - tudo visível
  □ Dashboard de métricas - números batem
  □ Painel admin de configs - funciona

Supervisor:
  □ Listagem de clientes - todos aparecem
  □ Criar/editar cliente - funciona
  □ Deletar cliente - funciona (is_admin_or_supervisor)

Attendant:
  □ Listagem de clientes - todos aparecem
  □ Criar/editar cliente - funciona
  □ Deletar cliente - DEVE FALHAR (não é admin/supervisor)
  □ Chat WhatsApp - mensagens enviam/recebem
  □ Aplicar tag em conversa - funciona

Producao:
  □ Board de produção - tasks aparecem
  □ Mover task - funciona
  □ Aprovar peça - funciona

Pending/inativo:
  □ Login bloqueado ou listagens vazias (is_active_user → false)
```

### Rollback (preparar antes de aplicar)

```sql
-- Restaurar as policies originais
BEGIN;
CREATE POLICY "Allow public read on clientes_cadastro" ON clientes_cadastro
  FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert on clientes_cadastro" ON clientes_cadastro
  FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update on clientes_cadastro" ON clientes_cadastro
  FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete on clientes_cadastro" ON clientes_cadastro
  FOR DELETE TO public USING (true);

DROP POLICY clientes_cadastro_authenticated_read ON clientes_cadastro;
DROP POLICY clientes_cadastro_authenticated_insert ON clientes_cadastro;
DROP POLICY clientes_cadastro_authenticated_update ON clientes_cadastro;
DROP POLICY clientes_cadastro_admin_delete ON clientes_cadastro;
COMMIT;
```

---

## 2.I — Views `security_invoker = on`

**Risco:** 🔴 Alto. Sem o 2.H aplicado antes, não faz sentido. Com o 2.H aplicado, dados podem sumir silenciosamente para roles não-admin.

### ⚠️ NÃO APLICAR ANTES DE 2.H

Se você fizer isso ANTES de apertar o RLS de `clientes_cadastro`, nada muda (RLS atual é `using true`).
Se fizer DEPOIS de 2.H, **funciona corretamente** (cada usuário vê só o que tem direito).

### Execução

```sql
ALTER VIEW public.clients_with_stage              SET (security_invoker = on);
ALTER VIEW public.pipeline_stage_counts            SET (security_invoker = on);
ALTER VIEW public.production_tasks_with_subtasks   SET (security_invoker = on);
ALTER VIEW public.cliente_last_interaction         SET (security_invoker = on);
ALTER VIEW public.v_dashboard_daily_metrics        SET (security_invoker = on);
ALTER VIEW public.v_attendants_ranking             SET (security_invoker = on);
```

### Validação CRÍTICA

Para cada role, comparar contagem antes/depois:

```sql
-- Como admin:
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = '<uuid-admin>';
SELECT count(*) FROM clients_with_stage;  -- esperado: todos
SELECT count(*) FROM production_tasks_with_subtasks;
RESET role;

-- Como attendant:
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub = '<uuid-attendant>';
SELECT count(*) FROM clients_with_stage;  -- esperado: depende do RLS de clientes_cadastro
RESET role;
```

**Smoke test do app:**
- Dashboard como admin - métricas batem com query direta
- Dashboard como attendant - métricas refletem seu escopo
- Ranking de atendentes - sem dados sumindo
- Listagem de clientes - count idêntico com/sem view

### Rollback

```sql
ALTER VIEW public.clients_with_stage SET (security_invoker = off);
-- etc
```

---

## 2.J — Drop de tabelas e índices órfãos

**Risco:** 🟡 Médio. Pode quebrar feature flag desligada que ainda referencia.

### Estratégia: rename-and-wait

```sql
-- 1) Confirmar que nada referencia (queries do apêndice em SUPABASE_RISCOS_MUDANCA.md)
-- 2) Renomear ao invés de dropar
ALTER TABLE public.celebridade_frases        RENAME TO _deprecated_celebridade_frases;
ALTER TABLE public.client_productions        RENAME TO _deprecated_client_productions;
ALTER TABLE public.note_history              RENAME TO _deprecated_note_history;
ALTER TABLE public.note_reactions            RENAME TO _deprecated_note_reactions;
ALTER TABLE public.task_step_reminders       RENAME TO _deprecated_task_step_reminders;
ALTER TABLE public.landing_leads             RENAME TO _deprecated_landing_leads;
ALTER TABLE public.client_stage_history_cleanup_backup RENAME TO _deprecated_cleanup_backup;

-- 3) Aguardar 30 dias
-- 4) Se ninguém reclamou, dropar:
-- DROP TABLE public._deprecated_celebridade_frases CASCADE;
```

### Índices não usados (44)

```sql
-- HypoPG para simular plano sem o índice (sem dropar)
CREATE EXTENSION IF NOT EXISTS hypopg;

SELECT hypopg_hide_index('public.idx_clientes_cadastro_name_trgm'::regclass);
EXPLAIN SELECT * FROM clientes_cadastro WHERE name_normalized ILIKE '%bus%';
-- ver se plano fica ruim. Se sim, manter o índice.
SELECT hypopg_reset();
```

Depois de validar caso a caso, dropar com `CONCURRENTLY`:

```sql
DROP INDEX CONCURRENTLY IF EXISTS public.idx_conversations_assigned_active;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_conversations_has_new_messages;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_conversations_sem_resposta;
-- ... 41 outros depois de validação
```

---

## 2.K — TTL para `system_notifications` e `activity_log`

**Risco:** 🟢 Baixo. Deletes em lotes pequenos, dentro de janela noturna.

### Execução

```sql
-- Backup antes do primeiro cleanup (uma vez só)
CREATE TABLE _audit.system_notifications_archive AS
SELECT * FROM system_notifications
WHERE read_at IS NOT NULL AND read_at < NOW() - INTERVAL '90 days';

CREATE TABLE _audit.activity_log_archive AS
SELECT * FROM activity_log
WHERE created_at < NOW() - INTERVAL '90 days';

-- Cron diário de cleanup
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 3 * * *',  -- 03:00 UTC diário
  $$
  WITH deleted AS (
    DELETE FROM system_notifications
    WHERE id IN (
      SELECT id FROM system_notifications
      WHERE read_at IS NOT NULL
        AND read_at < NOW() - INTERVAL '60 days'
      LIMIT 1000
    )
    RETURNING id
  )
  SELECT count(*) FROM deleted;
  $$
);

SELECT cron.schedule(
  'cleanup-old-activity-log',
  '15 3 * * *',  -- 03:15 UTC diário
  $$
  WITH deleted AS (
    DELETE FROM activity_log
    WHERE id IN (
      SELECT id FROM activity_log
      WHERE created_at < NOW() - INTERVAL '90 days'
      LIMIT 1000
    )
    RETURNING id
  )
  SELECT count(*) FROM deleted;
  $$
);
```

### Validação

```sql
SELECT
  jobname,
  schedule,
  active,
  jobid
FROM cron.job
WHERE jobname LIKE 'cleanup-%';

-- Ver execuções:
SELECT
  jobid,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'cleanup-%')
ORDER BY start_time DESC LIMIT 10;
```

### Rollback

```sql
SELECT cron.unschedule('cleanup-old-notifications');
SELECT cron.unschedule('cleanup-old-activity-log');
```

---

## Checklist final da Fase 2

### Pré-execução
- [ ] Branch DB criada via `mcp__supabase__create_branch`
- [ ] Staging do app apontado para o branch
- [ ] Baseline da Fase 1 disponível em `_audit.*`
- [ ] Lista de rollback escrita para cada bloco

### Aplicação no branch (em ordem)
- [ ] **2.A** Cron para vault
- [ ] **2.B** `(SELECT auth.uid())` em 26 policies
- [ ] **2.C** `search_path` em 28 funções
- [ ] **2.D** Revogar EXECUTE anon de funções DEFINER (sem tocar helpers)
- [ ] **2.E** LIST restrito nos 3 buckets storage
- [ ] **2.F** `verify_jwt: true` em edge functions internas
- [ ] **2.G** Mover `pg_trgm`/`pg_net` para schema extensions
- [ ] **2.H** RLS apertado em `clientes_cadastro` e demais tabelas do GRUPO A
- [ ] **2.I** Views `security_invoker = on`
- [ ] **2.J** Rename de tabelas/índices órfãs (não DROP ainda)
- [ ] **2.K** TTL `system_notifications` + `activity_log`

### Smoke test no staging (após cada bloco crítico)
- [ ] Login com cada role (admin/supervisor/attendant/producao/cs_head/dev/designer)
- [ ] CRUD em `clientes_cadastro`
- [ ] Chat WhatsApp (enviar/receber mensagem via UAZ-API webhook)
- [ ] Board de produção (criar/mover/concluir task)
- [ ] Onboarding completo (link → identidade → aceites → finalização)
- [ ] Cron de IA rodando a cada 5min sem erro

### Merge para produção
- [ ] Window de manutenção agendada (15-30 min)
- [ ] Backup recente do DB confirmado
- [ ] Equipe de plantão notificada
- [ ] `mcp__supabase__merge_branch(branch_id="...")`
- [ ] Smoke test em produção pós-merge
- [ ] Monitoramento de logs por 2h

---

## Pós-execução: limpeza

Após 30 dias de produção estável:

```sql
-- Dropar tabelas renomeadas
DROP TABLE public._deprecated_celebridade_frases CASCADE;
-- (etc)

-- Dropar cron antigo
SELECT cron.unschedule('ai-analysis-cron-job');

-- Limpar baselines de auditoria antigos (manter o último)
-- ...
```

---

## Resumo de risco por bloco

| Bloco | Reversível em < 5 min? | Quebra silenciosa possível? | Recomendação |
|---|---|---|---|
| 2.A Cron vault | Sim | Sim (cron falha sem log) | Paralelo + monitorar 24h |
| 2.B `(SELECT auth.uid())` | Sim | Não | Aplicar por tabela |
| 2.C search_path | Sim | Sim (função pode quebrar) | Inspecionar corpo antes |
| 2.D REVOKE anon | Sim | Não (erro explícito) | Whitelist clara dos helpers |
| 2.E Storage LIST | Sim | Sim (lista vazia em vez de erro) | Grep no codebase antes |
| 2.F verify_jwt | Sim | Não | Mapear webhooks antes |
| 2.G pg_trgm/pg_net | Sim | Sim (search fica lento) | Ajustar search_path antes |
| 2.H RLS clientes_cadastro | Sim | **Sim (dados podem sumir)** | **Janela + branch + staging obrigatório** |
| 2.I Views invoker | Sim | **Sim (dados podem sumir)** | **Aplicar DEPOIS de 2.H** |
| 2.J Drop órfãos | Sim (rename) | Não | Wait-and-drop |
| 2.K TTL notifications | Sim | Não | Backup antes do 1º run |

**Tempo total estimado (com testes):** 2-3 semanas distribuídas.
**Janelas de manutenção necessárias:** 1-2 (uma para 2.H + 2.I, opcionalmente outra para 2.G).
