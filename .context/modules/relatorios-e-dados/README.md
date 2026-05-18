# Modulo Relatorios e Dados

Documentacao tecnica do modulo Relatorios e Dados.

Ultima atualizacao: 2026-05-15

## Objetivo

O modulo Relatorios e Dados e a camada atual de dashboards analiticos do Atendy V2. Ele transforma datasets de compras e funil em telas operacionais para leitura gerencial, com KPIs, filtros, ordenacao, paginacao, visualizacao de funil e exportacao CSV.

A aplicacao atual e um Next.js App Router com duas entradas principais: `/` para Compras Pagas e `/funil` para Funil de Producao. Os dados de compras ainda sao carregados de JSON local; o funil ja tem uma camada de API preparada para buscar dados via Supabase REST quando variaveis publicas estiverem configuradas.

Este modulo deve ser tratado como modulo pai. Os submodulos naturais sao:

- Compras Pagas: relatorio tabular e exportavel de compras;
- Funil de Producao: leitura de ocupacao, valor e gargalos por etapa;
- Relatorios de Atendimento: contexto antigo/especifico em `.context/modules/relatorios-atendimento/README.md`, ainda raso neste workspace e candidato a submodulo quando o codigo correspondente voltar a existir aqui.

## Principais caminhos

| Area | Caminho | Papel |
| ---- | ------- | ----- |
| Rota Compras Pagas | `app/page.tsx` | Server component que chama `getCompras()` e renderiza `ComprasDashboard` |
| Rota Funil de Producao | `app/funil/page.tsx` | Server component dinamico que chama `getFunilDados()` e renderiza `FunilDashboard` |
| Shell/navegacao | `components/layout/site-shell.tsx` | Menu lateral, titulo da pagina e navegacao entre `/` e `/funil` |
| Dashboard de compras | `components/dashboard/compras-dashboard.tsx` | KPIs, filtros, tabela, colunas, ordenacao, paginacao e CSV |
| Dashboard de funil | `components/dashboard/funil-dashboard.tsx` | KPIs, filtros de periodo, funil lateral SVG e detalhamento por etapa |
| Card de KPI | `components/dashboard/kpi-card.tsx` | Componente visual reutilizado nos dashboards |
| Dados locais de compras | `data/compras.json` | Fonte local com 396 registros de compras |
| Dados locais de funil | `data/funil.json` | Fonte local com 704 linhas de ocupacao, 20 etapas e mapa de valores |
| Loader local | `lib/data.ts` | Importa JSON local e expoe `getCompras()` / `getFunilDados()` |
| API de compras | `lib/api/compras.ts` | Camada de troca futura; hoje delega para `lib/data.ts` |
| API de funil | `lib/api/funil.ts` | Tenta Supabase REST e cai para JSON local em erro ou ausencia de env vars |
| Tipos | `lib/types.ts` | Contratos `Compra`, `FunilData`, `FunilRow`, `FunilStageMeta` e filtros |
| Metricas de compras | `lib/compras/computeMetrics.ts` | Calcula total, valor, media e sync Atendy |
| Metricas de funil | `lib/funil/computeMetrics.ts` | Calcula KPIs, resumo por etapa, valores deduplicados e gargalos |
| Periodos | `lib/period.ts` | Presets e range customizado para filtros de data |
| Utils | `lib/utils.ts` | Formatacao, normalizacao textual e parse de datas pt-BR |
| Filtros de compras | `hooks/useComprasFilters.ts` | Estado, opcoes, busca, filtros e ordenacao da tabela de compras |
| Filtros de funil | `hooks/useFunilFilter.ts` | Estado de periodo e escala visual/real do funil |
| Paginacao | `hooks/usePaginatedTable.ts` | Paginacao client-side compartilhada por tabelas |
| Testes | `test/*.test.ts` | Cobertura de metricas, filtros, paginacao e periodos |

## Funcionamento geral

