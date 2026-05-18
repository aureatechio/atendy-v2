---
name: supabase-auth-atendy
description: Especialista em autenticação Supabase no projeto Atendy. Use sempre que o usuário mencionar login, cadastro, sessão, logout, recuperação de senha, Supabase Auth, AuthProvider, useAuth, profiles, user_roles, RLS de autenticação, proxy/middleware, rotas públicas/protegidas, permissões por role, bloqueio/aprovação de usuários, service role, Edge Functions com requireAuth/requireAdmin ou qualquer problema de acesso no produto.
---

# Supabase Auth Atendy

Use esta skill para implementar, revisar ou depurar autenticação e autorização no Atendy.

O módulo de Auth não é isolado: ele decide se o shell autenticado renderiza, se consultas protegidas por RLS funcionam e se usuários podem acessar áreas críticas. Trate mudanças em Auth como mudanças de plataforma.

## Contexto Canonico

- Projeto Supabase correto: `cfgeilnppnlyhwnabkox`.
- MCP correto: `supabase_atendy`.
- URL Supabase: `https://cfgeilnppnlyhwnabkox.supabase.co`.
- Não use o MCP `supabase_crm` para este projeto.
- Contexto detalhado local: `.context/modules_old/modules/auth/README.md`.
- Contexto do alvo Supabase: `.context/modules_old/modules/supabase-mcp/README.md`.

Antes de qualquer trabalho remoto no Supabase, confirme o alvo com `supabase_atendy` ou com o preflight documentado no projeto.

## Objetivo do Modulo

Auth conecta:

- Supabase Auth (`auth.users`);
- tabela `profiles`;
- tabela auxiliar `user_roles`;
- proteção de rotas via `src/proxy.ts`;
- estado global em `src/hooks/use-auth.tsx`;
- fluxos públicos de login, cadastro, esqueci senha, reset e callback;
- permissões derivadas para todo o app autenticado.

## Arquivos Principais

Leia estes arquivos antes de alterar comportamento:

- `src/hooks/use-auth.tsx`
- `src/proxy.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/app/(public)/login/page.tsx`
- `src/app/(public)/register/page.tsx`
- `src/app/(public)/forgot-password/page.tsx`
- `src/app/(public)/reset-password/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/components/auth/*.tsx`
- `src/lib/validations/auth.ts`
- `src/app/(auth)/layout.tsx`
- `src/app/api/admin/users/route.ts`
- `supabase/functions/_shared/auth.ts`

## Regras de Negocio

- Usuário autenticado só deve usar o produto quando existir `user` e `profiles.status = 'active'`.
- `profiles.status = 'pending'` mantém sessão, mas não deve liberar o shell autenticado.
- `profiles.status = 'blocked'` deve impedir uso e precisa estar alinhado com banimento no Supabase Auth.
- `admin` tem administração completa.
- `supervisor` pode acessar áreas administrativas permitidas.
- `producao` é o papel operacional padrão.
- Cadastro público historicamente permite escolher `role`; endurecer esse fluxo exige decisão de produto.
- Usuários novos devem sair do signup com `profiles` e `user_roles` criados.

## Fluxo Esperado

