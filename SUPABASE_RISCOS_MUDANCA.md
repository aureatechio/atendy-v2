# Análise de Risco — O que pode quebrar em produção

> **Contexto:** Sistema Atendy v2 em produção. Antes de aplicar qualquer fix de [SUPABASE_MELHORIAS.md](SUPABASE_MELHORIAS.md), validar impacto.
> **Princípio:** Toda mudança em RLS, GRANT ou função DEFINER pode quebrar features que dependem do comportamento atual.

---

## 🔴 ALTO RISCO de quebrar produção

### 1. RLS de `clientes_cadastro` (e tabelas com `using true`)

**O que pode quebrar:**

Hoje a policy é `TO public USING (true)`. Se o frontend hoje chama Supabase com:
- ✅ Chave `anon` (sem usuário logado) — vai parar de funcionar **imediatamente**
- ✅ Webhook/cron que usa anon key — quebra
- ✅ Edge Functions com `verify_jwt: false` que repassam anon — quebra
- ✅ Páginas públicas (landing, onboarding, etc.) — quebra leitura

**Áreas suspeitas a verificar antes:**

1. **Edge Function `cadastrar-cliente`** (`verify_jwt: false`) — provavelmente cria registros em `clientes_cadastro` via anon. Vai falhar.
2. **Edge Function `onboarding-search-clients`** e família — leem clientes sem JWT.
3. **Edge Function `cadastrar-cliente`** — chama `ensure_purchase_for_cliente` que escreve.
4. **Webhooks WhatsApp** (`zapi-webhook`, `uazapi-webhook`) — criam conversation/cliente sem JWT.

**Como mitigar:**

```sql
-- ANTES de remover a policy "always true", criar uma nova específica:
CREATE POLICY clientes_service_role_full ON clientes_cadastro
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Edge Functions devem usar SERVICE_ROLE_KEY no client interno (não anon),
-- e essa policy garante que elas continuam funcionando.

-- DEPOIS, restringir o lado autenticado:
CREATE POLICY clientes_authenticated_read ON clientes_cadastro
  FOR SELECT TO authenticated USING (is_active_user());
-- ... etc

-- Por ÚLTIMO, dropar a antiga:
DROP POLICY "Allow public read on clientes_cadastro" ON clientes_cadastro;
```

**Checklist obrigatório antes:**

```bash
# 1. Grep no codebase por uso de anon key em escritas
grep -rn "from('clientes_cadastro')" --include="*.ts" --include="*.tsx"
grep -rn "createClient" supabase/functions/  # ver se algum cria com SUPABASE_ANON_KEY

# 2. Verificar Edge Functions verify_jwt=false que tocam essas tabelas
# (lista no SUPABASE_SCHEMA_REPORT.md §8)

# 3. Rodar em STAGING primeiro com policy nova ATIVA + antiga AINDA presente,
#    monitorar erros 403 por 24h, depois dropar a antiga.
```

---

### 2. Revogar EXECUTE anon das funções DEFINER

**O que pode quebrar:**

Várias dessas funções são chamadas via `supabase.rpc()` no frontend. **Quem chama `rpc()` antes de logar usa anon.** Em particular:

- `get_clientes_optimized` — provavelmente listagem do CRM pré-login? (improvável, mas verificar)
- `get_dashboard_metrics` — dashboard pode ter rota pública?
- `is_admin`, `is_active_user`, `is_admin_or_supervisor` — **CRÍTICAS para RLS, NÃO REVOGAR de anon**, porque RLS policies as chamam e o motor avalia no contexto de anon antes do JWT ser processado em alguns casos.

**⚠️ Risco específico:** Revogar `is_active_user()` de anon quebra **TODAS as policies** que a usam. Vai dar `permission denied for function is_active_user`.

**Como mitigar:**

```sql
-- SEGURO: revogar apenas das funções que NÃO são chamadas em RLS
REVOKE EXECUTE ON FUNCTION public.ensure_purchase_for_cliente(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_team_members_with_email() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_relatorio_clientes_page FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_onboarding_runs FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.search_onboarding_client_candidates FROM anon, public;

-- MANTER EXECUTE anon nos helpers de RLS:
-- is_active_user, is_admin, is_admin_or_supervisor, get_user_role, get_user_status

-- TESTE prévio (em staging):
SET role anon;
SELECT is_active_user();  -- deve funcionar
SELECT get_team_members_with_email();  -- deve dar erro
RESET role;
```