1. Usuario acessa `/` ou `/funil`.
2. A rota server-side carrega os dados pela camada `lib/api/*`.
3. Para compras, `getCompras()` sempre usa JSON local via `lib/data.ts`.
4. Para funil, `getFunilDados()` tenta Supabase REST se `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` existirem; em falha, usa `data/funil.json`.
5. O dashboard recebe `initialData` e executa filtros e calculos no client.
6. KPIs sao recalculados com `useMemo` a partir das linhas filtradas.
7. Compras renderiza tabela paginada e permite exportar o conjunto filtrado para CSV.
8. Funil renderiza ocupacao por etapa, valor, tempo medio e destaque de gargalos.

## Entradas, rotas e query params

| Entrada | Uso |
| ------- | --- |
| `/` | Dashboard de Compras Pagas |
| `/funil` | Dashboard de Funil de Producao dentro do shell padrao |
| `/funil?view=full` | Renderiza `FunilDashboard` em wrapper mais simples, sem mudar os dados |

O menu principal em `components/layout/site-shell.tsx` hoje expoe apenas:

| Link | Label |
| ---- | ----- |
| `/` | `Compras Pagas` |
| `/funil` | `Funil de Producao` |

## Submodulos e reorganizacao sugerida

### Submodulo `compras-pagas`

Responsabilidade: listar compras pagas, aplicar filtros operacionais e permitir auditoria/exportacao.

Arquivos centrais:

- `app/page.tsx`;
- `components/dashboard/compras-dashboard.tsx`;
- `hooks/useComprasFilters.ts`;
- `hooks/usePaginatedTable.ts`;
- `lib/api/compras.ts`;
- `lib/compras/computeMetrics.ts`;
- `data/compras.json`;
- `test/compras-metrics.test.ts`;
- `test/compras-filters-pagination.test.ts`.

Este submodulo tem alta coesao: rota, filtros, metricas, tabela e exportacao CSV usam o contrato `Compra`.

### Submodulo `funil-producao-dados`

Responsabilidade: medir ocupacao e valor do funil de producao por etapa, com fonte local ou Supabase REST.

Arquivos centrais:

- `app/funil/page.tsx`;
- `components/dashboard/funil-dashboard.tsx`;
- `hooks/useFunilFilter.ts`;
- `lib/api/funil.ts`;
- `lib/funil/computeMetrics.ts`;
- `data/funil.json`;
- `test/funil-metrics.test.ts`.

Este submodulo deve concentrar qualquer evolucao de fonte remota, regras de gargalo, finalizacao e normalizacao de etapas.

### Submodulo `base-dados-e-periodos`

Responsabilidade: contratos, parse de datas, ranges, formatadores e camada de dados comum.

Arquivos centrais:

- `lib/types.ts`;
- `lib/data.ts`;
- `lib/period.ts`;
- `lib/utils.ts`;
- `test/period.test.ts`.

Este submodulo evita duplicacao entre compras e funil. Mudancas em datas ou formatos monetarios afetam os dois dashboards.

### Submodulo candidato `relatorios-atendimento`

Existe `.context/modules/relatorios-atendimento/README.md`, mas o documento atual e apenas uma descricao de alto nivel. Os documentos antigos em `.context/modules_old/modules/` mostram que relatorios de atendimento eram compostos por pelo menos:

- dashboard operacional `/dashboard`;
- painel admin `/admin` com metricas de atendimento/WhatsApp;
- relatorio de insatisfacao `/relatorio-insatisfeito`;
- dashboard de producao `/dashboard-producao` e `/dashboard-performance`.

Como este workspace atual nao contem os arquivos `src/app/(auth)/...` nem `supabase/migrations/` do app antigo, esse conteudo deve permanecer como submodulo historico/candidato ate haver codigo atual correspondente neste repositorio.

## Telas e componentes

### `app/page.tsx`

Rota raiz do modulo de compras.

Responsabilidades:

- chamar `getCompras()` em server component;
- passar os dados para `ComprasDashboard`;
- manter a pagina sem regra de filtro propria.

