# Débitos de cleanup — sistema de roles

Documento vivo dos pontos identificados durante o refactor de roles (mai/2026) que **não foram resolvidos** porque ficavam fora do escopo daquela mudança. Cada item descreve o problema, o impacto e uma proposta de tratamento.

Atualizado em **2026-05-20** após duas rodadas de mudanças. Estado atual em produção: 66 perfis distribuídos em 7 roles (`producao` 32, `admin` 10, `supervisor` 10, `attendant` 8, `cs_head` 2, `dev` 2, `designer` 2).

**Rodada 2 (final do dia 2026-05-20):**
- 3 producao → attendant (Yasmin Correia, Emily Soares, Maria Luiza Marques).
- 2 movidos para nova role `designer` (Ana Mel ← producao, Roberta Braga ← supervisor). Enum `user_role` estendido via migration `20260520200000_add_designer_to_user_role.sql`; tipo TS, `roleOptions`, `users-admin.tsx` (labels + badge), `cs.css` (estilo badge) e teste de capabilities atualizados.
- 4 contas deletadas: Bianca Ribeiro Torres, Bianca Torres, Larissa Matos, Micaela Nicácio (`micaelanicacio@aureatech.io`).
- ⚠️ Reversão detectada: **Ailton Santos** foi para `dev` na rodada 1 e voltou para `admin` às 20:45 UTC (origem externa — provavelmente UI de admin ou alteração manual). Não foi reaplicado.

---

## 1) Status `inativo` no banco vs. enum `UserStatus` no código

**Problema.** O tipo TS define `UserStatus = "pending" | "active" | "blocked"`, mas existem 3 perfis em produção com status `"inativo"` (string fora do enum):

| Role | Nome | Email |
|---|---|---|
| admin | Aurelio Figueiredo | aureliofigueiredo@aureatech.io |
| producao | Gabriel Alves | gabriel.alves@aureatech.io |
| producao | Victor Herrera | victorherrera@aureatech.io |

**Impacto.** [`getAuthSnapshot()`](../lib/auth/get-auth-snapshot.ts) só ramifica `blocked`/`pending`; qualquer outro valor cai no default `active`. Resultado: os 3 perfis acima estão sendo tratados como **ativos** — conseguem logar e operar — quando provavelmente deveriam estar `blocked`.

**Proposta.**
1. Decidir se `inativo` é semanticamente igual a `blocked` ou se merece ser um valor próprio do enum.
2. Se igual: rodar `UPDATE profiles SET status='blocked' WHERE status::text = 'inativo'` e adicionar `CHECK` ou constraint para impedir valores fora do enum TS no futuro.
3. Se diferente: estender o enum TS, o tipo no Supabase e os guards (`getAuthSnapshot`, layouts, `requireAdminAccess`).

---

## 2) "HEAD" ≠ `cs_head` — possível necessidade de novas roles "head"

**Problema.** Na rodada de mudanças de role (2026-05-20), a usuária promovida para "HEAD" foi Ruas (`ruas@aureatech.io`), que **não é** Head de CS. Foi atribuída `cs_head` porque é a única role "head" disponível no enum.

**Impacto.** Ruas agora consegue acessar a área `/cs` (rota destinada ao time de Customer Success). Pode ser efeito não-intencional caso ela seja head de outra área (Tech / Produção / Operações).

**Proposta.**
1. Confirmar com o usuário qual a função real de Ruas.
2. Se for outra "head" (ex.: tech_head, prod_head), criar novo valor no enum `user_role` via migration `ALTER TYPE user_role ADD VALUE 'X'`, atualizar `UserRole` em [`lib/auth/types.ts`](../lib/auth/types.ts) e atribuir a capability adequada em [`lib/auth/capabilities.ts`](../lib/auth/capabilities.ts).
3. Reverter o role da Ruas se `cs_head` não era a intenção.

---

## 3) Perfis duplicados (mesma pessoa, contas múltiplas)

**Problema.** Há vários casos de um humano com 2 perfis distintos (geralmente um corporativo `@aureatech.io`/`@acelerai.com.br` e outro pessoal). Identificados pelo refactor:

| Pessoa | Email A | Email B | Estado |
|---|---|---|---|
| Yasmin Correia | yasmin.correia@acelerai.com.br (producao/active) | yasmincorreia@aureatech.io (producao/blocked) | A ativa, B bloqueada |
| Rafael Campos | rafa.vfx@gmail.com (producao/active) | rafaelcampos@aureatech.io (producao/blocked) | A ativa, B bloqueada |
| Mathaws Queiroz | mathawsqueiroz@gmail.com (producao/active) | mathawsqueiroz@gmail.com.br (producao/blocked) | A ativa, B bloqueada — domínio errado em B |
| Ítalo Florenço | italoflorencoa@gmail.com (producao/active) | italoflorencoa@gmail.com.br (producao/blocked) | A ativa, B bloqueada — domínio errado em B |
| Micaela Nicácio | micaela.nicacio@acelerai.com.br (producao/blocked) | micaelanicacio@aureatech.io (producao/blocked) | ambas bloqueadas |
| Bianca Torres | bianca.torres@acelerai.com.br (producao/blocked) | bii.torres2000@gmail.com (producao/blocked) | ambas bloqueadas |
| Giovanna Moraes | giovanna.moraes@acelerai.com.br (attendant/active) | giovannamoraes@aureatech.io (producao/blocked) | A ativa (agora attendant), B bloqueada |
| Aurélio Figueiredo | aurelio.figueiredo@acelerai.com.br (admin/blocked) | aureliofigueiredo@aureatech.io (admin/inativo) | ambas inativas |
| Juliana Oliveira | juliana.oliveira@acelerai.com.br (admin/active) | juliana@aureatech.io (admin/blocked) | A ativa, B bloqueada |

**Impacto.** Confunde relatórios (contagens duplicadas), polui o filtro de "responsável" no funil/kanban, gera ruído nas listas. Para os contas blocked não há risco de acesso, mas as 2 Julianas/Aurélios precisam de atenção (uma ativa, outra "inativo").

**Proposta.**
1. Decidir qual conta é canônica para cada pessoa.
2. Reatribuir FKs (`assigned_to`, `created_by`, etc — vide seção 7) para a conta canônica.
3. Deletar a conta secundária (mesmo fluxo aplicado no `ander_teste10@`).
4. Estabelecer convenção de email único por humano no fluxo de criação do `/api/admin/users`.

---

## 4) Conta "aaaa" (`anderson@supervisor.com`)

**Problema.** Existe um perfil `producao/blocked` com `full_name="aaaa"` e email `anderson@supervisor.com`. Clara conta de teste antiga.

**Impacto.** Lixo. Não polui muito por estar blocked, mas suja a tabela.

**Proposta.** Confirmar com Anderson e aplicar o mesmo fluxo de delete (profile → auth.users). Já validamos que delete não bate em FKs `NO ACTION` na maioria dos casos para contas de teste antigas.

---

## 4b) Micaela Nicácio (`micaela.nicacio@acelerai.com.br`) tem 16 aprovações ativas e bloqueia delete

**Problema.** Pedido para deletar em 2026-05-20, mas o perfil `0edd0dd4-6f19-4aab-ba9f-4d23ebc27f0d` tem **16 referências** em `celebrity_approvals.submitted_by` (FK `NO ACTION`). A outra Micaela (`micaelanicacio@aureatech.io`) foi deletada normalmente.

**Impacto.** Conta permanece como `producao/blocked` (sem acesso, mas suja relatórios). Drop direto falharia com erro de FK.

**Proposta.**
1. **Manter histórico**: deixar como está (status já está blocked).
2. **Limpar histórico**: `UPDATE celebrity_approvals SET submitted_by = NULL WHERE submitted_by = '0edd0dd4-...'` — exige análise de impacto nas RPCs `get_celebrity_board_data` (verificar comportamento com `submitted_by IS NULL`). Aí deletar o perfil.
3. **Reatribuir histórico para outra conta canônica** (se ela tinha outro perfil ativo — verificar). Aí deletar.

---

## 5) Roles `attendant` e `dev` agora têm usuários — verificar consequências

**Problema.** Até 2026-05-20, ambas as roles existiam no enum mas tinham **zero** atribuições. Agora há 5 `attendant` e 3 `dev`.