---

### 3. Mudar views para `security_invoker = on`

**O que pode quebrar:**

Hoje views como `clients_with_stage` e `v_admin_relatorio_clientes` rodam como dono → leem `clientes_cadastro`, `profiles`, etc. ignorando RLS do chamador.

Ao mudar para `security_invoker`:
- Se RLS de `clientes_cadastro` continuar `using true`, NADA muda.
- Mas se você fizer §1 antes (apertar RLS) **sem ter aplicado §3**, a view pode retornar menos dados do que o esperado (filtragem por RLS).
- Pior: se a view fizer JOIN com `profiles` e a policy de `profiles` for restritiva, **algumas linhas somem silenciosamente** — o frontend não recebe erro, só dados parciais.

**Como mitigar:**

```sql
-- Fazer em conjunto com §1, NÃO antes:
-- 1) Aplicar RLS novo
-- 2) Mudar view para invoker
-- 3) Testar no dashboard logado como cada role (admin/supervisor/attendant/producao)

ALTER VIEW public.clients_with_stage SET (security_invoker = on);

-- Teste:
SET role authenticated;
SET request.jwt.claim.sub = '<uuid-attendant>';
SELECT count(*) FROM clients_with_stage;  -- compare com count antigo
RESET role;
```

**Aviso especial:** `v_attendants_ranking` e `v_dashboard_daily_metrics` agregam dados de muitos usuários. Se viraram `invoker`, attendant comum pode ver dados de todos — confirmar se ESSE era o comportamento desejado ou se era proposital ser DEFINER.

---

### 4. Restringir LIST nos buckets storage públicos

**O que pode quebrar:**

Hoje policy permite `storage.objects` listar. Se o frontend faz:
```ts
supabase.storage.from('chat-media').list(`conversations/${conversationId}/`)
```
para mostrar anexos de uma conversa, vai quebrar quando o LIST for bloqueado.

**Como mitigar:**

```sql
-- Manter LIST para authenticated, bloquear para anon:
DROP POLICY chat_media_select_policy ON storage.objects;

CREATE POLICY chat_media_get ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

-- Ou: descobrir se app realmente usa list() vs só URL direta.
grep -rn "\.storage\.from.*\.list(" --include="*.ts" --include="*.tsx"
```

---

### 5. Mover cron para vault

**O que pode quebrar:**

- O cron `ai-analysis-cron-job` chama Edge Function a cada 5min. Se a query do vault falhar (extension não carregada, secret não criada com nome certo), **a chamada falha silenciosamente** — análise de IA das conversas para de rodar.
- `pg_net` é async fire-and-forget: erros não vão pro log do cron, vão pro `net._http_response` (que ninguém olha).

**Como mitigar:**

```sql
-- 1. Criar secret no vault PRIMEIRO
SELECT vault.create_secret('eyJ...', 'service_role_jwt');

-- 2. Testar a leitura do vault
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='service_role_jwt';

-- 3. Criar NOVO cron job com nome diferente PARALELO ao antigo
SELECT cron.schedule('ai-analysis-cron-job-v2', '*/5 * * * *', $$ ... $$);

-- 4. Monitorar net._http_response por 1 dia para confirmar status 200
SELECT status_code, error_msg, created
FROM net._http_response
WHERE created > NOW() - INTERVAL '1 hour'
ORDER BY created DESC LIMIT 20;

-- 5. Quando confirmado, desativar o antigo:
UPDATE cron.job SET active=false WHERE jobname='ai-analysis-cron-job';
```

---

## 🟠 MÉDIO RISCO — pode quebrar comportamento sutil

### 6. Wrapping `auth.uid()` em `(SELECT auth.uid())`

**Risco real:** Baixo na MAIORIA dos casos, mas atenção:

- ✅ Em `USING ((SELECT auth.uid()) = author_id)` — funciona idêntico
- ⚠️ Em policies que dependem de **chamadas múltiplas distintas** dentro do mesmo statement (raro)
- ⚠️ Se o ORM gera prepared statements com placeholders, o planner pode escolher um plano pior em algumas queries (extremamente raro)

**Como mitigar:** Aplicar uma policy por vez, monitorar `pg_stat_statements` por mudanças.

```sql
-- Salvar query plan antes
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM alarms WHERE target_user_id = '...';
-- Aplicar fix, comparar.
```

