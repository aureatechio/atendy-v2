# Clientes Kanban/Funil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Arquivo alvo:** `docs/superpowers/plans/2026-05-25-clientes-kanban-funil.md`

## Summary

Criar uma visão **Kanban/Funil** dentro de `/clientes`, alternável com a lista atual. A visão reutiliza os filtros, KPIs e dados já carregados por `getClientesDados()`, agrupando clientes pelas etapas reais do pipeline. Os cards podem ser arrastados entre colunas e a mudança deve salvar via `changeStage`, atualizando etapa, `stage_entered_at` e histórico.

## Key Changes

- Adicionar controle de visualização `Lista | Kanban` em `ClientesDashboard`, persistido em `localStorage` com chave `atendy:clientes:view`.
- Criar um helper em `lib/clientes/kanban.ts` para montar colunas ordenadas por `order_index`, incluindo etapas finais ativas e uma coluna "Sem etapa" apenas quando houver clientes sem `stageId`.
- Criar o componente `ClientesKanbanView` para renderizar colunas horizontais com cabeçalho contendo nome da etapa, total de clientes e soma de valor.
- Criar cards com nome do cliente, empresa/código, valor, responsável, prazo, dias na etapa e badges de tarefas abertas/urgentes.
- Implementar drag-and-drop nativo do browser, sem nova dependência, com atualização otimista, loading por card, `toast.success/error` e rollback em falha.
- Atualizar `changeStage` para revalidar também `/clientes`, `/funil` e `/funil/v1`, além de `/clientes/[id]`.

## Interfaces

- `buildClientesKanbanColumns(rows, stages)` retorna colunas prontas para UI:
  - `id`, `name`, `color`, `orderIndex`, `isFinal`, `count`, `totalValue`, `items`.
- `ClientesKanbanView` recebe:
  - `rows`, `stages`, `movingIds`, `onOpenCliente(cliente)`, `onMoveCliente(clienteId, stageId)`.
- `ClientesDashboard` passa dados filtrados para lista e Kanban. A paginação continua valendo apenas para a lista; o Kanban mostra todos os resultados filtrados.

## Test Plan

- Adicionar testes unitários para `buildClientesKanbanColumns` cobrindo ordenação, totais por coluna, etapas finais, etapas inativas e clientes sem etapa.
- Adicionar teste React para `ClientesKanbanView` verificando renderização das colunas/cards e chamada de `onMoveCliente` ao soltar card em outra etapa.
- Atualizar/verificar fluxo de filtros existente para garantir que a alternância de visão não altera os resultados filtrados.
- Rodar `pnpm test`, `pnpm typecheck` e `pnpm build`.

## Assumptions

- A visão Kanban fica na própria página `/clientes`, não em rota separada.
- O drag-and-drop salva imediatamente, sem modal de confirmação, seguindo o padrão atual do seletor de etapa no detalhe do cliente.
- Clientes arquivados podem aparecer quando filtrados, mas não devem ser arrastáveis.
- O Kanban é desktop-first com rolagem horizontal; em telas menores, as colunas continuam acessíveis por scroll.
