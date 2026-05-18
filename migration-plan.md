# Plano de Migração para Next.js + React + Tailwind CSS v4 + shadcn

## Objetivo
Recriar o protótipo atual (2 páginas HTML) em uma base moderna com:
- Next.js (App Router)
- React + TypeScript
- Tailwind CSS v4
- shadcn/ui
- sem backend inicialmente (dados locais), preservando comportamento do front-end

## Entregáveis
1. App Next.js funcional com rotas:
   - `/` → Página **Compras Pagas**
   - `/funil` → Página **Funil de Produção**
2. Design system consistente com tokens de tema, tipografia e componentes shadcn.
3. Lógica de filtros, ordenação, paginação e KPIs portadas sem regressão funcional.
4. Estrutura pronta para integração futura com API.

## Estrutura de projeto alvo
1. Criar app com `app/`, `components/`, `lib/`, `hooks/`, `data/`.
2. Definir tipos em `lib/types`.
3. Separar utilitários de data, formatação e manipulação de dados em `lib/utils`.
4. Centralizar componentes compartilhados em `components/ui` (shadcn) e `components/dashboard`.

## Fase 1 — Setup (Dia 1)
1. Inicializar projeto Next.js com TypeScript e App Router.
2. Configurar Tailwind CSS v4 e tema base.
3. Instalar e configurar `shadcn/ui` com preset padrão.
4. Configurar alias de importação (`@/*`) e lint/format.
5. Criar tema global (`app/globals.css`) com variáveis CSS alinhadas ao protótipo.

## Fase 2 — Modelagem de dados e contratos (Dia 1–2)
1. Converter os JSON embutidos do HTML para arquivos:
   - `data/compras.json`
   - `data/funil.json`
2. Criar tipos TypeScript:
   - `Compra`
   - `FunilStage`
   - `FunilRow`
3. Criar helpers de parse/normalização (datas, números, enum de status/tipos).
4. Criar um repositório de dados local (`lib/data/index.ts`) para facilitar troca futura por API.

## Fase 3 — Implementação de UI base (Dia 2)
1. Implementar layout principal:
   - `Sidebar`
   - `Topbar`
   - `PageHeader`
   - `StatCard`
2. Criar componentes reutilizáveis com shadcn:
   - `Button`, `Input`, `Select`, `Badge`, `Table`, `Card`, `Popover`, `Sheet/Dialog`, `Tabs`.
3. Definir responsividade de grid e sidebar collapse.

## Fase 4 — Página Compras Pagas (`/`) (Dia 2–3)
1. Implementar estado com `useState` + `useMemo` para:
   - busca
   - filtros
   - ordenação
   - paginação
2. Substituir a lógica do HTML por hooks:
   - `useComprasFilters`
   - `useComprasSort`
   - `usePagination`
3. Implementar componentes da página:
   - `ComprasTable`
   - `ColumnVisibilityToggle`
   - `FiltersPanel`
   - `PaginationControls`
4. Implementar export CSV com mesma estrutura atual.
5. Garantir atalhos e acessibilidade (focus search com `Cmd/Ctrl+K`).

## Fase 5 — Página Funil de Produção (`/funil`) (Dia 3–4)
1. Implementar estrutura de estado semelhante, com filtros de período.
2. Portar cálculos de métrica:
   - total clientes
   - valor total no funil (sem duplicidade por cliente)
   - finalizados
   - lead time médio
3. Implementar “stage map” e cards de gargalo.
4. Construir visual:
   - painel de colunas do funil
   - detalhamento por etapa com barras de percentual e badges.
5. Adicionar suporte a `view=full` (modo tela cheia) via query param.

## Fase 6 — Qualidade e consistência (Dia 4)
1. Padronizar estados vazios, loading e erros de parse.
2. Garantir formatação de moeda, datas e valores em utilitários compartilhados.
3. Melhorar acessibilidade básica:
   - aria-labels
   - contraste
   - foco visível
4. Ajustar performance:
   - memoização de listas grandes
   - paginação virtualizada apenas se necessário.

## Fase 7 — Integração e futuro (Dia 5)
1. Criar abstração de serviço:
   - `lib/api/compras.ts`
   - `lib/api/funil.ts`
2. Adicionar camada para trocar fonte local por endpoint sem mudanças de UI.
3. Criar estrutura para autenticação e cache (quando necessário).
4. Configurar ambiente de deploy (Vercel) e variável `NEXT_PUBLIC_...` se houver dados externos.

## Riscos e decisões técnicas
1. Os dados atuais estão no frontend, então o app inicial precisa usar mock local para manter comportamento.
2. A lógica de período e deduplicação por cliente no funil deve ficar em função central para evitar divergência entre componentes.
3. A conversão da lógica de ordenação/visible columns pode gerar pequenas diferenças visuais; validar com referência do protótipo.

## Ordem de implementação recomendada (MVP)
1. Setup + shadcn + tipos
2. Página `/` sem modo full/avançado
3. Página `/funil` com KPIs e filtros básicos
4. Ajustes de UX e refinamentos visuais
5. Feature de export e atalhos
6. `view=full` e acabamento final

## Próximo passo
Se quiser, já te entrego a **estrutura de pastas + arquivos iniciais** (fase 1) com os comandos de scaffold prontos.
