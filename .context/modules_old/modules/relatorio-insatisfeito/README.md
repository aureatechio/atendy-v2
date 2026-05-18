# Modulo Relatorio Insatisfeito

## Objetivo

O modulo Relatorio Insatisfeito centraliza o historico de clientes/conversas classificados como `Insatisfeito`, seja pela IA de atendimento ou por registro manual. Ele serve para acompanhamento gerencial: ver quem entrou no estado de insatisfacao, quantas vezes reincidiu, qual responsavel estava associado e quando a ocorrencia foi resolvida.

O entregavel de produto esta em `/relatorio-insatisfeito`. A tela nao usa uma RPC dedicada: ela monta o relatorio no frontend a partir de `conversation_tag_history` e tabelas auxiliares.

## Arquivos principais

| Area               | Arquivo                                             | Papel                                                             |
| ------------------ | --------------------------------------------------- | ----------------------------------------------------------------- |
| Pagina             | `src/app/(auth)/relatorio-insatisfeito/page.tsx`    | UI, filtros, agrupamento, paginacao e mutacoes manuais            |
| Hook de dados      | `src/hooks/use-insatisfeito-report.ts`              | Busca historico, conversas, analises e clientes em lotes          |
| Menu               | `src/components/layout/user-menu.tsx`               | Link para `/relatorio-insatisfeito` visivel para admin/supervisor |
| Rotulo de presenca | `src/lib/presence/route-labels.ts`                  | Nome exibido para a rota                                          |
| IA                 | `supabase/functions/analyze-conversation/index.ts`  | Classifica conversas e registra entradas/saidas no historico      |
| Resolucao IA       | `src/hooks/use-ai-analysis.ts`                      | Remove flag de IA e grava `conversation_tag_history`              |
| Tags manuais       | `src/hooks/use-tags.ts`                             | Grava historico quando tags sao adicionadas/removidas             |
| Relatorio diario   | `supabase/functions/daily-report-whatsapp/index.ts` | Usa a metrica de conversas atualmente insatisfeitas               |

## Fluxo funcional da tela

1. O usuario acessa `/relatorio-insatisfeito` pelo menu do usuario.
2. A pagina chama `useInsatisfeitoReport()` com filtros opcionais de data e busca.
3. O hook busca a tag `Insatisfeito` em `tags`.
4. O hook busca todas as paginas de `conversation_tag_history`, filtrando por `tag_id` quando encontrado ou por `ai_classification = 'Insatisfeito'` como fallback.
5. O hook enriquece os registros com dados de `conversations`, `conversation_ai_analyses` e `clientes_cadastro`.
6. A pagina agrupa os itens por prioridade de chave: `cliente_id`, depois telefone da conversa, depois `conversation_id`.
7. Cada grupo vira uma linha de cliente com total de entradas, responsavel mais recente, resumo e status.
8. Ao expandir uma linha, a pagina exibe uma linha do tempo de sessoes.

### Sessoes

As sessoes sao calculadas em `buildSessions()` usando FIFO:

- cada evento `added` entra numa fila;
- cada evento `removed` fecha o primeiro `added` pendente;
- `added` sem `removed` vira sessao ativa;
- as sessoes sao exibidas da mais recente para a mais antiga.

Esse pareamento e importante: se uma rotina inserir `removed` sem a mesma granularidade de `added`, o relatorio pode mostrar sessoes ativas ou resolvidas de forma inesperada.

## Operacoes do usuario

### Registrar insatisfacao manual

A pagina permite buscar um cliente por nome em `clientes_cadastro`, selecionar um cliente e informar o motivo. Ao registrar, ela:

- busca `clientes_cadastro.id, whatsapp`;
- tenta localizar uma conversa por `conversations.phone = cliente.whatsapp`;
- insere em `conversation_tag_history`:

```ts
{
  action: 'added',
  source: 'manual',
  ai_classification: 'Insatisfeito',
  cliente_id,
  conversation_id,
  tag_id,
  ai_summary_snapshot: motivo || null,
}
```

