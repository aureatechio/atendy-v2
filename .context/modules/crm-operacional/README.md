# Modulo Cadastro e Gestao de Clientes (CRM Operacional)

Documentacao seletiva criada a partir dos modulos legados, mantendo apenas regras de negocio e contratos Supabase.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/clientes/README.md`
- `.context/modules_old/modules/producao/README.md`
- `.context/modules_old/modules/dashboard/README.md`

## Regras de negocio preservadas

- `clientes_cadastro` e o cadastro operacional unico de clientes.
- Criacao simples de cliente envia `nomecliente.trim().toUpperCase()` e normaliza `name_normalized`.
- O codigo do cliente pode ser gerado automaticamente; a UI legada envia apenas nome.
- Cliente pode ser arquivado/desarquivado por `is_archived` e `archived_at`; exclusao remove dependencias antes do cadastro.
- `prazoStatus` e contrato compartilhado com Dashboard e filtros de Clientes.
- Filtros vindos do Dashboard devem continuar alinhados: `insatisfeitos`, `vence_hoje`, `prazos_atrasados`, `sem_resposta`.
- Sidebar/detalhe de cliente cruza atendimento, producao, pipeline, briefing, pecas, calendario, comentarios, responsaveis e dados comerciais; mudancas nesse contrato tem alto impacto.

## Supabase, RPCs e dados

| Recurso | Papel |
| ------- | ----- |
| `clientes_cadastro` | Tabela base do cadastro operacional |
| `v_clientes_lista_base` | View base da listagem |
| `get_clientes_lista_page(...)` | RPC paginada com filtros, ordenacao e dados derivados |
| `get_clientes_metrics(...)` | RPC de metricas da lista |
| `client_pipeline_stages` | Etapa atual/pipeline do cliente |
| `conversations` | Conversa vinculada e classificacao IA |
| `production_tasks` | Task/producao mais recente vinculada |
| `profiles` | Responsaveis e nomes exibidos |

## RLS e autorizacao

- `get_clientes_lista_page` e views relacionadas devem operar com `security invoker` para respeitar RLS.
- Policies de update em `clientes_cadastro` ja tiveram ajustes historicos; revisar migrations antes de alterar campos editaveis.
- Arquivamento, exclusao e edicao devem respeitar role/permissao operacional.

## Lacunas de validacao

- Confirmar se a RPC vigente continua sendo `get_clientes_lista_page`.
- Validar se `responsavel_atendimento`, `current_stage_id`, `prazo_final` e `classificacao` continuam com os mesmos nomes no schema atual.
- Validar dependencias removidas no fluxo de exclusao antes de permitir delete fisico.
