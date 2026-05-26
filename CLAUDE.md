# Atendy v2 — Contexto pro Claude

Este repo usa engenharia de contexto: cada módulo/subsistema tem uma memória dedicada em `.claude/memory/` com schema, fluxos, consumidores e pegadinhas. Carregue a memória relevante antes de mexer no código correspondente.

## Mapa de memórias

- [Módulo /clientes (CRM core)](.claude/memory/clientes-module.md) — listagem com filtros, kanban drag-and-drop, detalhe com 6 cards (info, histórico, comentários, tarefas, reuniões, ajustes). Server actions: `addComment`, `changeStage`, `setArchived`. Build em `buildClientesData` (puro).
- [Módulo /funil (Pipeline visual)](.claude/memory/funil-module.md) — V2 padrão, V1 detalhado. Mesmas tabelas que `/clientes` com lente de SLA/rows-por-task. Sempre exclui arquivados. `buildFunilData` é puro.
- [Subsystem `client_pipeline_stages`](.claude/memory/pipeline-stages.md) — etapas do funil: schema, hierarquia 2 níveis, regras de SLA, APIs admin (CRUD + reorder + migrate + impact), ordenação topológica.
- [Tabela `production_tasks`](.claude/memory/production-tasks.md) — schema, constante `COMPLETED_TASK_STATUS = "concluido"`, 9 consumidores transversais. Não há rota dedicada.
- [Sistema de alertas](.claude/memory/alerts-system.md) — alertas unificados (`stage_sla` + `task_overdue` + `followup`): cron, evaluators puros, `diffAlerts`, `sla_alerts`, `/api/alerts`.
- [Sistema de auth](.claude/memory/auth-system.md) — Supabase Auth + `profiles` + capabilities. `AuthSnapshot`, `getAuthSnapshot` (React.cache), `canAccessCS`/`canAccessAdmin`, `requireAdminAccess`. 7 roles.
- [SLA e feriados](.claude/memory/sla-holidays.md) — `calculateSlaDeadline` + `evaluateSla`, unidades (`business_days`, `calendar_hours`, `business_hours` ❌ não implementado), BRT fixo, `business_holidays`.
- [Módulo /cs (Customer Success)](.claude/memory/cs-module.md) — área restrita: hub, força-tarefa de redistribuição, compras pagas. Guard `canAccessCS` (admin/dev/cs_head).
- [Supabase MCP](.claude/memory/supabase-mcp-project.md) — **REGRA**: sempre usar project_id `cfgeilnppnlyhwnabkox` (producaoAceleraiAurea) nas operações MCP Supabase.

## Convenções gerais

- **Não inlinear arrays de roles** — sempre `roleHasCapability(role, capability)`. Capabilities em `lib/auth/capabilities.ts`.
- **Status concluído de task**: usar `COMPLETED_TASK_STATUS` de `lib/production-tasks/status.ts`, nunca string literal.
- **Revalidação após mutations em cliente**: revalidar `/clientes/[id]`, `/clientes`, `/funil`, `/funil/v1` (padrão em `changeStage`, `assignResponsavel`, `setArchived`).
- **Defense in depth**: page guard (`canAccessCS` no layout) + action guard (`requireAdminAccess` na action). Não pular o segundo.
- **SLA**: sempre `evaluateSla`, nunca recalcular `deadline` à mão. Feriados via `Set<string>` (`YYYY-MM-DD`).

## Atualização das memórias

Quando alterar arquitetura de um módulo coberto, atualizar a memória correspondente no mesmo PR. Esses arquivos são fonte de verdade pro Claude e pro time.
