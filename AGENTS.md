# AGENTS.md

## Project Overview

Atendy V2 is a private Next.js dashboard migrated from static HTML prototypes to Next.js, React, Tailwind CSS v4, and shadcn-style components.

Main areas:

- `app/` contains App Router pages and route handlers.
- `components/` contains auth, layout, dashboard, admin, and UI components.
- `hooks/` contains client-side filtering, pagination, sorting, auth, and period logic.
- `lib/` contains domain calculations, types, utilities, local data access, API integration points, and Supabase clients.
- `data/` contains local JSON data extracted from the original prototypes.
- `test/` contains Vitest coverage for dashboard logic.

## Priority Supabase MCP Rule

Use only the Supabase MCP connected to project `cfgeilnppnlyhwnabkox`.

- The allowed MCP target is the project whose URL is `https://cfgeilnppnlyhwnabkox.supabase.co`.
- In this environment, use `mcp__supabase_atendy__` for Supabase MCP operations.
- Do not use any other Supabase MCP server for this project, including `mcp__supabase_crm__`, because it points to a different Supabase project.
- Before any Supabase MCP operation, confirm the tool target is the project `cfgeilnppnlyhwnabkox`.

## Setup Commands

- Install dependencies: `pnpm install`
- Start the development server: `pnpm dev`
- Build for production: `pnpm build`
- Start a production build locally: `pnpm start`
- Run tests: `pnpm test`
- Run type checking: `pnpm typecheck`
- Run linting: `pnpm lint`

## Development Workflow

- Use `pnpm` as the package manager. The repository includes `pnpm-lock.yaml`.
- Local Supabase public configuration is read from `.env` through `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Supabase browser/server clients live under `lib/supabase/`.
- Keep data-access changes behind the existing integration points in `lib/api/compras.ts` and `lib/api/funil.ts` when possible.
- Prefer existing UI primitives in `components/ui/` and existing layout patterns in `components/layout/`.

## Etapas, Subetapas e Contagens

- For CS/business questions like "quantos clientes estao na etapa X hoje?", the source of truth is `clientes_cadastro.current_stage_id`.
- Do not use `production_tasks.pipeline_stage_id`, `pipeline_stage_counts`, or `clients_with_stage` to answer current-client stage counts. Those objects can represent production task occupancy and are not the same metric.
- Use `public.cliente_current_stage_counts` for exact counts by etapa/subetapa. A parent stage row counts only clients whose `current_stage_id` is that parent stage.
- Use `public.cliente_current_stage_root_counts` only when the user explicitly asks for an aggregated parent-stage count including all subetapas.
- In `/clientes`, the etapa filter must be exact by `stageId`; subetapas must remain selectable as first-class filter options.
- In Kanban-style grouped views, grouping by etapa-mae is allowed only as a visual grouping. Card labels and exact counts must still respect the underlying `current_stage_id`.

## Testing Instructions

- Run the full test suite with `pnpm test`.
- Tests are located in `test/` and use Vitest with React Testing Library setup.
- Add or update tests when changing metric calculations, filters, pagination, period handling, auth validation, or other shared logic.
- Run `pnpm typecheck` after TypeScript changes.
- Run `pnpm build` before considering larger UI, routing, or Supabase integration changes complete.

## Code Style

- Use TypeScript and the existing App Router conventions.
- Keep React components focused and colocate reusable UI under `components/`.
- Prefer existing helpers in `lib/` instead of duplicating calculation or formatting logic.
- Keep comments sparse and useful; avoid narrating obvious assignments.
- Preserve the current import style using the `@/` alias.

## Security Notes

- Do not expose Supabase service-role or secret keys in public client code.
- Only `NEXT_PUBLIC_` variables may be used by browser code.
- Treat `.env` and `.mcp.json` as sensitive local configuration.
- When changing Supabase tables, policies, functions, auth, or storage behavior, verify with the allowed Supabase MCP project only: `cfgeilnppnlyhwnabkox`.
