# Etapas e Subetapas: Fonte de Verdade de Contagem

Este documento define a regra operacional para responder perguntas de CS sobre
quantos clientes estao em uma etapa ou subetapa hoje.

## Regra principal

Quando a pergunta for "quantos clientes estao na etapa X hoje?", a resposta deve
usar somente:

```sql
public.clientes_cadastro.current_stage_id
```

Essa e a etapa atual do cliente. Tarefas de producao nao entram nessa contagem.

## O que nao usar

Nao use estes objetos para contagem operacional de etapa atual de cliente:

- `public.production_tasks.pipeline_stage_id`
- `public.pipeline_stage_counts`
- `public.clients_with_stage`
- Dados do Funil de Producao quando ele estiver calculando ocupacao por tarefa

Esses objetos podem representar ocupacao de producao, tarefas abertas ou uma
etapa efetiva derivada. Isso e util para producao, SLA e carga operacional, mas
nao responde "em qual etapa o cliente esta hoje?".

## Views oficiais

### `public.cliente_current_stage_snapshot`

Uma linha por cliente ativo, nao arquivado, com etapa atual resolvida.

Use quando precisar listar os clientes de uma etapa:

```sql
select cliente_id, cliente_nome, stage_name, stage_slug, stage_entered_at
from public.cliente_current_stage_snapshot
where stage_slug = 'onboarding'
order by stage_entered_at nulls last, cliente_nome;
```

### `public.cliente_current_stage_counts`

Contagem exata por etapa/subetapa.

Use quando a pergunta for sobre uma etapa especifica:

```sql
select stage_name, stage_slug, active_client_count
from public.cliente_current_stage_counts
where stage_slug = 'onboarding';
```

Para subetapas de uma etapa-mae:

```sql
select stage_name, stage_slug, parent_stage_name, active_client_count
from public.cliente_current_stage_counts
where parent_stage_slug = 'onboarding'
order by stage_order_index, stage_name;
```

### `public.cliente_current_stage_root_counts`

Contagem agregada por etapa-mae, incluindo clientes na etapa-mae e nas
subetapas.

Use somente quando a pergunta pedir explicitamente o total agregado da etapa-mae:

```sql
select root_stage_name, root_stage_slug, active_client_count
from public.cliente_current_stage_root_counts
where root_stage_slug = 'onboarding';
```

## Semantica esperada

- "Onboarding" exato: somente clientes com `current_stage_id` apontando para a
  etapa `Onboarding`.
- "Roteiro" exato: somente clientes com `current_stage_id` apontando para a
  subetapa `Roteiro`.
- "Onboarding agregado": clientes em `Onboarding` mais clientes em todas as
  subetapas de `Onboarding`.
- "Hoje" significa snapshot atual no momento da consulta. Para historico por
  data, use `client_stage_history`, nao as views de snapshot atual.

## Frontend

Na pagina `/clientes`, o filtro de etapa deve ser exato:

```ts
item.stageId === selectedStageId
```

Subetapas devem aparecer como opcoes filtraveis. Views de Kanban podem agrupar
cartoes por etapa-mae visualmente, mas nao devem transformar a contagem exata em
contagem agregada sem deixar isso explicito.