1. Rotas públicas permitidas: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback`.
2. Rotas autenticadas sem sessão redirecionam para `/login?redirectTo=<path>`.
3. Login usa Supabase Auth e depois carrega `profiles`.
4. `useAuth()` observa `onAuthStateChange`, guarda `session`/`user` e busca o profile.
5. `isAuthenticated` deriva de `!!user && profile?.status === 'active'`.
6. `/admin` exige checagem extra server-side de `profiles.status` e `profiles.role`.
7. Usuário ativo em rota pública deve ir para `/dashboard`.
8. Reset de senha passa por `/auth/callback`, atualiza senha, faz logout e volta para `/login?password_updated=1`.

## Supabase Clients

Use `@supabase/ssr`:

- Browser client em `src/lib/supabase/client.ts`.
- Server client em `src/lib/supabase/server.ts`.
- Proxy/API/Route Handlers devem respeitar cookies de sessão.

No proxy, prefira `auth.getUser()` em vez de `auth.getSession()`, porque `getUser()` valida o JWT e renova sessão.

Não exponha `SUPABASE_SERVICE_ROLE_KEY` em client components. Service role só pertence a API routes server-side, Edge Functions privilegiadas ou scripts controlados.

## Profiles e User Roles

Campos centrais em `profiles`:

- `id`
- `full_name`
- `email`
- `avatar_url`
- `role`
- `status`
- `specialty`
- `permissions`
- `is_team_admin`
- `autorizado_tirar_analise_ia`
- `created_at`
- `updated_at`

Tabela `user_roles` ainda é relevante para helpers e policies legadas. Não assuma que `profiles.role` substitui todos os usos históricos.

Regra crítica: depois de signup, confirme criação de `profiles` e `user_roles`.

## RLS

Ao criar ou alterar policies:

- Não consulte `profiles` diretamente dentro de `USING()` ou `WITH CHECK()`.
- Use helpers `SECURITY DEFINER` para evitar recursão.
- Atenção ao erro `42P17: infinite recursion detected in policy`.

Helpers esperados:

- `get_user_role(uuid)`
- `get_user_status(uuid)`
- `is_admin()`
- `is_admin_or_supervisor()`
- `is_active_user()`

Policies esperadas em `profiles`:

- SELECT: self ou admin/supervisor.
- INSERT: self ou admin.
- UPDATE: self ou admin.

## Trigger de Signup

`public.handle_new_user` é sensível e já teve regressões.

Fluxo obrigatório:

1. signup cria conta em `auth.users`;
2. trigger cria ou atualiza `profiles`;
3. trigger cria `user_roles`;
4. usuário novo consegue logar e acessar rotas protegidas.

Antes de alterar ou reaplicar trigger, confira a função vigente no banco. A migration `20260207135000_apply_producao_role.sql` é referência recente, mas o contexto antigo alerta que ela pode não inserir em `user_roles`.

## Edge Functions

Para funções chamadas pelo frontend, use o helper:

```ts
const authResult = await requireAuth(req)
if (isAuthError(authResult)) {
  return authResult.error
}
const { user, serviceClient } = authResult
```

Para admin:

- use `requireAdmin(req)`;
- valide `profiles.role = 'admin'` com service role;
- registre claramente quando uma rota usa privilégio administrativo.

Funções com validação interna devem ser deployadas com:

```bash
supabase functions deploy nome-da-funcao --no-verify-jwt
```

Motivo: com `verify_jwt` ativo no runtime, a função pode retornar 401 antes do código rodar.

## Checklist Antes de Implementar

- Leia o contexto em `.context/modules_old/modules/auth/README.md` se a mudança for maior que ajuste visual.
- Confirme se já existem `client.ts`, `server.ts`, `use-auth.tsx` e `proxy.ts`.
- Mapeie quais rotas são públicas, autenticadas e admin.
- Confirme o contrato de `profiles` antes de escrever queries.
- Confirme se a mudança depende de RLS, trigger ou service role.
- Se tocar signup, verifique `profiles` e `user_roles`.
- Se tocar reset, alinhe callback, redirect e template de e-mail.

## Checklist de Validacao

Para mudanças em Auth, valide no mínimo:

- login com usuário ativo;
- redirect de rota autenticada sem sessão;
- redirect de rota pública com usuário ativo;
- cadastro cria `profiles` e `user_roles`;
- `/admin` bloqueia usuário sem role permitida;
- usuário bloqueado não consegue usar o produto;
- reset de senha passa por `/auth/callback` e volta para `/login?password_updated=1`;
- ausência de erro `42P17` após alterações em policies.

Testes úteis quando existirem:

```bash
pnpm test -- src/components/auth/__tests__/auth-forms.test.tsx
pnpm test -- src/lib/validations/__tests__/auth.test.ts
pnpm test -- src/lib/supabase/__tests__/client.test.ts src/lib/supabase/__tests__/server.test.ts
```

## Sinais de Risco

Pare e investigue com cuidado se encontrar:

- tela autenticada em branco após login;
- `profile` ausente para usuário logado;
- login funciona, mas queries retornam vazio;
- erro `42P17`;
- Edge Function retorna 401 sem logs;
- usuário criado pelo admin existe no Auth, mas não em `profiles`;
- `profiles.status` e banimento no Auth divergentes;
- redirect aceitando URL externa.

## Saida Esperada ao Usar Esta Skill

Quando responder sobre Auth no Atendy:

- diga quais arquivos precisam ser lidos ou alterados;
- separe regra de negócio, Supabase/RLS e UI;
- explicite riscos de segurança;
- preserve o padrão existente do projeto;
- proponha validação mínima proporcional ao risco.