### `ComprasDashboard`

Arquivo: `components/dashboard/compras-dashboard.tsx`

Responsabilidades:

- manter estado de colunas visiveis;
- focar busca com `Cmd/Ctrl + K`;
- aplicar filtros via `useComprasFilters(initialData)`;
- paginar via `usePaginatedTable(rows)`;
- calcular KPIs via `computeComprasKpis(rows)`;
- ordenar colunas clicaveis;
- exportar CSV com apenas as colunas visiveis e linhas filtradas;
- renderizar estados vazio e tabela.

KPIs exibidos:

| KPI | Fonte |
| --- | ----- |
| Compras | Quantidade de linhas filtradas |
| Valor total | Soma de `valorTotalCompra` |
| Ticket medio | Soma dividida pela quantidade filtrada |
| Sync Atendy | Linhas com `atendySynced === true` |

Filtros atuais:

| Filtro | Campo |
| ------ | ----- |
| Busca textual | varios campos normalizados |
| Periodo | `dataCompra` |
| Tipo | `tipoVenda` |
| Pagamento | `statusPagamento` |
| Vendedor | `vendedor` |
| Celebridade | `celebridade` |
| Segmento | `segmento` |
| Etapa Atendy | `atendyStageName` |
| Sync | `atendySynced` |

Observacao: o estado `statusCompra` e `statusProducao` existe em `useComprasFilters`, mas a UI atual exibe filtro para `statusPagamento` e mostra `statusProducao` como coluna. Se forem adicionados filtros visuais para esses campos, manter o contrato ja existente no hook.

### `app/funil/page.tsx`

Rota do funil.

Responsabilidades:

- exportar `dynamic = "force-dynamic"`;
- chamar `getFunilDados()`;
- ler `searchParams.view`;
- renderizar `FunilDashboard`.

### `FunilDashboard`

Arquivo: `components/dashboard/funil-dashboard.tsx`

Responsabilidades:

- aplicar filtro de periodo via `useFunilFilter()`;
- filtrar `initialData.rows` por `FunilRow.a`;
- calcular KPIs e resumo por etapa via `computeFunilKpis(initialData, filteredRows)`;
- remover etapas finais da visualizacao principal;
- alternar escala `sqrt`/`linear`;
- renderizar funil lateral SVG com colunas por etapa;
- destacar gargalos;
- renderizar detalhamento por etapa.

KPIs exibidos:

| KPI | Fonte |
| --- | ----- |
| Clientes no funil | Clientes unicos em linhas filtradas |
| Valor no funil | Soma deduplicada por cliente usando `valor_map` |
| Finalizados | Clientes unicos em etapas `is_final` |
| Lead time medio | Media de `FunilRow.d` |

## Hooks, stores e contratos

### `useComprasFilters(data)`

Arquivo: `hooks/useComprasFilters.ts`

Caracteristicas:

- estado local com filtros e ordenacao;
- cria opcoes de filtro a partir dos valores unicos do dataset;
- usa `toDateRange()` e `isWithinRange()` para periodo;
- busca textual com `normalizeText()`;
- ordenacao estavel preservando indice original para empates;
- `sortDir = "none"` devolve a ordem filtrada original.

Estado principal:

```ts
{
  search: string
  period: PeriodPreset
  periodFrom: string
  periodTo: string
  tipoVenda: string
  statusPagamento: string
  statusCompra: string
  statusProducao: string
  vendedor: string
  celebridade: string
  segmento: string
  etapa: string
  sync: string
  sortKey: CompraColumnKey
  sortDir: SortDirection
}
```

### `useFunilFilter()`

Arquivo: `hooks/useFunilFilter.ts`

Caracteristicas:

- controla periodo e datas customizadas;
- controla escala visual do funil: `sqrt` ou `linear`;
- retorna `periodRange` ja convertido por `toDateRange()`.

### `usePaginatedTable(items, pageSizeOptions?)`

