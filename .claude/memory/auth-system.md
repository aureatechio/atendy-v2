---
name: auth-system
description: "Sistema de autenticação e autorização — Supabase Auth + tabela `profiles`, roles + capabilities, guards (`canAccessCS`, `canAccessAdmin`), `getAuthSnapshot`, `requireAdminAccess`"
metadata:
  node_type: memory
  type: project
  originSessionId: clientes-context-engineering-2026-05-26
---

Autenticação é **Supabase Auth + tabela `profiles`** com sistema de **capabilities** (não roles diretas) em todos os checks. Resumo: `AuthSnapshot` é o estado canonical, `roleHasCapability(role, capability)` é o gate único. Refator de roles foi feito em mai/2026 — débitos em [docs/role-system-cleanup-debts.md](docs/role-system-cleanup-debts.md).

**Why:** Antes do refactor, cada lugar inlinea arrays de roles (`["admin", "supervisor"]`). Capabilities consolidam isso — adicionar role nova precisa só atualizar `CAPABILITIES` em um lugar.

**How to apply:** **Nunca inlinear arrays de roles** em código novo. Sempre `roleHasCapability(role, "csArea")` etc. Para criar nova área gated, primeiro adicionar capability em [lib/auth/capabilities.ts](lib/auth/capabilities.ts).

### Roles (`UserRole`)

7 roles em produção ([lib/auth/types.ts:1](lib/auth/types.ts:1) e [lib/auth/validation.ts:3](lib/auth/validation.ts:3)):

```ts
type UserRole = "admin" | "supervisor" | "attendant" | "producao" | "cs_head" | "dev" | "designer"
```

Distribuição (snapshot 2026-05-20): `producao 32, admin 10, supervisor 10, attendant 8, cs_head 2, dev 2, designer 2`.

### Status (`UserStatus`)

`type UserStatus = "pending" | "active" | "blocked"`

⚠️ **Existem 3 perfis em produção com `status = "inativo"`** (string fora do enum) que `getAuthSnapshot` trata como `active` por default — débito conhecido. Ver [docs/role-system-cleanup-debts.md](docs/role-system-cleanup-debts.md) §1.

### Capabilities ([lib/auth/capabilities.ts](lib/auth/capabilities.ts))

```ts
type Capability = "adminOnly" | "adminArea" | "csArea" | "settingsArea"

CAPABILITIES = {
  adminOnly:    ["admin"],                       // Mutations sensíveis
  adminArea:    ["admin", "supervisor"],         // Read + light ops
  csArea:       ["admin", "dev", "cs_head"],     // Customer Success
  settingsArea: ["admin", "dev", "cs_head"],     // Etapas/SLAs/feriados
}

roleHasCapability(role, capability) → boolean
```

`canAccessSettings(snapshot)` em [lib/auth/guards.ts](lib/auth/guards.ts) usa `settingsArea`.

### Impersonação (dev-only)

Dev entra na conta de qualquer usuário **ativo** com um clique. Capability `impersonate: ["dev"]`.
- Página [app/(protected)/impersonar/page.tsx](app/(protected)/impersonar/page.tsx) — fora do layout `/admin` (que bloqueia dev via `adminArea`); guard próprio com `roleHasCapability(role, "impersonate")`. UI em [components/admin/impersonation-panel.tsx](components/admin/impersonation-panel.tsx).
- Endpoints [app/api/admin/impersonate/route.ts](app/api/admin/impersonate/route.ts): `GET` lista candidatos, `POST` inicia. Stop em [.../stop/route.ts](app/api/admin/impersonate/stop/route.ts).
- **Mecanismo:** `admin.auth.admin.generateLink({ type: "magiclink" })` → `supabase.auth.verifyOtp({ token_hash })` troca os cookies de sessão para o alvo. Não há API nativa de impersonação no Supabase.
- **Voltar:** cookie httpOnly **assinado (HMAC-SHA256)** `atendy-impersonator` guarda `{ impersonatorId, impersonatorName }` ([lib/auth/impersonation.ts](lib/auth/impersonation.ts)). Stop verifica assinatura + re-checa que a conta original ainda é dev ativo, faz verifyOtp de volta e limpa o cookie. Segredo: `IMPERSONATION_SECRET` (fallback = service role key).
- **Banner** global enquanto impersonando: protected layout decodifica o cookie e passa `impersonation` pra `SiteShell`.
- Bloqueios: impersonação aninhada (409), alvo = você mesmo (400), alvo não-ativo (400).

⚠️ `attendant`, `producao`, `designer` **não têm capability** — são roles operacionais sem gates além do login.

### `AuthSnapshot` ([lib/auth/session.ts](lib/auth/session.ts))

Estado canonical (5 status):

```ts
type AuthSnapshot =
  | { status: "anonymous";       user: null;        profile: null }
  | { status: "active";          user: AuthUserSummary; profile: Profile }
  | { status: "pending";         user: AuthUserSummary; profile: Profile }   // email confirmation pending
  | { status: "blocked";         user: AuthUserSummary; profile: Profile }   // banido
  | { status: "profile_missing"; user: AuthUserSummary; profile: null }      // auth user sem row em profiles
```

`ActiveAuthSnapshot = Extract<..., { status: "active" }>` — refinement.

### `getAuthSnapshot` ([lib/auth/get-auth-snapshot.ts](lib/auth/get-auth-snapshot.ts))