---

### 7. Fixar `search_path` nas 28 funções

**Risco real:** Pode quebrar se a função usa objetos de outro schema sem qualificar:

```sql
-- Função atual sem search_path: encontra "vault.decrypted_secrets" via search_path implícito
-- Após SET search_path = public, pg_catalog: precisa qualificar explicitamente
```

**Como mitigar:**

Antes de fixar, ler o corpo das funções para encontrar referências não-qualificadas a `auth.*`, `vault.*`, `extensions.*`:

```sql
SELECT proname, prosrc FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN ('handle_new_user', 'record_task_history', ...)
ORDER BY proname;
```

Se a função usa `auth.uid()`, o search_path deve incluir `auth`:

```sql
ALTER FUNCTION public.handle_new_user() SET search_path = public, auth, pg_catalog;
```

**Funções que tenho QUASE CERTEZA de que precisam de auth no search_path:**
- `handle_new_user` (escreve em profiles a partir de auth.users)
- `is_active_user`, `is_admin*`, `get_user_*` (chamam auth.uid())
- `record_task_history`, `log_client_created` (chamam auth.uid())

---

### 8. Drop de tabelas órfãs

**Risco real:** Pode quebrar se há código morto que ainda referencia, mas a feature está "ligada/desligada por flag".

**Antes de drop:**

```bash
# 1. Grep no codebase
grep -rn "client_productions\|celebridade_frases\|note_history\|note_reactions" \
  --include="*.ts" --include="*.tsx" --include="*.sql"

# 2. Verificar se há view ou function que referencia
SELECT viewname FROM pg_views WHERE definition ILIKE '%celebridade_frases%';
SELECT proname FROM pg_proc WHERE prosrc ILIKE '%celebridade_frases%';
```

3. **Renomear primeiro, dropar depois:**

```sql
-- Em vez de DROP, suffixar com _deprecated
ALTER TABLE celebridade_frases RENAME TO _deprecated_celebridade_frases;
-- Esperar 30 dias. Se ninguém reclamou, DROP.
```

---

### 9. Drop dos 44 índices "não usados"

**Risco real:** Médio — alguns índices "não usados" são para queries raras (relatórios mensais, exports, busca por celebridade específica).

**Como mitigar:**

```sql
-- 1. Verificar quando stats foram resetadas
SELECT stats_reset FROM pg_stat_database WHERE datname=current_database();
-- Se foi recente (< 30 dias), o "unused" pode ser falso positivo.

-- 2. Usar HypoPG para simular o plano SEM o índice antes de dropar:
CREATE EXTENSION hypopg;
SELECT hypopg_hide_index('idx_clientes_cadastro_name_trgm'::regclass);
EXPLAIN SELECT * FROM clientes_cadastro WHERE name_normalized ILIKE '%alguem%';
SELECT hypopg_reset();

-- 3. Hide first, drop depois:
ALTER INDEX idx_clientes_cadastro_name_trgm SET (fillfactor=100);  -- placeholder
-- Mais limpo: drop concorrente com janela de rollback
DROP INDEX CONCURRENTLY IF EXISTS idx_clientes_cadastro_name_trgm;
-- Se quebrar perf, recriar via histórico (CONCURRENTLY também):
CREATE INDEX CONCURRENTLY idx_clientes_cadastro_name_trgm ON clientes_cadastro USING gin (name_normalized gin_trgm_ops);
```

---

### 10. Edge Functions: ativar `verify_jwt: true`

**O que pode quebrar:**

- Webhooks externos (Z-API/UAZ-API) **PRECISAM** ser `verify_jwt: false` — esses provedores não mandam JWT.
- `cadastrar-cliente` provavelmente é chamada por sistema externo (CRM Aurea?) — verificar antes.
- Funções `get-*-config` e `update-*-config` provavelmente são chamadas do app interno autenticado — seguro ativar JWT.

**Como mitigar:**

Não ativar `verify_jwt: true` cegamente. Para cada função:

1. Identificar o caller (frontend autenticado? webhook? cron?)
2. Se webhook, manter JWT off mas **adicionar validação por X-Webhook-Secret header**:

```ts
// Em zapi-webhook/index.ts
const secret = req.headers.get('x-webhook-secret');
if (secret !== Deno.env.get('ZAPI_WEBHOOK_SECRET')) {
  return new Response('Unauthorized', { status: 401 });
}
```