Arquivo: `hooks/usePaginatedTable.ts`

Caracteristicas:

- page size padrao: `[10, 25, 50, 100]`;
- corrige pagina quando a quantidade de itens muda;
- expoe `startIndex`, `endIndex`, `pagedItems`, `pageCount`, `setPage` e `setPageSize`;
- usado pelo dashboard de compras.

## APIs, fontes de dados e contratos

### `lib/api/compras.ts`

Hoje e uma camada fina:

```ts
export async function getCompras() {
  return getComprasLocal()
}
```

Contrato esperado:

- entrada: nenhuma;
- saida: `Promise<Compra[]>`;
- fonte atual: `data/compras.json`;
- ponto de troca futura: substituir a delegacao por chamada HTTP ou banco sem alterar `app/page.tsx`.

### `lib/api/funil.ts`

`getFunilDados()` tem duas fontes:

1. Supabase REST, quando `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` existem;
2. fallback local em `data/funil.json`.

Tabelas consultadas via REST:

| Tabela | Campos | Filtro |
| ------ | ------ | ------ |
| `client_pipeline_stages` | `id,name,slug,color,order_index,is_final` | `is_active=eq.true` |
| `production_tasks` | `id,cliente_id,pipeline_stage_id,status,started_at,created_at` | `pipeline_stage_id=not.is.null`, `status=neq.finalizado` |
| `clientes_cadastro` | `id,valor,deal_value,current_stage_id,stage_entered_at,created_at,is_archived` | `is_archived=eq.false` |

O carregamento usa paginas de 1000 linhas com header `Range`.

### Contrato `Compra`

Arquivo: `lib/types.ts`

Campos usados diretamente pelo dashboard:

| Campo | Uso |
| ----- | --- |
| `dataCompra` | Periodo, ordenacao e coluna |
| `numProposta` | Coluna e chave parcial de linha |
| `cliente` | Busca e coluna |
| `vendedor` | Filtro, busca e coluna |
| `celebridade` | Filtro, busca e coluna |
| `segmento` | Filtro, busca e coluna |
| `tipoVenda` | Filtro e coluna |
| `statusPagamento` | Filtro e badge |
| `statusProducao` | Coluna |
| `atendyStageName` | Filtro e coluna |
| `atendySynced` | Filtro, KPI e badge |
| `valorTotalCompra` | KPI, ordenacao e coluna |
| `linkPdf` | Link externo da coluna PDF |

### Contrato `FunilData`

Arquivo: `lib/types.ts`

```ts
interface FunilData {
  stages_meta: FunilStageMeta[]
  rows: FunilRow[]
  valor_map: Record<string, number>
}
```

`FunilRow` usa nomes compactos:

| Campo | Significado |
| ----- | ----------- |
| `c` | identificador do cliente |
| `s` | slug da etapa |
| `d` | dias/lead time na etapa |
| `a` | data usada para filtro |
| `l` | chave alternativa para buscar valor em `valor_map` |

## Banco de dados e entidades relacionadas

Este workspace nao possui pasta `supabase/migrations/`. A unica integracao de banco no codigo atual esta em `lib/api/funil.ts`, por REST direto no Supabase.

Entidades remotas esperadas para o funil:

### `client_pipeline_stages`

Uso:

- define ordem, nome, slug, cor e se a etapa e final;
- somente etapas ativas entram no dataset remoto;
- etapas finais sao usadas para KPI de finalizados, mas removidas da visualizacao principal.

### `production_tasks`

Uso:

- fornece ocupacoes por cliente e etapa quando ha task ativa;
- tasks com `status = finalizado` sao excluidas;
- `started_at` tem prioridade sobre `created_at` para calcular dias na etapa.

### `clientes_cadastro`

Uso:

- fornece valor comercial por cliente (`valor` ou `deal_value`);
- fornece etapa atual quando nao ha task ativa para o cliente;
- clientes arquivados sao excluidos.

## Permissoes, RLS e autorizacao

