# Modulo Producao e Pipeline Operacional

Documentacao seletiva criada a partir dos modulos legados, mantendo apenas regras de negocio e contratos Supabase.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/producao/README.md`
- `.context/modules_old/modules/modulo-dashboard-producao/README.md`
- `.context/modules_old/modules/pauta/README.md`

## Regras de negocio preservadas

- Producao opera tarefas por etapa do pipeline.
- Slugs de etapas sao contrato compartilhado: `onboarding`, `roteiro`, `roteiro-em-aprovacao`, `atendimento`, `criacao`, `ajuste-roteiro`, `design`, `locucao`, `edit`, `video`, `mix`, `finalizacao`, `delivery`, `aguardando`, `ajuste-video`, `ajuste-design`, `celebridade`, `aprovado-celebridade`, `finalizado`.
- Task finalizada nao deve entrar em boards operacionais nem metricas de execucao ativa.
- `peca nova` e `ajuste` sao conceitos diferentes para metricas de producao.
- Tipos de peca esperados incluem imagem e video.
- Tempo medio por etapa depende de historico de mudanca de etapa.
- Tempo ocioso e tempo de trabalho devem ser calculados por eventos, nao apenas por datas atuais.
- Subtarefas e vinculo com pecas impactam cards, detalhes e dashboards.

## Supabase, views e RPCs

| Recurso | Papel |
| ------- | ----- |
| `production_tasks` | Tarefas principais e subtarefas |
| `client_pipeline_stages` | Etapas do pipeline |
| `task_history` | Historico de mudancas/status/etapas |
| `task_pecas` | Relacao task-peca |
| `kanban_pecas` | Pecas de producao |
| `client_adjustments` | Ajustes vinculados ao cliente |
| `v_producao_task_cards` | View de cards do board |
| `get_producao_board(...)` | RPC agregada por etapa |
| `get_producao_stage_tasks(...)` | RPC paginada por etapa |
| `get_production_dashboard_metrics(...)` | RPC de metricas de dashboard de producao |

## RLS e seguranca

- Views/RPCs do board devem usar `security invoker` para respeitar RLS.
- Mudancas em `production_tasks` exigem revisar Pauta, Celebridade, Clientes e Relatorios.
- Policies devem permitir operacao por usuarios de producao sem expor dados administrativos indevidos.

## Lacunas de validacao

- Confirmar se todas as views atuais estao com `security_invoker = true`.
- Validar se `status = finalizado` ainda e o unico marcador de task concluida.
- Confirmar se `is_main_task` e `parent_task_id` continuam definindo task/subtask.
