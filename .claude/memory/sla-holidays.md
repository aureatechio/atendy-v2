---
name: sla-holidays
description: "Cálculo de SLA: `calculateSlaDeadline`, `evaluateSla`, unidades (business_days/business_hours/calendar_hours), timezone BRT, feriados (`business_holidays`)"
metadata:
  node_type: memory
  type: project
  originSessionId: clientes-context-engineering-2026-05-26
---

Cálculo de SLA é centralizado em [lib/sla/calculateDeadline.ts](lib/sla/calculateDeadline.ts) — duas funções puras (`calculateSlaDeadline`, `evaluateSla`) + tabela `business_holidays`. Timezone fixo **BRT (`America/Sao_Paulo`, UTC-3 sem DST)**. Usado por `/funil`, alertas SLA, evaluators de followup.

**Why:** Centralizar a aritmética de dias úteis (com feriados nacionais/regionais/empresariais) para evitar reimplementação. BRT é hard-coded porque o produto é Brasil-only — sem DST desde 2019, então offset fixo `-03:00` é seguro.

**How to apply:** Sempre usar `evaluateSla` (não recalcular `deadline` à mão). Para alimentar holidays, buscar de `business_holidays` e passar como `Set<string>` ou iterable de `YYYY-MM-DD`.

### Unidades suportadas (`SlaUnit`)

```ts
type SlaUnit = "business_days" | "business_hours" | "calendar_hours"
```

| Unit | Implementação | Notas |
|---|---|---|
| `business_days` | Loop adicionando dias, pulando sábado/domingo/feriado | Default |
| `business_hours` | **NÃO IMPLEMENTADO** — `throw new Error("sla_unit business_hours ainda nao suportado")` ([calculateDeadline.ts:101](lib/sla/calculateDeadline.ts:101)) | ⚠️ Schema aceita, código quebra |
| `calendar_hours` | `entered + slaAmount * 3_600_000` | Tempo corrido |

### `calculateSlaDeadline` ([calculateDeadline.ts:83](lib/sla/calculateDeadline.ts:83))

Input:
```ts
{ enteredAt: Date | string | null, slaAmount: number | null, slaUnit: SlaUnit, holidays?: Iterable<string> }
```

Retorna `Date | null`. Null se `slaAmount` ou `enteredAt` faltarem, ou se data inválida.

#### Algoritmo `business_days`
1. Avança `entered` até o primeiro dia útil (caso entrou num fim de semana ou feriado).
2. Loop: enquanto `remaining > 0`, adiciona 24h. Se o novo dia for útil, decrementa `remaining`.
3. Retorna a `Date` final.

**Importante**: a iteração soma 86_400_000 ms ao tempo, depois checa o dia em **BRT**. Pode produzir horários "esquisitos" perto de virada de dia, mas o `dow` (day-of-week) é avaliado no fuso BR.

### `evaluateSla` ([calculateDeadline.ts:140](lib/sla/calculateDeadline.ts:140))

Input:
```ts
{ enteredAt, slaAmount, slaUnit, warnAtPercent, holidays?, now? }
```

Retorna `SlaEvaluation`:
```ts
{
  status: "ok" | "warning" | "overdue" | "none",
  deadline: Date | null,
  hoursRemaining: number | null  // (deadline - now) / 3.6e6
}
```

#### Branches
- Sem deadline → `"none"`
- `hoursRemaining < 0` → `"overdue"`
- `elapsedPercent >= warnAtPercent` → `"warning"`
- senão → `"ok"`

`elapsedPercent = (now - entered) / (deadline - entered) * 100`.

### Timezone BRT — detalhes ([calculateDeadline.ts:1-49](lib/sla/calculateDeadline.ts:1))

```ts
const BR_TIMEZONE = "America/Sao_Paulo"
```

- `toBrParts(date)` — usa `Intl.DateTimeFormat("en-CA", { timeZone: BR_TIMEZONE, weekday: "short", ... })` para extrair `{ iso, dow, hour, minute, second }` em BR.
- `isNonBusinessDay(date, holidays)` — `dow === 0 || dow === 6 || holidays.has(iso)`. Sábado/domingo + feriados.
- `buildBrMidnight(iso)` — `new Date('YYYY-MM-DDT00:00:00-03:00')`. Offset fixo (sem DST desde 2019).
- `addDays(iso, n)` — aritmética em UTC para evitar bugs de Intl.