| Camada | Comportamento atual |
| ------ | ------------------- |
| Rotas | Nao ha autenticacao implementada neste workspace |
| Client | Nao ha checagem de role/permissao |
| API local | `lib/api/compras.ts` e `lib/api/funil.ts` nao validam usuario |
| Supabase REST | Usa anon key publica quando configurada; depende de RLS do projeto remoto |

Ponto critico: como `lib/api/funil.ts` usa `NEXT_PUBLIC_SUPABASE_ANON_KEY`, a seguranca depende integralmente das policies RLS das tabelas remotas. Antes de ativar Supabase em producao, validar que a anon key nao permite leitura indevida de clientes, valores ou tasks.

## Integracoes e dependencias

| Integracao | Arquivo/ponto | Observacao |
| ---------- | ------------- | ---------- |
| JSON local | `data/compras.json`, `data/funil.json` | Fonte padrao e fallback |
| Supabase REST | `lib/api/funil.ts` | Apenas para funil; usa REST `/rest/v1` |
| Next.js App Router | `app/page.tsx`, `app/funil/page.tsx` | Server components carregam dados iniciais |
| React client | `components/dashboard/*` | Filtros e calculos rodam no browser |
| Vitest | `test/*.test.ts` | Testa regras puras e hooks |

Variaveis de ambiente:

| Variavel | Uso | Obrigatoria |
| -------- | --- | ----------- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL REST do Supabase para funil remoto | Nao; sem ela usa JSON local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key para REST do Supabase | Nao; sem ela usa JSON local |

## Regras de negocio

- Compras sempre calcula KPIs sobre as linhas filtradas, nao sobre o dataset bruto.
- Exportacao CSV usa as linhas filtradas e somente as colunas visiveis.
- Busca de compras ignora acentos e caixa via `normalizeText()`.
- Periodo de compras usa `dataCompra`.
- Funil filtra por `FunilRow.a`.
- Funil conta clientes por `FunilRow.c`, mas deduplica valor pela chave `FunilRow.l ?? FunilRow.c`.
- Em funil remoto, `production_tasks` tem prioridade sobre `clientes_cadastro.current_stage_id` para representar ocupacao ativa.
- Em funil remoto, tarefas de clientes arquivados ou ausentes no dataset ativo de `clientes_cadastro` nao entram na ocupacao.
- No funil remoto, uma combinacao `cliente_id:pipeline_stage_id` entra apenas uma vez.
- Etapas finais contam para KPI `Finalizados`, mas nao aparecem no funil lateral principal.
- Gargalo e verdadeiro quando a etapa tem clientes e:
  - `meanDays > 30` com ao menos 2 clientes; ou
  - `meanDays > medianDays * 1.8`.

## Realtime, cache e sincronizacao

Nao ha realtime, cache remoto ou TanStack Query neste modulo.

| Mecanismo | Onde fica | Comportamento |
| --------- | --------- | ------------- |
| Dados iniciais | `app/page.tsx`, `app/funil/page.tsx` | Carregados no server component |
| Filtros | Hooks client-side | Estado local sem persistencia |
| Supabase remoto | `lib/api/funil.ts` | `fetch` com `cache: "no-store"` |
| Fallback | `lib/api/funil.ts` | Erros remotos caem para `data/funil.json` com `console.error` |

## Pontos de atencao e riscos conhecidos

