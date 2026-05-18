# Supabase MCP Harness

This module keeps Supabase work in the Atendy repository pointed at the correct project.

## Canonical Target

- MCP server: `supabase_atendy`
- MCP URL: `https://mcp.supabase.com/mcp?project_ref=cfgeilnppnlyhwnabkox`
- Supabase URL: `https://cfgeilnppnlyhwnabkox.supabase.co`
- Project ref: `cfgeilnppnlyhwnabkox`
- Local config file: `.mcp.json`

The similarly named `supabase_crm` MCP server is not the Atendy target.

## Preflight

Run this before remote Supabase work:

```bash
pnpm supabase:mcp:check
```

The script validates:

- root `.mcp.json`
- root `.env`
- optional root `.env.local`
- optional global Codex MCP entry for `supabase_atendy`
- high-risk root files for known non-Atendy project refs

Warnings are informational unless they identify a target mismatch that can lead to using the wrong project.

## Remote Validation

When MCP tools are available, validate the target before data inspection:

```text
mcp__supabase_atendy__.get_project_url
```

Expected response:

```json
{ "url": "https://cfgeilnppnlyhwnabkox.supabase.co" }
```

For schema inspection, start with:

```text
mcp__supabase_atendy__.list_tables({ "schemas": ["public"], "verbose": false })
```

For security/performance review, use:

```text
mcp__supabase_atendy__.get_advisors({ "type": "security" })
mcp__supabase_atendy__.get_advisors({ "type": "performance" })
```

## Smoke SQL

Read-only diagnostic queries live in `sql-smoke/`:

- `target_identity.sql` confirms database/session identity.
- `project_tables.sql` lists public tables and row security flags.
- `rls_snapshot.sql` lists RLS policy coverage by public table.
- `edge_function_refs.sql` searches persisted Postgres functions for project URL/ref references.

Run these only against the confirmed Atendy project.

## OAuth Recovery

If the MCP is not authenticated:

```bash
codex mcp login supabase_atendy
```

If `supabase_atendy` is accidentally configured with a bearer token, recreate it as OAuth-capable:

```bash
codex mcp remove supabase_atendy
codex mcp add supabase_atendy --url 'https://mcp.supabase.com/mcp?project_ref=cfgeilnppnlyhwnabkox'
codex mcp login supabase_atendy
```

After authorization, reload the agent session if the MCP tools are not immediately visible.