Atencao: esse fluxo registra o historico, mas nao atualiza diretamente `conversations.ai_classification` nem cria/atualiza `conversation_tags`.

### Resolver insatisfacao

Quando ha sessoes ativas e o grupo tem `clienteId`, a pagina insere um `removed` manual para cada sessao ativa:

```ts
{
  action: 'removed',
  source: 'manual',
  ai_classification: 'Insatisfeito',
  cliente_id,
  tag_id,
  ai_summary_snapshot: 'Resolvido manualmente',
}
```

Atencao: esse fluxo nao inclui `conversation_id` nos registros de resolucao da propria pagina. O agrupamento ainda funciona por `cliente_id`, mas agentes devem considerar isso antes de mudar regras que dependam de conversa.

### Excluir registros manuais

A acao `Excluir` remove todos os registros de `conversation_tag_history` daquele `cliente_id` com `source = 'manual'`. Ela nao remove registros de IA.

## Consultas e contratos de dados

### `InsatisfeitoReportItem`

O hook retorna itens normalizados com estes campos:

| Campo                                             | Origem principal                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `id`, `created_at`, `action`, `source`            | `conversation_tag_history`                                          |
| `ai_classification`                               | `conversation_tag_history.ai_classification`                        |
| `responsible_user_id`, `responsible_user_name`    | snapshot no historico                                               |
| `cliente_id`                                      | `conversation_tag_history.cliente_id` ou `conversations.cliente_id` |
| `cliente_code`, `cliente_name`                    | `clientes_cadastro`                                                 |
| `conversation_phone`, `conversation_contact_name` | `conversations`                                                     |
| `conversation_id`                                 | `conversation_tag_history.conversation_id`                          |
| `ai_summary`                                      | `ai_summary_snapshot`, analise proxima, ou cache da conversa        |

### Busca paginada

`fetchAllPages()` usa paginas de 1000 linhas em `conversation_tag_history`, ordenadas por `created_at DESC`. Para volumes grandes, a tela pode carregar bastante dado no cliente antes de filtrar por responsavel.

### Enriquecimento em lote

`batchIn()` divide ids em lotes de 200 para evitar URLs/queries grandes no Supabase. Ele consulta:

- `conversations`: `id, phone, name, ai_summary, ai_resumo_alerta, cliente_id`;
- `conversation_ai_analyses`: analises `classification = 'Insatisfeito'`, ordenadas por `created_at DESC`;
- `clientes_cadastro`: `id, code, nomecliente, whatsapp`.

### Resumo exibido

A prioridade do resumo e:

1. `conversation_tag_history.ai_summary_snapshot`;
2. analise `Insatisfeito` mais proxima em ate 10 minutos do evento;
3. `conversations.ai_resumo_alerta`;
4. `conversations.ai_summary`.

## Banco de dados

### Tabelas e colunas relevantes

| Tabela                     | Uso no modulo                                                        |
| -------------------------- | -------------------------------------------------------------------- |
| `conversation_tag_history` | Fonte principal do relatorio historico                               |
| `tags`                     | Resolve o `tag_id` da tag `Insatisfeito`                             |
| `conversations`            | Dados de contato, cliente vinculado e cache da classificacao atual   |
| `conversation_ai_analyses` | Historico de analises usado como fallback de resumo                  |
| `clientes_cadastro`        | Nome/codigo do cliente e WhatsApp                                    |
| `profiles`                 | Nome do responsavel gravado como snapshot por outros fluxos          |
| `conversation_tags`        | Estado atual de tags em conversas; nao e a fonte principal da pagina |

### Migrations relevantes

