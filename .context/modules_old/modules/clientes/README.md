# Modulo Clientes

Documentacao tecnica do modulo Clientes.

Ultima atualizacao: 2026-05-11

## Objetivo

O modulo Clientes e o cadastro operacional de clientes do produto. Ele combina listagem paginada, filtros, metricas, pipeline, eventos, sidebar de detalhes, criacao simples, edicao de dados comerciais/producao, arquivamento e exclusao.

A tela principal fica em `/clientes`.

## Principais caminhos

| Area                  | Caminho                                                                                                                  | Papel                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Rota principal        | `src/app/(auth)/clientes/page.tsx`                                                                                       | Orquestra lista, filtros, modais, sidebar e query params        |
| Hooks de clientes     | `src/hooks/use-clientes.ts`                                                                                              | Listagem, metricas, detalhe, criacao, update, archive e delete  |
| Componentes do modulo | `src/components/clientes/`                                                                                               | Tabela, filtros, sidebar, pipeline, eventos e secoes auxiliares |
| Modal de criacao      | `src/components/clientes/add-cliente-modal.tsx`                                                                          | Cria cliente a partir do nome                                   |
| Sidebar de detalhes   | `src/components/clientes/cliente-details-sidebar.tsx`                                                                    | Exibe/edita dados, atendimento, producao, timeline e calendario |
| RPC de listagem base  | `supabase/migrations/20260505120000_clientes_lista_page_rpc.sql`                                                         | View base e primeira versao da RPC                              |
| RPC de metricas       | `supabase/migrations/20260505132000_clientes_metrics_rpc.sql`                                                            | Cards de metricas da lista                                      |
| RPC lazy/filtros      | `supabase/migrations/20260505140000_clientes_lista_lazy_filters_rpc.sql`                                                 | Filtros e ordenacao no banco                                    |
| Tabela base           | `supabase/migrations/20260203200000_create_clientes_cadastro.sql`                                                        | Cria `clientes_cadastro`                                        |
| Policies de update    | `supabase/migrations/20260205170000_fix_clientes_update_policy.sql` e `20260205180000_fix_clientes_update_policy_v2.sql` | Ajustes historicos de update                                    |
| Tipos Supabase        | `src/types/supabase.ts`                                                                                                  | Tipos de cliente, conversa, pipeline e joins                    |

## Funcionamento geral

1. Usuario acessa `/clientes`.
2. A pagina le query params `cliente_id` e `dashboard_filter`.
3. Filtros ficam no store `useFiltersStore`.
4. `useClientes(options)` chama RPC paginada `get_clientes_lista_page`.
5. `ClientesTable` renderiza os resultados com infinite loading.
6. Clique em cliente abre `ClienteDetailsSidebar`.
7. A pagina pode alternar entre lista, pipeline e eventos.
8. Criacao usa `AddClienteModal`.
9. Arquivar/desarquivar e excluir chamam mutations de `use-clientes.ts`.

## Query params

| Parametro          | Uso                               |
| ------------------ | --------------------------------- |
| `cliente_id`       | Abre sidebar do cliente informado |
| `dashboard_filter` | Aplica filtro vindo do Dashboard  |

Valores de `dashboard_filter`:

| Valor              | Efeito em Clientes                           |
| ------------------ | -------------------------------------------- |
| `insatisfeitos`    | Filtra etiqueta/classificacao `Insatisfeito` |
| `vence_hoje`       | Filtra `prazoStatus = vence_hoje`            |
| `prazos_atrasados` | Filtra `prazoStatus = atrasado`              |
| `sem_resposta`     | Filtra clientes com conversa sem resposta    |

## Visualizacoes

| Modo       | Componente principal | Uso                                             |
| ---------- | -------------------- | ----------------------------------------------- |
| `lista`    | `ClientesTable`      | Cadastro tabular com filtros e infinite loading |
| `pipeline` | `PipelineView`       | Agrupamento por etapa do cliente/pipeline       |
| `eventos`  | `EventsListView`     | Eventos/calendario relacionados a clientes      |

## Hooks principais

Arquivo: `src/hooks/use-clientes.ts`

### `useClientes(options)`

Chama RPC `get_clientes_lista_page`.

Caracteristicas:

- infinite query;
- page size 50;
- ordenacao padrao `code desc`;
- filtros enviados para o banco;
- retorno com `items`, `total`, `has_more` e `next_offset`.

Query key:

