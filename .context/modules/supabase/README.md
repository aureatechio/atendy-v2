# Modulo Supabase

Runbook seletivo para Supabase no contexto Atendy, derivado dos modulos legados.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/supabase-mcp/README.md`
- `.context/modules_old/modules/auth/README.md`
- Demais READMEs legados com secoes de banco/RLS/Edge Functions

## Alvo canonico

- Projeto Supabase Atendy legado citado em skills/contexto: `cfgeilnppnlyhwnabkox`.
- MCP esperado quando disponivel: `supabase_atendy`.
- Nao misturar com MCP/projeto `supabase_crm`.

## Regras operacionais

- Antes de qualquer acao remota, confirmar alvo do projeto.
- Para inspecao, preferir consultas somente leitura.
- Para schema, entender tabelas/views/RPCs existentes antes de criar migrations.
- Para Edge Functions chamadas pelo frontend, validar auth dentro do codigo quando deployar com `--no-verify-jwt`.
- Service role nunca deve ir para client.
- Chaves `NEXT_PUBLIC_*` sao publicas e dependem de RLS.

## Checklist Supabase preservado

- Validar RLS em tabelas de `public`.
- Revisar grants de views, especialmente se nao forem `security_invoker`.
- Usar helpers `SECURITY DEFINER` para roles/status sem recursao.
- Confirmar policies de `profiles`, `clientes_cadastro`, `production_tasks`, `conversations`, `messages`, `alarms`, `system_notifications` e `conversation_tag_history`.
- Rodar advisors de seguranca/performance antes de aplicar migrations.
- Verificar logs de Edge Functions quando comportamento remoto divergir da UI.

## Smoke SQL sugerido

```sql
select current_database(), current_user, now();
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

## Lacunas de validacao

- Confirmar alvo remoto ativo neste workspace antes de executar qualquer mudanca.
- Confirmar se migrations locais existem em outro repositorio principal.
- Atualizar este documento se o projeto Supabase canonico mudar.
