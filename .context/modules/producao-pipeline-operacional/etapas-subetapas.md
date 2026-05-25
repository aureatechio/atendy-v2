# Etapas e Subetapas do Pipeline

Documentacao tecnica dedicada ao contrato de etapas, subetapas, SLAs e follow-up do funil operacional.

Ultima atualizacao: 2026-05-25

## Objetivo

Este documento consolida o comportamento atual de `client_pipeline_stages`, que e o contrato compartilhado entre funil, clientes, producao, pauta, celebridade, alertas e configuracoes administrativas.

A entrada principal de configuracao fica em `/configuracoes/etapas`. Existe tambem uma tela administrativa legada em `/admin/pipeline-stages`.

O objetivo do contrato e permitir configurar etapas-mae do funil, subetapas, ordem, cor, marcador de finalizacao, SLA preventivo e follow-up sem espalhar regras divergentes pelos modulos.

## Principais caminhos

| Area | Caminho | Papel |
| ---- | ------- | ----- |
| Rota principal | `app/(protected)/configuracoes/etapas/page.tsx` | Renderiza a tela atual de configuracao de etapas |
| Layout de configuracoes | `app/(protected)/configuracoes/layout.tsx` | Restringe acesso com `canAccessAdmin` e envolve com `SettingsShell` |
| Componente atual | `components/settings/etapas-settings.tsx` | UI principal para etapas-mae, subetapas e SLAs |
| Rota admin legada | `app/(protected)/admin/pipeline-stages/page.tsx` | Renderiza a tela administrativa antiga |
| Componente admin legado | `components/admin/pipeline-stages-admin.tsx` | UI antiga, ainda expoe `followup_days` |
| API de lista/criacao | `app/api/admin/pipeline-stages/route.ts` | Lista e cria registros em `client_pipeline_stages` |
| API de atualizacao/desativacao | `app/api/admin/pipeline-stages/[id]/route.ts` | Atualiza campos e desativa etapas via `is_active = false` |
| Validacao de payload | `lib/sla/validation.ts` | Schemas Zod de criacao/atualizacao de etapas e feriados |
| Montagem do funil | `lib/api/funil.ts` | Carrega etapas ativas, resolve etapa-mae e monta `stages_meta` |
| Tipos compartilhados | `lib/types.ts` | `FunilStageMeta`, `SlaUnit`, `AlertType` |
| Calculo de SLA | `lib/sla/calculateDeadline.ts` | Calcula deadline e status `ok`, `warning`, `overdue`, `none` |
| Alertas de SLA por etapa | `lib/alerts/evaluateStageSla.ts` | Emite alertas `stage_sla` para tarefas em etapa com SLA |
| Alertas de follow-up | `lib/alerts/evaluateFollowup.ts` | Emite alertas `followup` por cliente parado sem interacao |
| Cron de alertas | `app/api/cron/sla-alerts/route.ts` | Consolida alertas `stage_sla`, `task_overdue` e `followup` |
| Historico de cliente | `app/(protected)/clientes/[id]/actions.ts` | Muda etapa do cliente e grava `client_stage_history` |
| Forca-tarefa CS | `app/(protected)/cs/forca-tarefa/page.tsx` | Usa apenas etapas-mae ativas e nao finais |
| Testes relevantes | `test/funil-metrics.test.ts` | Cobre metricas e metadados de etapas do funil |
| Testes relevantes | `test/sla-calculation.test.ts` | Cobre calculo de SLA |
| Testes relevantes | `test/evaluateFollowup.test.ts` | Cobre regras de follow-up |
| Migration local | `supabase/migrations/20260520162256_add_followup_days_to_pipeline_stages.sql` | Adiciona `followup_days` |

## Funcionamento geral

1. Usuario admin acessa `/configuracoes/etapas`.
2. `ConfiguracoesLayout` valida acesso administrativo via `canAccessAdmin`.
3. `EtapasSettings` chama `GET /api/admin/pipeline-stages`.
4. A API exige `requireAdminAccess({ capability: "adminArea" })` para leitura e retorna todas as colunas configuraveis.
5. A UI separa etapas ativas em:
   - etapas-mae: `parent_stage_id === null`;
   - subetapas: `parent_stage_id` apontando para uma etapa-mae.
