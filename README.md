# Atendy V2 Dashboard

Migração do protótipo (2 páginas HTML) para Next.js + React + Tailwind CSS v4 + componentes no padrão shadcn.

## Estrutura implementada

- `app/page.tsx` → dashboard de Compras
- `app/funil/page.tsx` → dashboard de Funil
- `components/dashboard/*` → blocos de UI (KPI, tabelas, filtros, gráficos de funil)
- `hooks/*` → filtros, ordenação, paginação e período
- `lib/*` → tipos, utilitários, camada local de dados e regras de cálculo
- `lib/api/*` → camada de acesso aos dados para troca futura por API
- `data/compras.json` e `data/funil.json` → fontes JSON extraídas dos protótipos
- `test/*` → suíte Vitest mínima

## Scripts

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`

## Troca de fonte (futuro)

A camada atual de dados local está em `lib/data.ts`.

Use `lib/api/compras.ts` e `lib/api/funil.ts` como pontos de integração para chamar endpoints sem mudar as páginas.

## Etapas e subetapas

Para contagem operacional de clientes por etapa atual, use `clientes_cadastro.current_stage_id`.
As views oficiais sao `cliente_current_stage_counts` (etapa/subetapa exata) e
`cliente_current_stage_root_counts` (etapa-mae agregada). Veja
`docs/etapas-subetapas-contagem.md`.