- `supabase/migrations/20260203150000_ai_analysis_system.sql`: cria campos de IA em `conversations`, tabela `conversation_ai_analyses` e policy da tabela de analises.
- `supabase/migrations/20260219145959_create_conversation_tag_history_compat.sql`: cria `conversation_tag_history`, indice por `conversation_id` e habilita RLS.
- `supabase/migrations/20260219150000_add_ai_summary_to_tag_history.sql`: adiciona `ai_summary_snapshot`.
- `supabase/migrations/20260505132000_clientes_metrics_rpc.sql`: conta `conversations.ai_classification = 'Insatisfeito'` para metricas de clientes.
- `supabase/migrations/20260505200000_fix_conversation_tag_history_schema_rls.sql`: completa o schema usado pelo codigo atual, adiciona constraints/indices e versiona policies RLS.

### Correcao de schema versionada

O codigo usa colunas de `conversation_tag_history` que nao aparecem na migration `20260219145959_create_conversation_tag_history_compat.sql`:

- `cliente_id`;
- `source`;
- `ai_classification`;
- `responsible_user_id`;
- `responsible_user_name`;
- `ai_summary_snapshot`.

A migration `20260505200000_fix_conversation_tag_history_schema_rls.sql` corrige essa deriva de schema com `ADD COLUMN IF NOT EXISTS`, constraints `NOT VALID` para ambientes com dados existentes e indices para os caminhos principais do relatorio.

### RLS

`conversation_tag_history` tem RLS habilitado. A migration `20260505200000_fix_conversation_tag_history_schema_rls.sql` cria as policies versionadas:

- `conversation_tag_history_select_reports`: leitura para admin/supervisor;
- `conversation_tag_history_insert_manual`: insercao manual para usuarios ativos, limitada a `source = 'manual'`;
- `conversation_tag_history_delete_manual_reports`: exclusao de historico manual para admin/supervisor.

As policies usam helpers `SECURITY DEFINER` (`public.is_admin_or_supervisor()` e `public.is_active_user()`) para evitar recursao em RLS, conforme regra do `AGENTS.md`.

## Integracoes e Edge Functions

### `analyze-conversation`

A Edge Function classifica conversas em `Insatisfeito` ou `Normal`. Quando a classificacao muda:

- remove tag IA anterior em `conversation_tags` quando aplicavel;
- registra `removed` em `conversation_tag_history`;
- se a nova classificacao nao for `Normal`, adiciona/upserta a tag em `conversation_tags`;
- registra `added` em `conversation_tag_history` com `source = 'ai'`, responsavel e resumo snapshot.

Regra de negocio do prompt: ajuste sem irritacao ou critica clara deve ser `Normal`; `Insatisfeito` deve ser usado apenas para reclamacao/critica real.

### `useResolveAiFlag`

Esse hook limpa os campos de IA de uma conversa, remove tags IA e registra `removed` manual em `conversation_tag_history`. Tambem grava `ai_classification_logs`. Ele e usado pelo fluxo de monitoramento/resolucao de alertas de IA.

### `use-tags`

Adicionar/remover tags pelo chat tambem tenta registrar `conversation_tag_history`. O historico e nao-bloqueante nesses hooks: falha no insert do historico nao impede o fluxo principal de tag.

### `daily-report-whatsapp`

O relatorio diario WhatsApp nao usa `conversation_tag_history`. Ele conta conversas com:

- `conversations.ai_classification = 'Insatisfeito'`;
- `is_archived = false`;
- `is_group = false`.

Isso significa que o relatorio diario mede o estado atual da conversa, enquanto `/relatorio-insatisfeito` mede historico de eventos. Registros manuais feitos na pagina podem aparecer no relatorio historico sem alterar a contagem diaria.

## Regras de negocio

- `Insatisfeito` e uma classificacao de risco/insatisfacao real, nao um pedido comum de ajuste.
- `Normal` nao deve gerar tag de IA.
- O historico deve registrar transicoes, nao apenas estado atual.
- `source` distingue entradas de IA e manuais.
- O responsavel e salvo como snapshot (`responsible_user_name`) para preservar contexto mesmo que o perfil mude depois.
- A UI considera ativo qualquer grupo com sessao sem `exitedAt`.
- A busca de cliente no formulario manual exige pelo menos 2 caracteres.
- O filtro de responsavel e aplicado no frontend, depois da busca dos dados.