---

## 🟡 BAIXO RISCO — geralmente seguro

### 11. Criar índices em FKs (§2.2)

Apenas adiciona índices. Risco: zero exceto pelo lock momentâneo. Use `CONCURRENTLY`:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sla_alerts_cliente_id ON sla_alerts (cliente_id);
-- CONCURRENTLY evita lock de tabela durante criação.
```

**⚠️ Caveat:** se o `CREATE INDEX CONCURRENTLY` for cancelado/falhar, o índice fica em estado `INVALID`. Recriar:

```sql
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
-- Se aparecer: DROP INDEX <name>; e recriar.
```

---

### 12. Drop dos 2 índices duplicados (§2.3)

Praticamente zero risco se eles são realmente duplicados (mesmas colunas, mesmo order, mesmo where).

```sql
-- Confirmar duplicação antes:
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename='kanban_pecas' AND indexname IN ('idx_kanban_pecas_client_status_order','idx_kanban_pecas_ordem');
-- Se um for prefixo do outro, dropar o menor.
DROP INDEX CONCURRENTLY public.idx_kanban_pecas_ordem;
```

---

### 13. Habilitar HIBP no painel Auth

Zero risco. Usuários existentes não são afetados; apenas novos passwords/changes são checados.

---

### 14. TTL/Cleanup em `system_notifications`

Risco baixo se feito com cuidado:

```sql
-- Conservador: só notificações JÁ LIDAS + antigas
DELETE FROM system_notifications
WHERE read_at IS NOT NULL
  AND read_at < NOW() - INTERVAL '90 days'
LIMIT 1000;  -- em lotes para evitar lock prolongado
```

**⚠️ Cuidado:** não use `DELETE` sem `LIMIT` em tabela com 33k linhas em horário de pico — pode travar o autovacuum por um tempo.

---

### 15. Mover `pg_trgm` e `pg_net` para schema `extensions`

**Risco médio na verdade.** Se há código (functions, views, RLS policies) usando funções dessas extensions sem schema-qualifier, vai quebrar:

```sql
-- ANTES: funciona porque pg_trgm está em public
WHERE name % 'busca'

-- DEPOIS de mover pg_trgm para extensions:
-- Quebra a menos que search_path inclua extensions OU você qualifique:
WHERE extensions.similarity(name, 'busca') > 0.3
```

**Como mitigar:**

```sql
-- 1. Antes de mover, adicionar 'extensions' ao search_path do role:
ALTER ROLE authenticated SET search_path = "$user", public, extensions;
ALTER ROLE anon SET search_path = "$user", public, extensions;
ALTER ROLE service_role SET search_path = "$user", public, extensions;

-- 2. AGORA mover:
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
ALTER EXTENSION pg_net SET SCHEMA extensions;
```

---

## ⚪ Mudanças que NÃO QUEBRAM (faça à vontade)

| Mudança | Por quê é seguro |
|---|---|
| `VACUUM ANALYZE messages;` | Não muda dados nem schema. |
| Adicionar `COMMENT ON FUNCTION/TABLE/COLUMN` | Metadata-only. |
| Habilitar HIBP | Só afeta novos passwords. |
| Criar `CREATE INDEX CONCURRENTLY` | Só adiciona, sem lock. |
| Dropar tabelas com 0 linhas + 0 referências em código | Confirmar refs primeiro. |
| Dropar índices duplicados (prefixo um do outro) | Substituível por recriação. |
| Atualizar `verify_jwt` em **novas** Edge Functions | Não altera as existentes. |

---

## 📋 Processo recomendado para qualquer mudança

### 1. Branch de banco (testar tudo sem tocar prod)

```ts
// MCP do Supabase tem create_branch:
mcp__supabase__create_branch(project_id="cfgeilnppnlyhwnabkox", name="security-hardening")

// Aplicar TODAS as mudanças no branch
// Rodar smoke test do app apontando para o branch
// Quando OK, fazer merge_branch
```

### 2. Janela de manutenção

Para mudanças de RLS especialmente, agendar janela. Ter `BEGIN ... ROLLBACK` pronto:

```sql
BEGIN;
  DROP POLICY ... ;
  CREATE POLICY ... ;
-- Testar no console com SET role
  SET LOCAL role authenticated;
  SET LOCAL request.jwt.claim.sub = '<uuid-real>';
  SELECT count(*) FROM clientes_cadastro;  -- comparar com baseline
