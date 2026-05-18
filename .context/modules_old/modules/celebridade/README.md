# Modulo Celebridade

Documentacao tecnica do modulo Celebridade.

Ultima atualizacao: 2026-05-11

## Objetivo

O modulo Celebridade gerencia a etapa de aprovacao de pecas por celebridade/referencia. Ele permite acompanhar clientes em aprovacao, registrar aprovacoes e reprovacoes de pecas, enviar notificacoes internas, solicitar troca de celebridade e gerar relatorio agrupado por celebridade.

A tela principal fica em `/celebridade` e possui dois modos:

- kanban operacional;
- relatorio por celebridade.

## Principais caminhos

| Area                       | Caminho                                                                       | Papel                                                         |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Rota principal             | `src/app/(auth)/celebridade/page.tsx`                                         | Orquestra filtros, kanban e relatorio                         |
| Hook de aprovacoes         | `src/hooks/use-celebrity-approvals.ts`                                        | Busca clientes/pecas e executa mutacoes de aprovacao          |
| Hook de relatorio          | `src/hooks/use-celebrity-report.ts`                                           | Agrega dados por celebridade e exporta CSV                    |
| Componentes do modulo      | `src/components/celebridade/`                                                 | Cards, modal de detalhe, filtros, itens de peca e relatorio   |
| Referencias de celebridade | `supabase/migrations/20260210180000_create_celebridades_referencia.sql`       | Tabela `"celebridadesReferencia"`                             |
| Links em clientes          | `supabase/migrations/20260430150613_add_client_celebrity_links_compat.sql`    | Campos de pasta estatica/video no cliente                     |
| Links em tarefas           | `supabase/migrations/20260430150614_add_celebrity_links_to_tasks.sql`         | Campos de pasta estatica/video em tasks de celebridade        |
| Limpeza por tipo de peca   | `supabase/migrations/20260430160000_cleanup_celebrity_links_by_peca_type.sql` | Remove links inconsistentes conforme tipo da peca             |
| Troca solicitada           | `supabase/migrations/20260227100000_add_troca_celebridade_solicitada.sql`     | Flag `troca_celebridade_solicitada` em clientes               |
| Tipos Supabase             | `src/types/supabase.ts`                                                       | Tipos de `celebrity_approvals` e `celebrity_approval_history` |

## Funcionamento geral

1. Usuario acessa `/celebridade`.
2. A pagina carrega clientes por status operacional:
   - `useCelebrityClients('pendente')`;
   - `useCelebrityClients('aprovado')`;
   - `useCelebrityClients('concluido', limit)`.
3. Tambem carrega estatisticas, relatorio e lista de celebridades ativas.
4. Filtros locais permitem buscar por texto, celebridade e apenas urgentes.
5. No modo kanban, os clientes sao distribuidos em colunas.
6. O modal de detalhe permite aprovar/reprovar pecas e registrar comentarios.
7. Ao finalizar aprovacoes, o fluxo pode mover tarefas para a etapa `aprovado-celebridade`.
8. No modo relatorio, os dados sao agrupados por celebridade e podem ser exportados em CSV.

## Colunas do kanban

| Coluna visual      | Origem principal                                      | Sentido operacional                               |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------- |
| Pendente           | tasks em etapa `celebridade` com aprovacoes pendentes | Pecas aguardando primeira acao                    |
| Aguardando Retorno | aprovacoes `em_analise` ou `aguardando_retorno`       | Peca enviada/avaliada, aguardando retorno externo |
| Realizado          | tasks em `aprovado-celebridade`                       | Aprovacao concluida no fluxo de celebridade       |
| Concluido          | tasks em `finalizado` com aprovacoes relacionadas     | Cliente/pecas encerrados no pipeline              |

Na tela, o conjunto `pendente` e dividido em `pendente` puro e `em_analise` conforme `approval_stats`.

## Status de aprovacao

Valores tratados pelo hook:

| Status               | Uso                                             |
| -------------------- | ----------------------------------------------- |
| `pendente`           | Peca enviada para aprovacao e ainda sem decisao |
| `em_analise`         | Peca marcada como em analise                    |
| `aguardando_retorno` | Peca aguardando resposta externa                |
| `aprovado`           | Peca aprovada                                   |
| `reprovado`          | Peca rejeitada, com motivo e anexos opcionais   |

## Hooks principais

Arquivo: `src/hooks/use-celebrity-approvals.ts`

### `useCelebrityClients(filter?, limit?)`

Busca clientes, tasks, pecas, aprovacoes, responsaveis e celebridades para montar `CelebrityClientWithApprovals`.

Entradas comuns:

- `pendente`;
- `aprovado`;
- `concluido`.

Tabelas consultadas:

- `production_tasks`;
- `clientes_cadastro`;
- `client_pipeline_stages`;
- `task_pecas`;
- `kanban_pecas`;
- `celebrity_approvals`;
- `profiles`;
- `"celebridadesReferencia"`.

### Mutations de aprovacao