- Wrapped em `React.cache` — chamável múltiplas vezes no mesmo request sem refetch.
- 2 queries: `auth.getUser()` + `profiles` por id (`profileSelectColumns`).
- Returns `"anonymous"` se erro/sem user, `"profile_missing"` se user sem row, `"blocked"`/`"pending"` por status, senão `"active"`.
- **Default case = `"active"`** — qualquer status fora dos branches conhecidos (ex.: `"inativo"`) cai aqui. Bug latente.

### Guards de página ([lib/auth/guards.ts](lib/auth/guards.ts))

| Função | Quando usar |
|---|---|
| `getProtectedAuthRedirect(snapshot, pathname)` | Em layout protected. Retorna URL pra redirect ou `null` se ativo |
| `buildLoginRedirect(pathname)` | Constrói `/login?redirectTo=...` |
| `canAccessAdmin(snapshot)` | Boolean: admin OR supervisor |
| `canAccessCS(snapshot)` | Boolean: admin OR dev OR cs_head |

Usados em:
- `app/(protected)/cs/layout.tsx` — gate da área CS
- `app/(protected)/admin/*` — gate da área admin

### `requireAdminAccess` ([lib/auth/requireAdmin.ts](lib/auth/requireAdmin.ts))

Para **server actions e API routes** (não páginas). Retorna union discriminada:

```ts
type AdminAccessFailure = { error: NextResponse; user?: never }
type AdminAccessSuccess = { user: { id; email? }; error?: never }

await requireAdminAccess({ capability: "adminArea" })
// → check: { error: NextResponse } ? return access.error : usa access.user
```

- Default capability: `"adminOnly"`.
- Faz 2 queries (`auth.getUser` + `profiles`).
- Verifica `profile.status === "active"` E `roleHasCapability(profile.role, capability)`.
- 401 se sem user, 403 se sem permissão.
- Padrão de uso em todos os endpoints `/api/admin/*`:
  ```ts
  const access = await requireAdminAccess({ capability: "adminArea" });
  if (access.error) return access.error;
  ```

### Debug ([lib/auth/debug.ts](lib/auth/debug.ts))

`logAuthTiming(label, startedAt)` / `timeAuthStep(label, fn)` — só logam se `NEXT_PUBLIC_AUTH_DEBUG=1` (client) ou `AUTH_DEBUG=1` (server).

### Validation Zod ([lib/auth/validation.ts](lib/auth/validation.ts))

- `loginSchema` — email + password (min 1)
- `forgotPasswordSchema` — email
- `resetPasswordSchema` — password min 8 + confirm matching
- `createAdminUserSchema` — POST `/api/admin/users` (cria via service role)
- `updateAdminUserSchema` — PATCH

`roleOptions` e `statusOptions` como `as const` — fontes únicas para enums Zod.

### Tabela `profiles`

```ts
type Profile = {
  id: string                  // = auth.users.id
  full_name: string
  avatar_url: string | null
  role: UserRole
  status: UserStatus
  created_at, updated_at
}

type AdminUser = Profile & {
  email: string                     // auth.users.email
  auth_created_at: string | null
  last_sign_in_at: string | null
}
```

`profileSelectColumns = "id, full_name, avatar_url, role, status, created_at, updated_at"`.

### Helpers adicionais

- [lib/auth/last-login.ts](lib/auth/last-login.ts) — **só formatadores de data** (`formatLastLogin` / `formatLastLoginDetails`). NÃO registra login; `last_sign_in_at` vem do Supabase Auth e é exposto via `/api/admin/users`.
- [lib/supabase/server.ts](lib/supabase/server.ts) — `createClient()` (cookies, RLS aplicada)
- [lib/supabase/admin.ts](lib/supabase/admin.ts) — `createAdminClient()` (service role, sem RLS) — usar com cuidado em endpoints protegidos por `requireAdminAccess`

### Padrão de defesa em profundidade

CS module e admin usam **duas camadas**:
1. **Layout/page** — `canAccessCS(snapshot)` no `app/(protected)/cs/layout.tsx`
2. **Server actions/API** — `requireAdminAccess({ capability: "csArea" })` em cada action

Não confiar só na primeira — se action é chamada direto via fetch, a layout não corre.

### Pegadinhas (do refactor + débitos)

- ⚠️ **`status = "inativo"`** em 3 perfis prod (Aurelio Figueiredo, Gabriel Alves, Victor Herrera) — tratados como ativos. Bug latente.
- ⚠️ **"HEAD" ≠ cs_head**: Ruas foi promovida pra `cs_head` mas pode ser head de outra área. Acesso CS pode ser indesejado. Ver débito §2.
- ⚠️ **Não inlinear arrays de roles** — sempre usar capability.
- ⚠️ **`getAuthSnapshot` é cacheado por request** (`React.cache`) — não confundir com cache de produção.
- ⚠️ Defesa em profundidade: page guard + action guard. Não pular o segundo.
- ⚠️ `attendant` / `producao` / `designer` — sem capability, mas têm acesso à área principal (não-admin, não-CS). Confirmar antes de assumir restrição.
- ⚠️ Ailton Santos voltou pra `admin` por mudança externa em 2026-05-20 20:45 UTC — sinal de que UI admin de usuários pode contradizer mudanças por código.