⚠️ Se o Brasil voltar a usar DST, o offset fixo `-03:00` quebra. Considerar Intl-based em vez de string offset.

### Tabela `business_holidays`

| Campo | Tipo | Notas |
|---|---|---|
| `date` | text `YYYY-MM-DD` | PK lógica. Validado por regex no Zod |
| `description` | text | Display |
| `scope` | enum | `"national" \| "regional" \| "company"` |
| `created_at` | timestamptz | |

Schemas Zod em [lib/sla/validation.ts](lib/sla/validation.ts:57):
- `createHolidaySchema` — `date` regex `YYYY-MM-DD`, `description` min 2, `scope` default `"national"`
- `updateHolidaySchema` — `description` + `scope` optional

### APIs admin ([app/api/admin/holidays/](app/api/admin/holidays))

| Método | Rota | Capability | Função |
|---|---|---|---|
| GET | `/api/admin/holidays` | `adminArea` | Lista ordenada por `date` ASC |
| POST | `/api/admin/holidays` | `adminOnly` (default) | Cria. Valida `createHolidaySchema` |
| PATCH/DELETE | `/api/admin/holidays/[date]` | `adminOnly` | Edita/remove. Key é o `date` (string), não id |

Service role via `createAdminClient` para writes; cliente normal pra reads.

### Consumidores

| Caminho | Como usa |
|---|---|
| [lib/api/funil.ts](lib/api/funil.ts) | `getFunilDados` carrega `business_holidays`, monta `Set`, passa para `evaluateSla` por row |
| [lib/alerts/evaluateStageSla.ts](lib/alerts/evaluateStageSla.ts) | Recebe holidays via input, repassa para `evaluateSla` |
| [app/api/cron/sla-alerts/route.ts](app/api/cron/sla-alerts/route.ts) | Loader: `fetchAll<HolidayRow>` → `new Set(rows.map(h => h.date))` |
| [lib/alerts/evaluateFollowup.ts](lib/alerts/evaluateFollowup.ts) | **NÃO USA holidays** — followup é em `calendar_days` puros |
| [components/settings/etapas-settings.tsx](components/settings/etapas-settings.tsx) | UI admin de etapas mostra `sla_amount` + `sla_unit` |

### Configuração por etapa

`client_pipeline_stages` carrega o SLA por etapa:

| Campo | Default | Uso |
|---|---|---|
| `sla_amount` | null | Quantidade. Null → sem SLA, evaluator retorna `"none"` |
| `sla_unit` | `"business_days"` | Default no Zod. ⚠️ `business_hours` quebra |
| `warn_at_percent` | 80 | Quando virar `"warning"` |
| `followup_days` | null | Dias até gerar alerta `followup`. **Não usa holidays** |

Editáveis via `/api/admin/pipeline-stages/[id]` (PATCH) — ver [pipeline-stages.md](pipeline-stages.md).

### Padrão de uso

```ts
import { evaluateSla } from "@/lib/sla/calculateDeadline";

const holidays = new Set(holidayRows.map(h => h.date));

const result = evaluateSla({
  enteredAt: cliente.stage_entered_at,
  slaAmount: stage.sla_amount,
  slaUnit: (stage.sla_unit as SlaUnit) ?? "business_days",
  warnAtPercent: stage.warn_at_percent ?? 80,
  holidays,
});

// result: { status, deadline, hoursRemaining }
```

### Pegadinhas

- ⚠️ **`business_hours` não está implementado** — `throw`. Schema aceita, banco aceita, runtime quebra. Defender no consumer ou implementar.
- ⚠️ **BRT hardcoded** (UTC-3 fixo). Se DST voltar, recalcular offset via Intl.
- ⚠️ **Feriados são `text YYYY-MM-DD`**, não `date` — comparação por string. Validado por regex.
- ⚠️ Scope `regional` e `company` não filtram em código — todos os holidays são tratados igual (no SLA). O scope serve só pra UI.
- ⚠️ `evaluateFollowup` **ignora feriados** — usa `dayMs * followup_days` sem business day logic.
- ⚠️ `calendar_hours` ignora fim de semana e feriados — uso correto para SLAs de comunicação 24/7.
- ⚠️ Se `enteredAt` cair num feriado/fim de semana, `calculateSlaDeadline` avança até primeiro dia útil **antes** de começar a contagem (não conta o dia em que entrou).
- ⚠️ `now` é parâmetro opcional do `evaluateSla` — útil para testes determinísticos.