```ts
;['clientes', options]
```

Filtros suportados na camada RPC:

- busca por nome, codigo, telefone ou celebridade;
- arquivados;
- etapas;
- classificacoes;
- etiquetas/classificacao IA;
- responsaveis;
- periodo de prazo;
- status de prazo;
- sem resposta;
- vigencia;
- segmento;
- ordenacao por codigo, nome, criacao, prazo ou ultima mensagem.

### `useClientesMetrics()`

Chama RPC `get_clientes_metrics`.

Metricas retornadas:

- total;
- sem resposta;
- insatisfeitos;
- prazos vencem hoje;
- prazos atrasados.

### `useCliente(clienteId)`

Busca detalhe de um cliente e agrega:

- conversa associada;
- resumo/classificacao IA;
- etapa atual;
- task/producao mais recente;
- responsavel de atendimento;
- status de prazo.

### Mutations

| Hook                | Operacao                                                                |
| ------------------- | ----------------------------------------------------------------------- |
| `useCreateCliente`  | Insere `nomecliente` e `name_normalized`; `code` e opcional             |
| `useUpdateCliente`  | Atualiza campos basicos, producao, classificacao, praca, pronuncia etc. |
| `useArchiveCliente` | Atualiza `is_archived` e `archived_at`                                  |
| `useDeleteCliente`  | Remove dependencias e depois `clientes_cadastro`                        |

`useUpdateCliente` atualiza caches de detalhe/lista de forma otimista e invalida metricas.

## Criacao de cliente

Arquivo: `src/components/clientes/add-cliente-modal.tsx`

Fluxo:

1. Usuario informa `nomecliente`.
2. Modal envia `nomecliente.trim().toUpperCase()`.
3. `useCreateCliente` normaliza `name_normalized`.
4. Insert acontece em `clientes_cadastro`.
5. Lista e metricas sao invalidadas.

Observacao: o modal informa que o codigo sera gerado automaticamente. O hook aceita `code` opcional, mas a UI atual envia apenas nome.

## Sidebar de detalhes

Arquivo: `src/components/clientes/cliente-details-sidebar.tsx`

Tabs:

- dados;
- producao;
- timeline;
- calendario.

Integra muitos dominios:

- conversa e criacao de conversa;
- envio de mensagem;
- resumo/classificacao IA;
- pipeline de cliente;
- briefing;
- cores;
- banco de imagens;
- referencias visuais;
- comentarios;
- calendario;
- tasks de cliente;
- pecas;
- segmentos/subsegmentos/negocios;
- responsavel de atendimento;
- telefones adicionais;
- pronuncia;
- dados comerciais.

Por ser um ponto de cruzamento, alteracoes no sidebar costumam exigir validacao em Chat, Producao, Pipeline e Eventos.

## RPC de listagem

View base:

`public.v_clientes_lista_base`

Criada em:

`supabase/migrations/20260505120000_clientes_lista_page_rpc.sql`

Caracteristicas:

- `security_invoker = true`;
- junta cliente com etapa atual e responsavel de atendimento;
- expande campos usados pela lista.

RPC vigente:

`public.get_clientes_lista_page(...)`

Atualizada em:

`supabase/migrations/20260505140000_clientes_lista_lazy_filters_rpc.sql`

Caracteristicas:

- `security invoker`;
- `stable`;
- busca/filtros/ordenacao no banco;
- lazy loading por offset;
- joins laterais para conversa, task mais recente, producao e foto de celebridade;
- calcula `prazoStatus`;
- retorna JSONB.

Campos derivados importantes:

- `conversation`;
- `hasConversation`;
- `lastMessageAt`;
- `lastCustomerMessageAt`;
- `lastAgentMessageAt`;
- `aiSummary`;
- `aiClassification`;
- `stageName`;
- `stageColor`;
- `stageSlug`;
- `assignedToName`;
- `productionStatus`;
- `responsavelAtendimentoName`;
- `prazoStatus`;
- `tasks`;
- `celebridadeFoto`.

## RPC de metricas

Funcao:

`public.get_clientes_metrics(p_show_archived boolean default null)`

Criada em:

`supabase/migrations/20260505132000_clientes_metrics_rpc.sql`

Regras:

- total baseado em `clientes_cadastro`;
- insatisfeitos por `conversations.ai_classification = 'Insatisfeito'`;
- sem resposta com mesma logica de +2h, conversa nao resolvida e tolerancia de agente;
- prazos com base em `America/Sao_Paulo`;
- etapas finais nao contam como prazo vencido/atrasado.