6. Criacao, edicao e desativacao passam por `/api/admin/pipeline-stages`.
7. Mutacoes administrativas usam `createAdminClient()`, portanto service role fica restrita ao server.
8. Consumidores do funil carregam `client_pipeline_stages` e decidem se trabalham com etapa direta ou etapa-mae.

## Entradas e rotas

| Entrada | Uso |
| ------- | --- |
| `/configuracoes/etapas` | Tela atual para configurar etapas-mae, subetapas e SLAs |
| `/admin/pipeline-stages` | Tela administrativa legada, ainda util para verificar `followup_days` |
| `GET /api/admin/pipeline-stages` | Lista etapas para UI administrativa |
| `POST /api/admin/pipeline-stages` | Cria etapa ou subetapa |
| `PATCH /api/admin/pipeline-stages/[id]` | Atualiza campos configuraveis |
| `DELETE /api/admin/pipeline-stages/[id]` | Desativa etapa com `is_active = false` |
| `GET /api/cron/sla-alerts` | Cron protegido por `CRON_SECRET` para recalcular alertas |

## Contrato de `client_pipeline_stages`

Campos consumidos pelo codigo atual:

| Campo | Uso |
| ----- | --- |
| `id` | Identificador primario e alvo de FKs |
| `name` | Nome exibido em UI e filtros |
| `slug` | Contrato semantico compartilhado entre modulos |
| `color` | Cor de chips, cards e barras |
| `order_index` | Ordenacao de etapas e subetapas |
| `is_active` | Controla visibilidade operacional |
| `is_final` | Marca etapas finais, excluidas de varias visoes ativas |
| `parent_stage_id` | Define subetapa quando aponta para outra etapa |
| `sla_amount` | Quantidade do SLA, `null` desliga SLA da etapa |
| `sla_unit` | Unidade do SLA: `business_days`, `business_hours` ou `calendar_hours` |
| `warn_at_percent` | Percentual do prazo para status preventivo `warning` |
| `followup_days` | Dias sem interacao ate alerta de follow-up, `null` desliga |
| `created_at` / `updated_at` | Auditoria basica retornada pelas APIs administrativas |

Slugs preservados como contrato historico do pipeline:

`onboarding`, `roteiro`, `roteiro-em-aprovacao`, `atendimento`, `criacao`, `ajuste-roteiro`, `design`, `locucao`, `edit`, `video`, `mix`, `finalizacao`, `delivery`, `aguardando`, `ajuste-video`, `ajuste-design`, `celebridade`, `aprovado-celebridade`, `finalizado`.

Alterar slug exige revisar os consumidores de Producao, Pauta, Celebridade, Relatorios e qualquer RPC/view legada que faca filtro por slug.

## Etapas-mae e subetapas

Uma etapa-mae e qualquer registro ativo com `parent_stage_id = null`.

Uma subetapa e qualquer registro ativo com `parent_stage_id` preenchido com o `id` de uma etapa-mae. O codigo atual nao impõe constraint local impedindo subetapa de apontar para outra subetapa, mas as UIs so oferecem etapas-mae como opcoes de parent.

Regras atuais:

- `/configuracoes/etapas` agrupa subetapas dentro da etapa-mae.
- A criacao de subetapa desabilita os campos de SLA na UI e envia `sla_amount = null`.
- A subetapa mantem `order_index`, `name`, `slug` e `color` proprios.
- `lib/api/funil.ts` resolve a etapa-mae com `rootStageOf()` antes de gerar ocupacao do funil.
- `stages_meta` inclui as subetapas dentro da propriedade `substages` da etapa-mae.
- A Forca-Tarefa carrega apenas etapas-mae ativas e nao finais.

## SLA por etapa

O SLA usa os campos `sla_amount`, `sla_unit` e `warn_at_percent`.

Unidades aceitas pela validacao:

| Unidade | Status atual |
| ------- | ------------ |
| `business_days` | Suportada em `calculateSlaDeadline`, considera finais de semana e `business_holidays` |
| `calendar_hours` | Suportada, soma horas corridas |
| `business_hours` | Aceita pelo schema, mas `calculateSlaDeadline` ainda lança erro |

Comportamento:

1. `sla_amount = null` desliga SLA.
2. `warn_at_percent` default e `80`.
3. `lib/api/funil.ts` calcula `slaStatus`, `slaDeadline` e `slaHoursRemaining` para as linhas do funil.
4. `evaluateStageSla()` emite alerta apenas quando o status e `warning` ou `overdue`.
5. Etapas finais nao geram alerta de SLA por etapa.

Ponto critico: o funil resolve subetapas para etapa-mae antes de calcular SLA, mas `evaluateStageSla()` usa diretamente `production_tasks.pipeline_stage_id`. Se tarefas puderem ficar em subetapas, o cron pode nao herdar o SLA da etapa-mae. Validar ou corrigir antes de depender de SLA em subetapas.

## Follow-up por etapa

`followup_days` controla alertas de cliente parado sem interacao.

Comportamento:

1. `followup_days = null` ou `<= 0` desliga follow-up.
2. Etapas finais nao geram follow-up.
3. `evaluateFollowup()` usa `cliente_last_interaction.last_interaction_at`.
4. Se nao houver interacao registrada, usa `clientes_cadastro.stage_entered_at`.
5. Status vira `warning` quando atinge 80% do prazo e `overdue` quando passa de 100%.

A tela atual `/configuracoes/etapas` ainda nao expoe `followup_days`. A tela legada `/admin/pipeline-stages` expoe criacao e edicao desse campo.

## Relacao com clientes e tarefas

| Origem | Campo | Uso |
| ------ | ----- | --- |
| `clientes_cadastro` | `current_stage_id` | Etapa atual do cliente |
| `clientes_cadastro` | `stage_entered_at` | Inicio da permanencia atual do cliente na etapa |
| `client_stage_history` | `from_stage_id` / `to_stage_id` | Historico de mudancas de etapa e reatribuicoes |
| `production_tasks` | `pipeline_stage_id` | Etapa operacional da tarefa |
| `task_history` | eventos de etapa/status | Fonte historica legada para metricas de producao |

No funil atual, tarefas ativas tem prioridade sobre `clientes_cadastro.current_stage_id`. Se um cliente tem tarefa ativa com `pipeline_stage_id`, a ocupacao vem da tarefa; se nao, cai para a etapa atual do cliente.

## APIs e autorizacao

| Camada | Comportamento |
| ------ | ------------- |
| Layout protegido | `app/(protected)/layout.tsx` exige sessao ativa para areas protegidas |
| Configuracoes | `app/(protected)/configuracoes/layout.tsx` usa `canAccessAdmin` |
| Admin legado | `app/(protected)/admin/layout.tsx` usa `canAccessAdmin` |
| API GET | `requireAdminAccess({ capability: "adminArea" })`, permite admin/supervisor conforme `CAPABILITIES` |
| API POST/PATCH/DELETE | `requireAdminAccess()` default `adminOnly`, restrito a admin |
| Mutacao no banco | Usa `createAdminClient()` no server |
| Cron | Exige header `Authorization: Bearer ${CRON_SECRET}` |

## Banco de dados e migrations

Tabela principal:

`client_pipeline_stages`

Migration local relacionada:

`supabase/migrations/20260520162256_add_followup_days_to_pipeline_stages.sql`

Esta workspace nao contem a migration local original que criou `client_pipeline_stages` nem a migration que adicionou `parent_stage_id`, `sla_amount`, `sla_unit` e `warn_at_percent`. Trate o schema remoto como fonte a validar antes de mexer em estrutura.

Entidades relacionadas:

| Entidade | Relacao |
| -------- | ------- |
| `clientes_cadastro.current_stage_id` | FK logica para etapa atual do cliente |
| `production_tasks.pipeline_stage_id` | FK logica para etapa da tarefa |
| `client_stage_history.from_stage_id` / `to_stage_id` | Timeline de mudancas |
| `sla_alerts.stage_id` | Alertas abertos/fechados por etapa |
| `business_holidays.date` | Dias nao uteis para SLA em `business_days` |
| `cliente_last_interaction` | View usada por follow-up |

## Regras de negocio

- Slugs de etapa sao contratos; nao renomear sem migracao coordenada.
- Desativar etapa deve usar `is_active = false`, nao apagar registro.
- Etapa final nao deve inflar visoes de execucao ativa.
- Subetapas pertencem operacionalmente a uma etapa-mae.
- O funil agregado exibe ocupacao por etapa-mae.
- `stage_entered_at` deve mudar quando `current_stage_id` muda.
- Mudancas de etapa de cliente devem registrar `client_stage_history`.
- `business_hours` ainda nao deve ser usado em producao enquanto `calculateSlaDeadline` nao suportar essa unidade.
- `followup_days` mede inatividade de cliente, nao prazo de task.

## Pontos de atencao e riscos conhecidos

- A tela atual de configuracoes nao expoe `followup_days`; a tela admin legada expoe.
- `evaluateStageSla()` nao resolve `parent_stage_id`; subetapas podem ficar sem heranca de SLA no cron.
- A validacao aceita `business_hours`, mas o calculo ainda lança erro para essa unidade.
- O schema documentado em `.context/modules/database/schema-tabelas.md` pode ficar desatualizado porque nem todas as migrations historicas estao no workspace.
- Alterar `order_index` afeta funil, forca-tarefa e dashboards.
- Criar subetapa com slug usado por regra legada pode quebrar filtros por slug.
- A API administrativa usa service role, entao toda autorizacao precisa acontecer antes da mutacao.

## Como testar ou validar

Validacao automatizada recomendada:

```bash
pnpm test
pnpm typecheck
```

Testes focados:

```bash
pnpm test test/funil-metrics.test.ts
pnpm test test/sla-calculation.test.ts
pnpm test test/evaluateFollowup.test.ts
pnpm test test/sla-alerts-diff.test.ts
```

Validacao manual minima:

1. Abrir `/configuracoes/etapas` com usuario admin.
2. Confirmar contagem de etapas-mae e subetapas.
3. Criar etapa-mae de teste com slug unico.
4. Criar subetapa apontando para essa etapa-mae.
5. Confirmar que subetapa aparece agrupada e que o funil continua agregando por etapa-mae.
6. Atualizar SLA da etapa-mae e conferir status no funil.
7. Desativar registros de teste e confirmar que nao aparecem em visoes operacionais.

## Lacunas conhecidas

- Confirmar no Supabase remoto a constraint/FK real de `parent_stage_id`.
- Confirmar se existe policy RLS especifica para leitura de `client_pipeline_stages` por usuarios autenticados.
- Decidir se `/admin/pipeline-stages` deve ser removida ou se `/configuracoes/etapas` deve incorporar `followup_days`.
- Corrigir ou documentar formalmente a heranca de SLA para cron em subetapas.
- Confirmar se todas as RPCs legadas que usam slugs continuam ativas.

## Referencias cruzadas

- `.context/modules/producao-pipeline-operacional/README.md`
- `.context/modules/database/schema-tabelas.md`
- `.context/modules/relatorios-e-dados/README.md`
- `.context/modules/pauta-planejamento-entregas/README.md`
- `.context/modules/aprovacao-fluxo-celebridades/README.md`

## Checklist para futuros agentes

- Antes de alterar etapa, procure todos os usos de `client_pipeline_stages`, `parent_stage_id`, `pipeline_stage_id` e `current_stage_id`.
- Antes de alterar slug, procure o slug literal no codigo, docs, migrations e RPCs.
- Antes de alterar SLA, rode testes de calculo e valide `business_hours`.
- Antes de alterar follow-up, valide `cliente_last_interaction` e o cron `sla-alerts`.
- Antes de criar migration, confirme o projeto Supabase correto: `cfgeilnppnlyhwnabkox`.