-- Se OK:
COMMIT;
-- Se não:
ROLLBACK;
```

### 3. Monitoramento pós-deploy

```sql
-- Buscar erros de RLS nos últimos 30min
SELECT * FROM postgres_logs WHERE error_severity = 'ERROR'
  AND message ILIKE '%permission denied%' OR message ILIKE '%new row violates%'
  AND created > NOW() - INTERVAL '30 minutes';
```

Pelo painel: **Database → Logs** filtrar por `permission denied`.

### 4. Rollback plan obrigatório

Para CADA mudança, ter SQL de rollback escrito antes de aplicar. Exemplo:

```sql
-- UP:
ALTER VIEW public.clients_with_stage SET (security_invoker = on);

-- DOWN (rollback):
ALTER VIEW public.clients_with_stage SET (security_invoker = off);
```

---

## 🎯 Ordem PRÁTICA recomendada

Levando em conta os riscos acima, eu **NÃO faria** na ordem do roadmap original. Faria:

### Fase 1 — Zero risco (faça hoje)
1. Habilitar HIBP no painel
2. `VACUUM ANALYZE` nas tabelas com dead tuples
3. Criar índices em FKs (`CONCURRENTLY`)
4. Dropar índices duplicados confirmados (`idx_kanban_pecas_ordem`, `idx_system_notifications_unread`)
5. `COMMENT ON FUNCTION` nas RPCs principais

### Fase 2 — Risco baixo, alto valor (esta semana)
6. Mover cron para vault — **com cron paralelo + monitoramento por 24h**
7. Fixar `search_path` nas 28 funções — **uma por vez**, validando que segue funcionando
8. Wrapping `(SELECT auth.uid())` nas 26 policies — **uma tabela por vez**

### Fase 3 — Médio risco (próximas 2 semanas, com staging)
9. Revogar EXECUTE anon das funções DEFINER **não-helpers** (manter `is_*` e `get_user_*`)
10. Restringir LIST nos buckets storage
11. Ativar `verify_jwt: true` nas Edge Functions internas (não-webhook)

### Fase 4 — Alto risco (mês 2, com janela de manutenção + staging completo)
12. Refator RLS de `clientes_cadastro` e tabelas com `using true`
13. Converter as 6 views para `security_invoker = on`
14. Mover `pg_trgm`/`pg_net` para schema extensions (testar bem)

### Fase 5 — Limpeza (sem pressa)
15. Drop tabelas órfãs (após rename-and-wait por 30 dias)
16. Drop índices não usados (após HypoPG simulation)
17. Cleanup cron de `system_notifications`

---

## 🚨 NUNCA FAÇA SEM TESTAR

1. ❌ `REVOKE EXECUTE ON FUNCTION is_active_user() FROM anon` — quebra TUDO que tem RLS
2. ❌ `DROP POLICY ... ;` sem criar a substituta antes
3. ❌ `ALTER VIEW ... security_invoker = on` sem garantir que RLS das tabelas-base permitem leitura
4. ❌ Trocar `verify_jwt: false → true` em webhooks externos
5. ❌ `DROP INDEX` sem `CONCURRENTLY` em tabela quente (lock exclusivo)
6. ❌ Mover extension pg_net enquanto cron está rodando (cron chama `net.http_post`)

---

## TL;DR

**Sim, quebra.** As 3 mudanças com maior risco de quebrar produção:

1. 🔴 **RLS de `clientes_cadastro`** — vai quebrar `cadastrar-cliente`, onboarding edge functions, e tudo que usa anon key.
2. 🔴 **Revogar EXECUTE anon do helper errado** (`is_active_user`/`is_admin`) — quebra TODAS as policies de uma vez.
3. 🟠 **`security_invoker = on` nas views** — sem o RLS apertado primeiro, dados podem sumir silenciosamente.

**Use Supabase Branches para testar tudo sem tocar prod.** O MCP tem `create_branch` que aplica todas as migrations num clone isolado.

Antes de aplicar qualquer Fase 2+, eu recomendo fortemente:
- Criar branch de DB
- Aplicar mudanças em sequência no branch
- Apontar staging do app para o branch
- Rodar suite de smoke tests
- Só então merge

Quer que eu ajude a criar um branch e validar uma fase específica?