**Impacto a verificar.**
- [`app/(protected)/layout.tsx:29`](../app/(protected)/layout.tsx) carrega `getNewAssignmentsTodayCount` só para `attendant`. Validar que: (a) a query funciona com os 5 attendants reais, (b) o badge no shell aparece como esperado, (c) não há overhead de fetch que estava dormindo.
- Role `dev` **não tem nenhuma capability** no [mapa central](../lib/auth/capabilities.ts) — ela é só uma "tag" sem acesso especial. Confirmar com os 3 promovidos (Ailton, Anderson, Arthur) se realmente querem perder os privilégios de admin que tinham antes.
- O CS sidebar guard ([`canAccessCS`](../lib/auth/guards.ts)) inclui `dev` por enquanto. Os 3 agora têm acesso a `/cs` — confirmar intenção.

**Proposta.**
1. Smoke test pós-mudança com os usuários reais.
2. Documentar em algum lugar (CLAUDE.md ou README) o que cada role pode fazer hoje. O mapa de capabilities é a fonte da verdade, mas a tabela "role × área" ainda é cognitivamente útil.

---

## 6) Campos compostos remanescentes (`specialty`, `permissions`, `autorizado_tirar_analise_ia`)

**Problema.** Removemos esses 3 campos do tipo TS `Profile` (atendy-v2 não os lê mais), mas continuam vivos no banco com dados:

- `specialty` (enum): 59/71 preenchidos, 7 valores (atendimento, video, audio, design, gestor, celebridade, video_kv). Lido por 3 RPCs: `get_celebrity_board_data`, `get_production_dashboard_metrics`, `get_team_members_with_email`.
- `permissions` (jsonb): 71/71 preenchidos com 14 flags granulares. Lido por `get_team_members_with_email`.
- `autorizado_tirar_analise_ia` (bool): 2 usuários `TRUE`. Consumo externo desconhecido.

**Impacto.** Drift entre o modelo da app (sem esses campos) e o modelo do banco (com eles). Outras integrações podem ainda depender.

**Proposta.** Aguardar o resultado do task spawnado ("Investigar uso real das RPCs com specialty/permissions") antes de decidir drop/migrate/manter.

---

## 7) Convenção `ON DELETE` mista entre FKs apontando para `profiles.id`

**Problema.** Auditei as 33 FKs que referenciam `profiles.id` ao preparar o delete da conta de teste. A política de delete é heterogênea:

- **CASCADE** (5): `alarms`, `client_comments.author_id`, `conversation_notes.author_id`, `note_reactions.user_id`, `system_notifications.target_user_id`. Apagar a pessoa apaga as notas, comentários, alarmes.
- **SET NULL** (12): `clientes_cadastro.responsavel_atendimento`, `contacts.created_by`, `conversations.assigned_to`, vários `production_tasks.*`, `task_history.*`, `task_scripts.*`, `client_adjustments.*`. Apagar a pessoa só desatribui.
- **NO ACTION** (8): `celebrity_approvals.*`, `celebrity_approval_history.reviewer_id`, `client_meetings.organizer_id`, `client_productions.*`, `client_stage_history.*`, `clientes_cadastro.assigned_to`. Bloqueia o delete se houver referência.

**Impacto.** Deletar um usuário ativo (não-teste) provavelmente falhará por causa das FKs `NO ACTION`, exigindo limpeza manual antes. Não há um caminho padronizado.

**Proposta.**
1. Decidir uma política única por categoria semântica: dados "autorais" (notas, comentários) → CASCADE ou SET NULL; dados "operacionais" (atribuições, ações em workflows) → SET NULL; histórico imutável → NO ACTION (e exigir limpeza explícita).
2. Migration para alinhar as exceções (especialmente `client_productions.created_by` que hoje é NO ACTION mas conceitualmente é "autoria").
3. Documentar essa política no `CLAUDE.md` ou `docs/db-conventions.md`.

---

## 8) Validação de role no INSERT/UPDATE no `/api/admin/users` é só Zod

**Problema.** [`createAdminUserSchema`](../lib/auth/validation.ts) e `updateAdminUserSchema` validam `role` contra a lista `roleOptions` no client/server. O banco também aceita só valores do enum `user_role`. Mas **não há defesa em profundidade contra mismatch**: se alguém adicionar uma role no banco sem atualizar o TS (ou vice-versa), o erro só aparece em produção.

