# Modulo Relatorios e Dados

Documentacao seletiva criada a partir do modulo atual e dos modulos legados, mantendo apenas regras de negocio e contratos de dados/Supabase.

Ultima atualizacao: 2026-05-18

## Fontes usadas

- Codigo atual: `app/page.tsx`, `app/funil/page.tsx`, `lib/api/funil.ts`, `lib/funil/computeMetrics.ts`, `lib/api/compras.ts`, `data/*.json`
- `.context/modules_old/modules/dashboard/README.md`
- `.context/modules_old/modules/painel-admin/README.md`
- `.context/modules_old/modules/relatorio-insatisfeito/README.md`
- `.context/modules_old/modules/modulo-dashboard-producao/README.md`

## Regras de negocio preservadas

- Relatorios transformam dados operacionais em decisao gerencial; nao devem ser fonte de escrita operacional sem regra explicita.
- Compras calcula KPIs sobre o conjunto filtrado: total, valor total, ticket medio e sincronizacao Atendy.
- Funil conta clientes por identificador de ocupacao (`FunilRow.c`), mas deduplica valor pela chave comercial (`FunilRow.l ?? FunilRow.c`).
- Funil remoto deve excluir clientes arquivados e tarefas de clientes ausentes no dataset ativo.
- Em funil remoto, tarefa ativa tem prioridade sobre `clientes_cadastro.current_stage_id` para representar ocupacao atual.
- Etapas finais contam para KPIs de finalizacao, mas nao devem inflar visoes de execucao ativa.
- Relatorios de atendimento legados diferenciam estado atual de historico: `conversation_tag_history` mede transicoes; `conversations.ai_classification` mede estado atual.
- Dashboards administrativos devem excluir grupos quando a metrica for de atendimento individual.

## Contratos de dados atuais

| Recurso | Papel |
| ------- | ----- |
| `data/compras.json` | Fonte local de compras quando nao houver API remota |
| `data/funil.json` | Fonte local/fallback do funil |
| `lib/api/compras.ts` | Ponto de troca futura para fonte remota de compras |
| `lib/api/funil.ts` | Fonte remota Supabase REST com fallback local |
| `lib/funil/computeMetrics.ts` | Deduplicacao de valor, contagem de clientes, finalizados e gargalos |

## Contratos Supabase usados pelo funil atual

| Tabela | Uso |
| ------ | --- |
| `client_pipeline_stages` | Slug, nome, cor, ordem e marcador `is_final` |
| `production_tasks` | Ocupacao ativa por cliente e etapa |
| `clientes_cadastro` | Clientes ativos, valores, etapa atual e datas de entrada na etapa |

## Contratos Supabase legados de relatorios

| Recurso | Uso |
| ------- | --- |
| `get_clientes_metrics(...)` | Metricas de clientes |
| `get_dashboard_metrics()` | Metricas administrativas legadas |
| `get_dashboard_overview_metrics()` | Overview operacional |
| `get_production_dashboard_metrics(...)` | Metricas de producao |
| `get_relatorio_clientes_page(...)` | Relatorio administrativo de clientes |
| `v_dashboard_daily_metrics` | Historico diario de conversas |
| `v_attendants_ranking` | Ranking de atendimento |
| `conversation_tag_history` | Historico de insatisfacao |
| `activity_log` / `get_presence_metrics_today()` | Presenca administrativa |

## RLS e seguranca

- Como o funil atual pode usar `NEXT_PUBLIC_SUPABASE_ANON_KEY`, a seguranca depende de RLS nas tabelas remotas.
- Views legadas expostas devem ser `security_invoker = true` ou ter grants restritos.
- Relatorios admin com service role devem revalidar `admin`/`supervisor` antes de consultar dados.
- Dados de valor comercial em `clientes_cadastro.valor` ou `deal_value` nao devem ficar publicos sem decisao explicita.

## Lacunas de validacao

- Confirmar se compras tera fonte remota e qual tabela/API sera canonica.
- Confirmar se o funil deve usar tabelas diretas, views `clients_with_stage`/`pipeline_stage_counts` ou RPC dedicada.
- Validar RLS remoto antes de habilitar Supabase REST em producao.
- Confirmar quais relatorios legados ainda existem no produto atual.
