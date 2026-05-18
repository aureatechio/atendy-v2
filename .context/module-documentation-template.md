# Modulo [Nome do Modulo]

Documentacao tecnica do modulo [Nome do Modulo].

Ultima atualizacao: AAAA-MM-DD

> Use este template como base para novos documentos em `.context/modules/<slug>/README.md`.
> Remova secoes que nao se aplicam e mantenha nomes de arquivos, rotas, tabelas,
> hooks e funcoes exatamente como aparecem no codigo.

## Objetivo

Descreva em 1 a 3 paragrafos o papel operacional do modulo no produto.

Inclua:

- problema ou fluxo de negocio que o modulo resolve;
- tela, rota ou ponto principal de entrada;
- principais usuarios ou permissoes envolvidas;
- limites do modulo, quando houver confusao com outro dominio.

A tela principal fica em `/rota-principal`.

## Principais caminhos

| Area | Caminho | Papel |
| ---- | ------- | ----- |
| Rota principal | `src/app/(auth)/.../page.tsx` | Orquestra a tela e estados principais |
| Client da pagina | `src/app/(auth)/.../...-client.tsx` | Le query params e monta componentes |
| Componentes do modulo | `src/components/.../` | Componentes de UI e fluxos locais |
| Hooks principais | `src/hooks/...` | Queries, mutations, caches e contratos |
| API/RPC/Edge Function | `src/app/api/...` ou `supabase/functions/...` | Integracao server-side |
| Migration/tabela base | `supabase/migrations/...sql` | Schema, indices, RLS ou funcoes SQL |
| Tipos/contratos | `src/types/...` | Tipos compartilhados pelo modulo |
| Testes | `src/.../__tests__/...` ou `e2e/...` | Cobertura automatizada relevante |

## Funcionamento geral

1. Usuario acessa `[rota ou entrada]`.
2. A tela le `[query params, stores, filtros ou contexto]`.
3. O modulo carrega `[hooks/RPCs/APIs]`.
4. Os dados sao renderizados por `[componentes principais]`.
5. O usuario executa `[acoes principais]`.
6. Mutations atualizam `[tabelas/APIs/caches]`.
7. Realtime, polling ou invalidacao atualizam a UI, se aplicavel.

## Entradas, rotas e query params

| Entrada | Uso |
| ------- | --- |
| `/rota` | Descreva a tela ou fluxo |
| `?param=value` | Descreva o efeito do parametro |
| Link vindo de outro modulo | Descreva origem e comportamento esperado |

Valores especiais:

| Valor | Efeito |
| ----- | ------ |
| `valor_exemplo` | Comportamento esperado |

## Telas e componentes

### `[Rota ou componente principal]`

Arquivo: `src/...`

Responsabilidades:

- responsabilidade principal;
- estados visuais relevantes;
- eventos que dispara;
- pontos de integracao com outros componentes.

Estados visuais:

| Estado | UI/comportamento |
| ------ | ---------------- |
| Carregando | Skeleton, spinner ou estado parcial |
| Vazio | Estado vazio e chamada de acao |
| Erro | Fallback, retry ou toast |
| Sucesso | Render principal |

### `[Componente secundario]`

Arquivo: `src/...`

Descreva quando o componente aparece, quais props recebe e quais efeitos ou mutations dispara.

## Hooks, stores e contratos

Arquivo: `src/hooks/...`

### `[useHookPrincipal(args)]`

Caracteristicas:

- query/mutation usada;
- query key, quando relevante;
- filtros ou argumentos aceitos;
- page size, ordenacao e paginacao;
- politica de cache, invalidacao ou updates otimistas;
- fallback ou tratamento de erro.

Query key:

```ts
['dominio', 'subdominio', parametros]
```

Retorno relevante:

| Campo | Tipo | Uso |
| ----- | ---- | --- |
| `items` | `Tipo[]` | Lista renderizada |
| `total` | `number` | Contagem total |
| `hasMore` | `boolean` | Controle de paginacao |

### Mutations

| Hook/funcao | Operacao | Efeitos colaterais |
| ----------- | -------- | ------------------ |
| `useCreate...` | Cria registro | Invalida lista e metricas |
| `useUpdate...` | Atualiza registro | Atualiza cache de detalhe |
| `useDelete...` | Remove registro | Remove dependencias, se houver |

## APIs, RPCs e Edge Functions

### `[GET/POST /api/... ou nome_da_rpc]`

Arquivo: `src/app/api/.../route.ts` ou `supabase/migrations/...sql`

Caracteristicas:

- metodo, autenticacao e autorizacao;
- payload de entrada;
- formato de retorno;
- tabelas consultadas ou atualizadas;
- erros esperados;
- timeout, retry ou limite, se aplicavel.

Contrato de entrada:

```ts
type RequestPayload = {
  campo: string
}
```

Contrato de saida:

```ts
type ResponsePayload = {
  ok: boolean
  data?: unknown
  error?: string
}
```

## Banco de dados e entidades relacionadas

### `[tabela_ou_view]`

Criada/alterada em:

`supabase/migrations/AAAAMMDDHHMMSS_descricao.sql`

Campos relevantes:

| Campo | Tipo | Uso |
| ----- | ---- | --- |
| `id` | `uuid` | Identificador principal |
| `created_at` | `timestamp` | Auditoria/criacao |

Indices, constraints e triggers:

- indice/constraint/trigger relevante;
- motivo operacional ou impacto em performance.

Relacionamentos:

- `tabela_a.campo_id -> tabela_b.id`;
- dependencia com outro modulo.

## Permissoes, RLS e autorizacao

| Camada | Comportamento |
| ------ | ------------- |
| Layout/rota | Guard de autenticacao ou role |
| Client | Checagens de permissao para mostrar acoes |
| API/Edge Function | Validacao server-side |
| Banco/RLS | Policies efetivas e helpers SECURITY DEFINER |

Policies relevantes:

- `[policy_name]`: descreva quem pode selecionar/inserir/atualizar/remover;
- risco conhecido ou lacuna, se existir.

## Integracoes e dependencias

| Integracao | Arquivo/ponto | Observacao |
| ---------- | ------------- | ---------- |
| Supabase | `src/lib/supabase/...` | Cliente browser/server, storage ou realtime |
| Modulo relacionado | `.context/modules/.../README.md` | Contrato compartilhado |
| Servico externo | `supabase/functions/...` | Variaveis, payloads e limites |

Variaveis de ambiente:

| Variavel | Uso | Obrigatoria |
| -------- | --- | ----------- |
| `NOME_DA_VARIAVEL` | Descreva uso | Sim/Nao |

## Regras de negocio

- Regra critica 1.
- Regra critica 2.
- Invariante que nao deve ser quebrada por futuras alteracoes.
- Diferenca entre nomes parecidos, status, tipos ou fluxos.

## Realtime, cache e sincronizacao

Use esta secao quando o modulo tiver subscriptions, polling, optimistic updates ou invalidacoes complexas.

| Mecanismo | Onde fica | Comportamento |
| --------- | --------- | ------------- |
| Realtime | `src/hooks/...` | Eventos assinados e invalidacoes |
| Polling | `src/hooks/...` | Intervalo e motivo |
| Cache | React Query/store | Query keys e invalidacoes |

## Pontos de atencao e riscos conhecidos

- Arquivo ou fluxo de alto acoplamento.
- Contrato com outro modulo que costuma quebrar.
- Divergencia entre comentario antigo e comportamento atual.
- Lacuna de RLS, permissao ou validacao.
- Risco de performance, paginacao, N+1 ou payload grande.

## Como testar ou validar

### Validacao automatizada

```bash
npm run lint
npm run test -- [arquivo-ou-padrao]
npm run build
```

### Validacao manual

1. Acessar `/rota`.
2. Executar o fluxo principal.
3. Testar estados vazio, erro e sucesso.
4. Validar usuario com permissao e usuario sem permissao.
5. Confirmar efeitos em modulos relacionados.

### Validacao SQL/RLS

Use quando houver RPC, policy, view ou trigger relevante.

```sql
-- Consultas sugeridas para validar schema, policies ou dados derivados.
select *
from public.tabela
limit 10;
```

## Lacunas conhecidas

- Lacuna funcional, tecnica ou de documentacao.
- Decisao pendente e impacto esperado.
- Item que precisa de validacao em ambiente remoto.

## Referencias cruzadas

- `.context/modules/[outro-modulo]/README.md`
- `src/...`
- `supabase/migrations/...`

## Checklist para futuros agentes

- [ ] Confirmar que os caminhos citados ainda existem.
- [ ] Confirmar que rotas, query params e filtros continuam vigentes.
- [ ] Confirmar contratos de hooks, APIs, RPCs e Edge Functions.
- [ ] Confirmar tabelas, views, triggers, policies e RLS.
- [ ] Validar integracoes com modulos relacionados.
- [ ] Rodar validacao automatizada proporcional ao risco da mudanca.
- [ ] Atualizar `Ultima atualizacao` ao alterar este documento.