**Proposta.**
1. Adicionar um test que faz `SELECT enum_range(NULL::user_role)` e compara com `roleOptions` do TS (rodar em CI ou pre-commit).
2. Alternativa de longo prazo: gerar tipos TS a partir do banco com `supabase gen types typescript` no CI e falhar se houver drift.

---

## 9) `roleOptions` em `validation.ts` ainda é hardcoded

**Problema.** A lista `["admin","supervisor","producao","attendant","cs_head","dev"]` aparece em [`lib/auth/validation.ts:3`](../lib/auth/validation.ts) **e** no `UserRole` em [`lib/auth/types.ts:1`](../lib/auth/types.ts). Duas fontes da verdade próximas, fáceis de drift-ar.

**Proposta.** Derivar uma da outra:
```ts
// types.ts
export const ROLES = ["admin","supervisor","producao","attendant","cs_head","dev"] as const;
export type UserRole = (typeof ROLES)[number];

// validation.ts
import { ROLES } from "./types";
export const roleSchema = z.enum(ROLES);
```

---

## 10) `hooks/use-auth.tsx` ainda tem checks por role hardcoded

**Problema.** [Linhas 241-245](../hooks/use-auth.tsx) calculam `isAdmin`, `isSupervisor`, `isCsHead`, `isDev`, `isCsAccess` com `profile?.role === "x"` direto. Não usam `roleHasCapability`.

**Impacto.** Se amanhã `supervisor` virar parte de `csArea`, ou `dev` ganhar `adminArea`, precisamos editar tanto `capabilities.ts` quanto `use-auth.tsx`. O ponto único de verdade prometido pelo refactor não é cumprido no client.

**Proposta.** Refatorar `useAuth` para expor `hasCapability("adminArea")` em vez de booleans por role. Os consumidores ([`site-shell.tsx:133,149-150`](../components/layout/site-shell.tsx)) também passam a chamar `hasCapability`. Volume baixo (1 hook + 1 consumer).

---

## 11) Reversão de role do Ailton Santos (origem externa)

**Problema.** Após o batch da rodada 1 colocar Ailton em `dev`, um processo externo o moveu de volta para `admin` (updated_at = 2026-05-20 20:45 UTC). Não há audit log nativo nessa tabela para apontar o autor.

**Impacto.** Quebra a expectativa de "mudanças aplicadas via Claude são duradouras" e impede de saber se outras roles foram revertidas sem nosso conhecimento. Indica que existe interface (provavelmente o próprio painel admin de `users-admin.tsx`) ou outro caminho criando concorrência de escrita.

**Proposta.**
1. Confirmar com o usuário o intento real (Ailton volta para admin? Foi mudança consciente?).
2. Considerar adicionar audit trail em `profiles.role` mudanças (trigger que escreve em `profile_audit_log` com `changed_by`, `from_role`, `to_role`, `changed_at`).

---

## Resumo das prioridades sugeridas

| # | Item | Esforço | Risco se ignorar |
|---|---|---|---|
| 1 | Normalizar status `inativo` | Baixo | Médio (3 contas operando indevidamente como active) |
| 2 | Confirmar "HEAD" = cs_head para Ruas | Conversa | Médio (acesso indevido a `/cs`) |
| 11 | Confirmar reversão Ailton + considerar audit log | Baixo | Médio (mudanças silenciosas) |
| 5 | Smoke test attendant/dev/designer pós-mudança | Baixo | Médio (regressão no shell) |
| 10 | `useAuth` usar `roleHasCapability` | Baixo | Baixo |
| 8/9 | Defesa em profundidade enum/TS | Baixo | Baixo |
| 3 | Deduplicar perfis-fantasma | Médio | Baixo |
| 6 | Drop dos 3 campos remanescentes | Depende do follow-up | Baixo |
| 7 | Padronizar FKs `ON DELETE` | Alto | Baixo |
| 4 | Deletar conta "aaaa" | Trivial | Trivial |
| 4b | Resolver Micaela com 16 aprovações | Baixo | Baixo |
