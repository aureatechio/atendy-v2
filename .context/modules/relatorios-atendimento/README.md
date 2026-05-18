# Modulo Relatorios de Atendimento

Documentacao seletiva criada a partir dos modulos legados, mantendo apenas regras de negocio e contratos Supabase.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/dashboard/README.md`
- `.context/modules_old/modules/painel-admin/README.md`
- `.context/modules_old/modules/relatorio-insatisfeito/README.md`
- `.context/modules_old/modules/modulo-dashboard-producao/README.md`

## Regras de negocio preservadas

- Dashboard operacional direciona usuario para filas: sem resposta, insatisfeitos, prazos vencendo, prazos atrasados, entregas atrasadas e tarefas urgentes.
- Cards de dashboard usam query params que precisam continuar alinhados com Clientes, Chat e Producao.
- Dashboard admin e diferente do dashboard operacional: usa metricas administrativas, service role e autorizacao admin/supervisor.
- Relatorio de insatisfacao mede historico de eventos; relatorio diario WhatsApp mede estado atual.
- `Insatisfeito` e classificacao de risco real; `Normal` nao deve gerar tag IA.
- Dashboard de producao mede volume, finalizacao, tempo por etapa, ajustes e desempenho por pessoa/especialidade.
- Periodos de metricas precisam ter regra clara de timezone/data base.

## Supabase, views, RPCs e dados

| Recurso | Papel |
| ------- | ----- |
| `get_dashboard_metrics()` | Metricas legadas de dashboard |
| `get_dashboard_overview_metrics()` | Visao agregada de dashboard |
| `get_clientes_metrics(...)` | Metricas de clientes |
| `get_production_dashboard_metrics(...)` | Metricas de producao |
| `get_relatorio_clientes_page(...)` | Relatorio administrativo de clientes |
| `v_dashboard_daily_metrics` | View historica de metricas diarias |
| `v_attendants_ranking` | Ranking historico de atendentes |
| `conversation_tag_history` | Fonte historica de insatisfacao |
| `conversations` / `messages` | Base das metricas de atendimento/WhatsApp |
| `activity_log` | Presenca/sessoes no painel admin |
| `get_presence_metrics_today()` | RPC de acessos/presenca do dia |

## RLS e autorizacao

- Rotas e APIs administrativas devem revalidar `admin` ou `supervisor`.
- APIs com service role devem limitar campos e aplicar autorizacao antes de consultar dados.
- Views expostas precisam usar `security_invoker = true` ou ter grants revisados.
- `conversation_tag_history` deve restringir leitura a admin/supervisor e escrita manual a usuario ativo.

## Lacunas de validacao

- Confirmar quais RPCs/views ainda existem e quais foram substituidas.
- Validar se `get_presence_metrics_today()` ainda tem grant para `anon`; legado apontava risco.
- Confirmar se relatorios atuais usam estado atual ou historico para cada metrica.