| Hook                         | Operacao principal                                                              |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `useSubmitForApproval`       | Arquiva aprovacoes antigas, faz upsert de `celebrity_approvals` como `pendente` |
| `useApprovePeca`             | Marca aprovacao como `aprovado`, grava reviewer e nota                          |
| `useRejectPeca`              | Marca aprovacao como `reprovado`, grava motivo/anexos/reviewer                  |
| `useMarkAsAguardandoRetorno` | Atualiza status para aguardando retorno                                         |
| `useMarkAsEmAnalise`         | Atualiza status para em analise                                                 |
| `useAddPecaComment`          | Persiste comentario em aprovacao                                                |
| `useMarkAllAsRealizado`      | Aprova pendencias restantes e move tasks para `aprovado-celebridade`            |

### Troca de celebridade

Hooks relacionados:

- `useRequestCelebrityChange`;
- `useCancelCelebrityChangeRequest`;
- `useChangeCelebrityFromApprovalScreen`.

Contrato importante: a flag `clientes_cadastro.troca_celebridade_solicitada` sinaliza pedido aberto.

## Notificacoes

O helper interno `createApprovalNotifications` insere registros em `system_notifications`.

Destinatarios comuns:

- responsavel pelo cliente/tarefa;
- usuarios admin;
- usuarios da especialidade `celebridade`, conforme o fluxo.

Ao alterar o fluxo, revisar tambem o modulo Notificacoes para garantir que o tipo de notificacao e exibido corretamente.

## Relatorio

Arquivo: `src/hooks/use-celebrity-report.ts`

Responsabilidades:

- buscar celebridades ativas em `"celebridadesReferencia"`;
- agregar clientes, pecas e aprovacoes;
- contar pecas por status;
- calcular totais por celebridade;
- exportar CSV com BOM para compatibilidade com Excel.

Campos considerados no relatorio incluem:

- vigencia;
- contrato;
- primeira entrega;
- total de pecas;
- aprovacoes pendentes/aprovadas/reprovadas;
- links e referencias associadas.

## Banco de dados

Tabelas centrais:

| Tabela                       | Papel                                                               |
| ---------------------------- | ------------------------------------------------------------------- |
| `"celebridadesReferencia"`   | Cadastro/importacao das celebridades de referencia                  |
| `clientes_cadastro`          | Cliente, celebridade atual, flags e links de pasta                  |
| `production_tasks`           | Tasks em etapas `celebridade`, `aprovado-celebridade`, `finalizado` |
| `kanban_pecas`               | Pecas ligadas a tasks/clientes                                      |
| `task_pecas`                 | Associacao entre task e peca                                        |
| `celebrity_approvals`        | Estado atual de aprovacao por peca/task/cliente                     |
| `celebrity_approval_history` | Historico de aprovacoes arquivadas                                  |
| `system_notifications`       | Notificacoes geradas pelo fluxo                                     |

Tabela `"celebridadesReferencia"`:

Campos relevantes:

- `nome`;
- `ativo`;
- `fotoMobile`;
- `fotoPrincipal`;
- `fotoSecundaria`;
- `nomeJuridico`;
- `nivel`;
- `gruponovo`;
- `sgc_uuid`;
- `csv_imported`;
- `instagram_followers`;
- `description`.

## RLS e permissoes

A migration de `"celebridadesReferencia"` permite leitura para `authenticated` e `anon`, e controle total para service role.

As demais tabelas dependem de suas policies proprias. O modulo faz leituras amplas em tasks, clientes, pecas, profiles e aprovacoes. Antes de restringir acesso, validar:

- listagem do kanban;
- modal de detalhe;
- aprovar/reprovar peca;
- relatorio;
- notificacoes.

## Pontos de atencao

- As migrations de criacao de `celebrity_approvals` e `celebrity_approval_history` nao apareceram no mapeamento local, embora os tipos existam em `src/types/supabase.ts`. Antes de recriar ou alterar schema, conferir o estado real do banco.
- O modulo depende de slugs de pipeline: `celebridade`, `aprovado-celebridade` e `finalizado`.
- `useMarkAllAsRealizado` altera aprovacoes e etapa de tasks; tratar como operacao de fluxo, nao apenas UI.
- Links de pasta de video/estatica existem tanto em cliente quanto em task. As migrations mais recentes fazem backfill e limpeza por tipo de peca.
- Notificacoes podem duplicar ruido se mutacoes forem reexecutadas sem cuidado.
- Relatorio e kanban usam leituras diferentes; ao corrigir um numero, revisar ambos.

## Checklist de validacao

- Abrir `/celebridade` e verificar colunas Pendente, Aguardando Retorno, Realizado e Concluido.
- Filtrar por busca, celebridade e urgencia.
- Abrir modal de cliente e conferir pecas vinculadas.
- Enviar peca para aprovacao.
- Aprovar peca e confirmar mudanca de status.
- Reprovar peca com motivo e confirmar notificacao.
- Marcar tudo como realizado e confirmar etapa `aprovado-celebridade`.
- Solicitar/cancelar troca de celebridade.
- Abrir aba de relatorio e exportar CSV.
- Conferir notificacoes no modulo Notificacoes.
