---
name: cs-module
description: "Estrutura, acesso e responsabilidades do módulo /cs (Customer Success) do Atendy v2"
metadata: 
  node_type: memory
  type: project
  originSessionId: 37c37846-885e-4fda-a8cf-c017161fe750
---

Módulo /cs é o "Centro de Operações CS" — área restrita para liderança de Customer Success/Experience. Layout próprio com sidebar dedicada (`cs-sidebar`), separado do resto do app.

**Why:** Foi adicionado no commit 7582b98 ("rollout do módulo Customer Success") como ferramentas estratégicas de gestão, distintas da operação diária das atendentes.

**How to apply:** Ao tocar em qualquer coisa sob `/cs/*` lembrar que (1) é restrito por role, (2) tem shell visual próprio, (3) opera em cima dos mesmos dados de `clientes_cadastro` / `client_pipeline_stages` / `profiles` mas com lente gerencial.

### Acesso
- Guard em [lib/auth/guards.ts:24](lib/auth/guards.ts:24) — `canAccessCS` permite apenas roles `admin`, `dev`, `cs_head`.
- Verificado tanto em [app/(protected)/cs/layout.tsx](app/(protected)/cs/layout.tsx) quanto nas server actions ([actions.ts](app/(protected)/cs/forca-tarefa/actions.ts), [list-candidates.ts](app/(protected)/cs/forca-tarefa/list-candidates.ts)) — defesa em profundidade.

### Layout/shell
- [app/(protected)/cs/layout.tsx](app/(protected)/cs/layout.tsx) injeta `<CsSidebar>` ([components/layout/cs-sidebar.tsx](components/layout/cs-sidebar.tsx)) e wrapper `.cs-shell` com cookie `sidebar:cs` para estado colapsado.
- Sidebar é client-component próprio, não compartilha com o sidebar principal.

### Sub-rotas
1. `/cs` ([page.tsx](app/(protected)/cs/page.tsx)) — hub com cards de navegação (Força-Tarefa, Compras Pagas, Relatórios "em breve").
2. `/cs/forca-tarefa` — redistribuir lotes de clientes parados entre atendentes:
   - Page [page.tsx](app/(protected)/cs/forca-tarefa/page.tsx) carrega `client_pipeline_stages` ativos (não-finais) + `profiles` com role=attendant.
   - Painel cliente [components/cs/forca-tarefa-panel.tsx](components/cs/forca-tarefa-panel.tsx) — wizard 3 passos: selecionar lote → distribuir cotas → confirmar.
   - `listCandidates` ([list-candidates.ts](app/(protected)/cs/forca-tarefa/list-candidates.ts)) busca até 2000 clientes em uma etapa, calcula dias parados, valor, % do funil. Aceita filtro `month` (YYYY-MM).
   - `reassignBatch` ([actions.ts](app/(protected)/cs/forca-tarefa/actions.ts)) agrupa por novo responsável, atualiza `responsavel_atendimento`+`assigned_to` em `clientes_cadastro`, registra `client_stage_history` com `action_type: "bulk_reassignment"` e `metadata.operation_id`. Limite 500 clientes/lote. Revalida `/funil`, `/cs/forca-tarefa` e cada `/clientes/[id]`.
3. `/cs/compras-pagas` ([page.tsx](app/(protected)/cs/compras-pagas/page.tsx)) — reusa `getCompras()` + `<ComprasDashboard>` (mesmo dashboard de compras do CRM), embutido no shell CS para apoio operacional.

### Notas operacionais
- "Relatórios & SLA" no hub está como `is-soon` (placeholder).
- Tabela `client_stage_history` é a fonte de auditoria para reassignments em massa — não confundir com mudanças de etapa individuais.
- Para entender o sistema de alertas adjacente, ver commit dd7252b (alertas unificados SLA/tarefas/follow-up).