## Permissoes e acesso

O item de menu aparece para `isAdmin || isSupervisor`. Essas flags vem de `useAuth()` com base em `profiles.role`.

A rota `/relatorio-insatisfeito` nao esta listada em `adminRoutes` no `src/proxy.ts`; portanto, o proxy exige apenas sessao autenticada e deixa autorizacao fina para UI/RLS. Se o relatorio precisar ser estritamente admin/supervisor, adicionar guarda explicita na pagina, no proxy ou por RLS.

Existe tambem a permissao JSON `can_view_reports` em `profiles.permissions`, mas este modulo nao a usa diretamente.

## Pontos de atencao

- A rota ainda nao tem guarda server-side propria; o acesso ao dado fica protegido por RLS e o menu so exibe para admin/supervisor.
- Se algum fluxo de cliente tentar inserir historico com `source = 'ai'`, sera bloqueado por RLS; eventos de IA devem usar service role.
- A tag `Insatisfeito` precisa existir em `tags`; se nao existir, o hook usa fallback por `ai_classification`.
- O seed antigo de IA menciona tags legadas (`Reclamacao`, `Aguardando Ajuste`, `Solicitado Ajuste`), mas o codigo atual usa `Insatisfeito` e `Normal`.
- `use-insatisfeito-report.ts` busca todos os registros por periodo antes de filtrar responsavel; isso pode ficar caro com historico grande.
- Resolver pela pagina grava `removed` sem `conversation_id`; mudar agrupamento para depender apenas de conversa pode quebrar resolucoes manuais existentes.
- Registro manual nao sincroniza `conversations.ai_classification`; o relatorio diario e cards que usam estado atual podem divergir do historico.
- Excluir remove todos os registros manuais do cliente, nao apenas uma sessao especifica.

## Como testar ou validar

### Validacao local de codigo

Para mudancas de documentacao, um check leve e suficiente:

```bash
npm run type-check
```

Para mudancas de codigo no modulo:

```bash
npm run build
npm run test
```

### Validacao funcional no browser

1. Entrar com usuario admin ou supervisor.
2. Abrir `/relatorio-insatisfeito`.
3. Confirmar que registros `Insatisfeito` aparecem agrupados por cliente.
4. Testar busca por nome, codigo e telefone.
5. Testar filtro de data.
6. Testar filtro de responsavel em registros que tenham `responsible_user_id`.
7. Expandir um cliente e validar entradas/saidas na timeline.
8. Registrar insatisfacao manual para um cliente de teste.
9. Confirmar novo evento `added` em `conversation_tag_history`.
10. Clicar em `Resolver` e confirmar evento `removed`.
11. Validar que a sessao ficou como resolvida.
12. Testar exclusao apenas em dados manuais de teste.

### Validacao de IA

1. Gerar ou selecionar conversa que a IA classificou como `Insatisfeito`.
2. Confirmar `conversations.ai_classification = 'Insatisfeito'`.
3. Confirmar existencia de linha `added` em `conversation_tag_history`.
4. Resolver/reclassificar como `Normal`.
5. Confirmar linha `removed` correspondente.
6. Verificar logs de `analyze-conversation` em caso de divergencia.

### Sanidade Supabase

Execute no SQL editor ou via ferramenta de banco do projeto:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'conversation_tag_history'
order by ordinal_position;
```

Tambem confira policies:

```sql
select policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename = 'conversation_tag_history';
```

## Referencias relacionadas

- `.context/docs/README.md`
- `.context/agents/README.md`
- `docs/AI_ANALYSIS_SYSTEM.md`
- `AGENTS.md`, secoes de RLS e Edge Functions