## Banco de dados

Tabela central:

`clientes_cadastro`

Campos frequentemente usados:

- `id`;
- `code`;
- `nomecliente`;
- `name_normalized`;
- `whatsapp`;
- `link_pasta_drive`;
- `link_proposta`;
- `celebridade`;
- `current_stage_id`;
- `responsavel_atendimento`;
- `briefing`;
- `cores`;
- `banco_imagem`;
- `referencia_visual`;
- `prazo_final`;
- `classificacao`;
- `praca`;
- `pronuncia_texto`;
- `pronuncia_audio_url`;
- `locutor_genero`;
- `vigencia`;
- `segmento_id`;
- `subsegmento_id`;
- `negocio_id`;
- `is_archived`;
- `archived_at`.

Tabelas relacionadas:

- `conversations`;
- `production_tasks`;
- `client_pipeline_stages`;
- `client_productions`;
- `profiles`;
- `"celebridadesReferencia"`;
- `client_comments`;
- tabelas de segmentos/subsegmentos/negocios;
- telefones adicionais do cliente.

## Permissoes e RLS

A tabela base foi criada em `20260203200000_create_clientes_cadastro.sql` com RLS habilitado e policies historicamente permissivas, incluindo leitura autenticada ampla e insert publico.

A listagem atual usa view/RPC `security invoker`; portanto a RLS das tabelas subjacentes continua valendo.

Pontos de atencao:

- antes de endurecer RLS, validar listagem, detalhe, pipeline, eventos, Chat e Producao;
- novas policies nao devem consultar tabelas protegidas diretamente dentro de `USING`; usar helpers `SECURITY DEFINER`;
- updates de cliente ja tiveram migrations de correcao, entao mudancas em policy devem ser testadas com edicao real no sidebar.

## Arquivar e excluir

`useArchiveCliente`:

- atualiza `is_archived`;
- grava `archived_at` quando arquiva;
- limpa `archived_at` ao desarquivar;
- invalida lista e metricas.

`useDeleteCliente`:

1. remove `production_tasks` do cliente;
2. remove `conversations` vinculadas;
3. remove `client_comments`;
4. remove `clientes_cadastro`.

Ponto de atencao: exclusao e destrutiva e remove dependencias diretamente no cliente Supabase. Antes de ampliar dependencias, revisar cascatas/tabelas relacionadas.

## Integracoes com outros modulos

| Modulo       | Integracao                                                           |
| ------------ | -------------------------------------------------------------------- |
| Dashboard    | Abre `/clientes` com `dashboard_filter` para insatisfeitos e prazos  |
| Chat         | Conversas associadas por `cliente_id` ou telefone                    |
| Producao     | Tasks e etapa mais recente aparecem na lista/sidebar                 |
| Celebridade  | Campo `celebridade`, foto e flags de troca                           |
| Notificacoes | Eventos e fluxos de cliente podem gerar notificacoes em outras areas |

## Pontos de atencao

- A funcao local `filterClientes` em `page.tsx` ainda existe, mas a regra efetiva de lista vem da RPC.
- `whatsapp` e associacao com conversa afetam Chat; seguir regra de `zapId` ao criar conversas outbound.
- `prazoStatus` e usado por Dashboard e filtros de Clientes; manter logica alinhada com `get_clientes_metrics`.
- O sidebar e grande e acoplado; mudancas pequenas podem afetar varias tabs.
- Exclusao manual remove algumas dependencias, mas pode deixar outras tabelas relacionadas se novos vinculos forem criados sem atualizar o hook.

## Checklist de validacao

- Abrir `/clientes` e carregar mais paginas.
- Buscar por nome, codigo, telefone e celebridade.
- Aplicar filtros de etapa, classificacao, etiqueta, responsavel, prazo, vigencia e segmento.
- Ordenar por codigo, nome, criacao, prazo e ultima mensagem.
- Abrir cliente via clique e via `?cliente_id=`.
- Editar dados no sidebar e confirmar atualizacao sem flicker.
- Criar cliente novo pelo modal.
- Arquivar e desarquivar cliente.
- Testar filtros vindos do Dashboard.
- Conferir metricas de total, sem resposta, insatisfeitos e prazos.
- Antes de excluir cliente real, validar dependencias e ambiente.