- O documento antigo `.context/modules/relatorios-atendimento/README.md` nao cobre o codigo atual deste workspace; ele deve virar submodulo historico/especifico ou ser refeito quando houver codigo correspondente.
- `lib/api/funil.ts` acessa Supabase REST com anon key publica; RLS precisa ser validada antes de ligar dados reais.
- Compras ainda nao tem caminho remoto implementado, apesar da camada `lib/api/compras.ts`.
- `data/compras.json` e `data/funil.json` estao minificados em uma linha; revisoes manuais de diff serao ruins se esses arquivos mudarem em massa.
- O parse de datas aceita formato `dd/mm/yyyy` e strings parseaveis por `new Date`; entradas inconsistentes podem sair dos filtros.
- `toDateRange("custom")` inverte datas quando o usuario informa `from > to`; isso e util, mas pode esconder erro de entrada se futuramente a UI precisar bloquear datas invertidas.
- O teste `period.test.ts` usa "mes atual" e uma data fixa de maio de 2026; ele depende do calendario atual da execucao.
- O CSV exportado usa os valores crus do objeto `Compra`, nao necessariamente o mesmo texto formatado renderizado nas celulas.
- A UI de compras possui estado para `statusCompra` e `statusProducao`, mas nao expoe todos esses filtros visualmente.

## Como testar ou validar

### Validacao automatizada

```bash
pnpm test
pnpm typecheck
pnpm build
```

### Validacao manual

1. Rodar `pnpm dev`.
2. Abrir `/`.
3. Conferir KPIs de compras, filtros, busca `Cmd/Ctrl + K`, ordenacao de colunas e paginacao.
4. Ocultar/exibir colunas e exportar CSV.
5. Abrir `/funil`.
6. Alternar periodo, periodo customizado e escala `Visual`/`Real`.
7. Conferir se etapas com gargalo aparecem destacadas.
8. Abrir `/funil?view=full` e confirmar que o dashboard continua funcional.

### Validacao de dados

Sem Supabase configurado:

```bash
node -e "const c=require('./data/compras.json'); const f=require('./data/funil.json'); console.log({compras:c.length, funilRows:f.rows.length, funilStages:f.stages_meta.length, valorMap:Object.keys(f.valor_map).length})"
```

Resultado observado em 2026-05-15:

```json
{
  "compras": 396,
  "funilRows": 704,
  "funilStages": 20,
  "valorMap": 269
}
```

Com Supabase configurado:

1. Confirmar que `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` apontam para o projeto correto.
2. Conferir RLS de `client_pipeline_stages`, `production_tasks` e `clientes_cadastro`.
3. Abrir `/funil` e verificar se nao houve fallback silencioso para JSON local no console do servidor.

## Lacunas conhecidas

- Nao ha documentacao detalhada separada para os submodulos `compras-pagas`, `funil-producao-dados` e `base-dados-e-periodos`; este README registra a fronteira inicial.
- Nao ha fonte remota de compras implementada.
- Nao ha autenticacao/autorizacao neste workspace.
- Nao ha migrations locais para validar as tabelas remotas do Supabase.
- Nao ha testes browser/e2e para exportacao CSV, popover de colunas ou funil SVG.
- A relacao com os documentos antigos de dashboards/relatorios precisa ser revisada quando o app Atendy operacional completo estiver no mesmo workspace.

## Referencias cruzadas

- `.context/modules/relatorios-atendimento/README.md`
- `.context/modules_old/modules/dashboard/README.md`
- `.context/modules_old/modules/painel-admin/README.md`
- `.context/modules_old/modules/relatorio-insatisfeito/README.md`
- `.context/modules_old/modules/modulo-dashboard-producao/README.md`
- `README.md`
- `migration-plan.md`

## Checklist para futuros agentes

- [ ] Confirmar se a mudanca pertence ao modulo pai ou a um submodulo.
- [ ] Se tocar compras, revisar `Compra`, `useComprasFilters`, `computeComprasKpis` e exportacao CSV.
- [ ] Se tocar funil, revisar `FunilData`, `getFunilDados`, `computeFunilKpis` e regras de gargalo.
- [ ] Se ativar Supabase, validar RLS antes de expor dados reais com anon key.
- [ ] Se alterar datas, rodar `test/period.test.ts` e validar filtros nos dois dashboards.
- [ ] Se alterar datasets JSON, conferir contagens e impacto nos testes.
- [ ] Se criar submodulos fisicos, manter este README como indice do modulo pai.
- [ ] Atualizar `Ultima atualizacao` ao alterar este documento.
