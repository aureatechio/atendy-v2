---
name: supabase-mcp-project
description: Regra obrigatória — qual projeto Supabase usar via MCP neste repositório
metadata: 
  node_type: memory
  type: project
  originSessionId: 4cf1bb55-ef87-4201-a06a-c1249b1f5180
---

Sempre usar o projeto Supabase `cfgeilnppnlyhwnabkox` (producaoAceleraiAurea) ao operar via MCP neste repositório.

**Why:** Regra definida explicitamente pelo usuário — este é o banco de produção do Atendy v2.

**How to apply:** Toda operação MCP Supabase (execute_sql, list_tables, apply_migration, get_logs, etc.) deve usar `project_id: cfgeilnppnlyhwnabkox`. Nunca usar outro project_id sem confirmação explícita do usuário.
