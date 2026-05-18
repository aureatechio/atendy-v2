# Modulo Auth

Documentacao tecnica do modulo Auth.

Ultima atualizacao: 2026-05-12

## Objetivo

O modulo Auth centraliza autenticacao, sessao, autorizacao basica e recuperacao de senha da plataforma. Ele conecta Supabase Auth (`auth.users`), tabela `profiles`, tabela auxiliar `user_roles`, protecao de rotas via `src/proxy.ts`, estado global em `useAuth()` e fluxos publicos de login, cadastro e reset de senha.

Auth nao e uma area isolada: todo o produto sob `src/app/(auth)` depende dele para decidir se o usuario pode ver o shell autenticado, carregar profile e executar consultas protegidas por RLS.

## Principais caminhos

| Area                         | Caminho                                                                    | Papel                                                                 |
| ---------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Login                        | `src/app/(public)/login/page.tsx`                                          | Pagina publica de entrada                                             |
| Cadastro                     | `src/app/(public)/register/page.tsx`                                       | Pagina publica de criacao de conta                                    |
| Esqueci senha                | `src/app/(public)/forgot-password/page.tsx`                                | Solicita e-mail de recuperacao                                        |
| Reset de senha               | `src/app/(public)/reset-password/page.tsx`                                 | Define nova senha apos callback                                       |
| Callback Auth                | `src/app/auth/callback/route.ts`                                           | Troca `code`/`token_hash` por sessao e redireciona                    |
| Forms Auth                   | `src/components/auth/*.tsx`                                                | Componentes client-side dos fluxos publicos                           |
| Validacoes                   | `src/lib/validations/auth.ts`                                              | Schemas Zod e opcoes de role                                          |
| Auth context                 | `src/hooks/use-auth.tsx`                                                   | Sessao, usuario, profile, sign in/up/out e derivacoes de permissao    |
| Layout autenticado           | `src/app/(auth)/layout.tsx`                                                | Shell, sidebar, user menu, alarmes, presenca e guard client-side      |
| Proxy                        | `src/proxy.ts`                                                             | Protecao server-side de rotas publicas, autenticadas e `/admin`       |
| Supabase browser client      | `src/lib/supabase/client.ts`                                               | Singleton para client components                                      |
| Supabase server client       | `src/lib/supabase/server.ts`                                               | Client SSR/API baseado em cookies                                     |
| API admin usuarios           | `src/app/api/admin/users/route.ts`                                         | Cria, reativa e bloqueia usuarios com service role                    |
| Auth Edge compartilhado      | `supabase/functions/_shared/auth.ts`                                       | `requireAuth`, `requireAdmin`, `getServiceClient`, `isAuthError`      |
| Template de recuperacao      | `supabase/templates/recovery.html`                                         | HTML do e-mail de reset de senha                                      |
| Doc de templates             | `docs/SUPABASE_EMAIL_TEMPLATES.md`                                         | Como aplicar template no Supabase Cloud                               |
| RLS de profiles              | `supabase/migrations/20260505190000_fix_profiles_rls_recursion.sql`        | Helpers `SECURITY DEFINER` e policies de `profiles` sem recursao      |
| Trigger signup consolidado   | `supabase/migrations/20260207135000_apply_producao_role.sql`               | Versao mais recente no repo de `handle_new_user`                      |
| E2E publico                  | `e2e/public-auth.spec.ts`                                                  | Validacao de telas publicas e navegacao                               |
| E2E autenticado              | `e2e/authenticated.spec.ts`                                                | Login real, shell autenticado, perfil e navegacao                     |
| Testes forms                 | `src/components/auth/__tests__/auth-forms.test.tsx`                        | Unit/integration dos forms                                            |
| Testes validacoes            | `src/lib/validations/__tests__/auth.test.ts`                               | Schemas Zod                                                           |
| Testes shared auth           | `supabase/functions/_shared/auth.test.ts`                                  | Erros basicos do helper de Edge Functions                             |

## Funcionamento geral

1. Visitantes acessam rotas publicas: `/login`, `/register`, `/forgot-password`, `/reset-password` e `/auth/callback`.
2. `src/proxy.ts` permite rotas publicas e redireciona visitantes sem sessao para `/login`.
3. Apos login, Supabase grava cookies de sessao e o proxy libera rotas autenticadas.
4. `AuthProvider` observa `supabase.auth.onAuthStateChange`, guarda `session`/`user` e busca `profiles` pelo `user.id`.
5. `isAuthenticated` so fica verdadeiro quando existe usuario e `profile.status === 'active'`.
6. O layout autenticado renderiza sidebar, header, user menu, dropdown de alarmes e providers globais.
7. Rotas `/admin` recebem checagem server-side adicional de `profiles.status` e `profiles.role`.

## Rotas publicas

| Rota               | Form                         | Acao principal                                                        |
| ------------------ | ---------------------------- | --------------------------------------------------------------------- |
| `/login`           | `LoginForm`                  | `signIn(email, password)` e redireciona para `/dashboard`             |
| `/register`        | `RegisterForm`               | `signUp(email, password, fullName, role)` e redireciona para `/chat`  |
| `/forgot-password` | `ForgotPasswordForm`         | `resetPassword(email)` e mostra resposta neutra                       |
| `/reset-password`  | `ResetPasswordForm`          | `updatePassword(password)`, `signOut()` e volta para `/login`         |
| `/auth/callback`   | route handler server-side    | Valida link/codigo do Supabase e redireciona para o `next` permitido  |

### Login

Arquivo: `src/components/auth/login-form.tsx`

Fluxo:

1. valida `email` e `password` com `loginSchema`;
2. chama `useAuth().signIn`;
3. em erro, mostra toast generico de credenciais invalidas;
4. em sucesso, mostra toast e navega para `/dashboard`;
5. trata query params `error=blocked`, `error=profile_missing` e `password_updated=1`.

Erros vindos do proxy:

| Query param        | Mensagem exibida                         | Origem esperada                         |
| ------------------ | ---------------------------------------- | --------------------------------------- |
| `blocked`          | Conta bloqueada                          | Usuario banido/bloqueado em `/admin`    |
| `profile_missing`  | Erro no cadastro                         | Sessao existe, mas nao ha `profiles`    |
| `password_updated` | Senha atualizada, entrar com nova senha  | Reset de senha finalizado               |

### Cadastro

Arquivo: `src/components/auth/register-form.tsx`

Payload enviado ao Supabase Auth:

```ts
{
  email: string
  password: string
  options: {
    data: {
      full_name: string
      role: 'producao' | 'supervisor' | 'admin'
    }
  }
}
```

Depois do signup, o form aguarda brevemente e verifica se o trigger criou `profiles`. Se o profile nao aparecer, mostra aviso, mas continua o fluxo. A criacao efetiva de `profiles` e `user_roles` deve ser garantida pelo trigger `public.handle_new_user`.

Ponto de atencao: o cadastro publico permite escolher role no form. Antes de endurecer esse fluxo, revisar produto, administracao de equipe e policies.

### Recuperacao de senha

Arquivo: `src/components/auth/forgot-password-form.tsx`

O fluxo chama:

```ts
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth/callback`,
})
```

A resposta da UI e neutra: mesmo se o envio falhar, o usuario ve "Confira seu e-mail". O erro fica no console para evitar enumeracao de e-mails cadastrados.

Observacao: `docs/SUPABASE_EMAIL_TEMPLATES.md` mostra o formato com `?next=/reset-password`. Se ajustar o redirect no codigo, manter a doc e o template alinhados.

### Callback e reset

Arquivo: `src/app/auth/callback/route.ts`

O callback aceita dois formatos:

| Parametros                  | Metodo Supabase                      |
| --------------------------- | ------------------------------------ |
| `token_hash` + `type`       | `supabase.auth.verifyOtp()`          |
| `code`                      | `supabase.auth.exchangeCodeForSession()` |

`safeRedirectPath()` permite apenas caminhos relativos iniciados por `/` e rejeita `//`, evitando open redirect. Se falhar, redireciona para `/reset-password?error=invalid_link`.

Arquivo: `src/components/auth/reset-password-form.tsx`

O reset:

1. valida senha e confirmacao com `resetPasswordSchema`;
2. chama `updatePassword(newPassword)`;
3. em sucesso, chama `signOut()`;
4. redireciona para `/login?password_updated=1`.

## AuthProvider / useAuth

Arquivo: `src/hooks/use-auth.tsx`

Responsabilidades:

- criar client Supabase browser via `createClient()`;
- observar `supabase.auth.onAuthStateChange`;
- atualizar `session`, `user` e `profile`;
- buscar `profiles` por `user.id`;
- expor funcoes de auth;
- derivar status e permissoes comuns.

Funcoes expostas:

| Funcao           | Supabase API                                  |
| ---------------- | --------------------------------------------- |
| `signIn`         | `auth.signInWithPassword`                     |
| `signUp`         | `auth.signUp`                                 |
| `signOut`        | `auth.signOut`                                |
| `resetPassword`  | `auth.resetPasswordForEmail`                  |
| `updatePassword` | `auth.updateUser({ password })`               |
| `refreshProfile` | `profiles.select('*').eq('id', user.id)`      |

Derivacoes:

| Campo                        | Regra atual                                      |
| ---------------------------- | ------------------------------------------------ |
| `isAuthenticated`            | `!!user && profile?.status === 'active'`         |
| `isPending`                  | `!!user && profile?.status === 'pending'`        |
| `isBlocked`                  | `!!user && profile?.status === 'blocked'`        |
| `isAdmin`                    | `profile?.role === 'admin'`                      |
| `isSupervisor`               | `profile?.role === 'supervisor' || isAdmin`      |
| `specialty`                  | `profile?.specialty ?? null`                     |
| `isTeamAdmin`                | `profile?.is_team_admin ?? false`                |
| `isAutorizadoTirarAnaliseIA` | `profile?.autorizado_tirar_analise_ia ?? false`  |

Comportamento importante: o provider para o loading inicial assim que o listener de auth dispara, sem bloquear a tela esperando profile. Tambem ha fallback de 2 segundos para evitar skeleton infinito.

## Supabase clients

### Browser

Arquivo: `src/lib/supabase/client.ts`

- usa `createBrowserClient`;
- retorna `null` se `NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` nao estiverem configurados;
- mantem singleton em memoria;
- `isSupabaseConfigured()` tambem rejeita placeholders `your_supabase_project_url` e `your_supabase_anon_key`.

### Server

Arquivo: `src/lib/supabase/server.ts`

- usa `createServerClient`;
- le cookies via `next/headers`;
- permite `setAll()` quando chamado de contexts que aceitam escrita de cookie;
- e usado em API routes e route handlers server-side.

## Protecao de rotas no proxy

Arquivo: `src/proxy.ts`

Rotas publicas:

```ts
[
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
]
```

Rotas admin:

```ts
['/admin']
```

Fluxo do proxy:

1. se Supabase nao estiver configurado, permite tudo para desenvolvimento;
2. cria client SSR com cookies da request;
3. chama `supabase.auth.getUser()` para validar JWT e renovar sessao;
4. em rota publica, permite `/reset-password` e `/auth/callback`;
5. em outra rota publica com usuario ativo, redireciona para `/dashboard`;
6. sem sessao, redireciona para `/login?redirectTo=<path>`;
7. em rotas nao-admin autenticadas, retorna sem buscar profile;
8. em `/admin`, busca `profiles.status, role`;
9. sem profile, faz sign out e redireciona para `/login?error=profile_missing`;
10. com `status = blocked`, faz sign out e redireciona para `/login?error=blocked`;
11. se role nao for `admin` nem `supervisor`, redireciona para `/chat`.

Ponto de comportamento: rotas autenticadas comuns nao pagam uma query de profile a cada navegacao. A protecao fina fica com AuthProvider, UI e RLS.

## Layout autenticado

Arquivo: `src/app/(auth)/layout.tsx`

O layout:

- consome `useAuth()`;
- renderiza skeleton enquanto `isLoading`;
- retorna `null` se `!isAuthenticated`;
- monta `PresenceProvider`;
- monta `AlarmNotificationProvider`;
- renderiza header, `SidebarNav`, `UserMenu`, `AlarmHeaderDropdown` e `WhatsAppStatusIndicator` no Chat;
- redireciona usuarios com especialidade `aprovacao_celebridade` ou `celebridade` para `/celebridade`, exceto em `/celebridade` e `/profile`.

Alteracoes aqui impactam todas as telas autenticadas.

## Contratos e validacoes

Arquivo: `src/lib/validations/auth.ts`

Roles aceitas no form:

```ts
['producao', 'supervisor', 'admin']
```

Schemas:

| Schema                 | Campos                                               |
| ---------------------- | ---------------------------------------------------- |
| `loginSchema`          | `email`, `password`                                  |
| `registerSchema`       | `fullName`, `email`, `role`, `password`              |
| `forgotPasswordSchema` | `email`                                              |
| `resetPasswordSchema`  | `password`, `confirmPassword` com igualdade exigida  |

Senha no cadastro exige apenas campo preenchido no schema client-side. Senha no reset exige minimo de 6 caracteres e deve ser diferente da senha atual por tratamento da API Supabase em `updatePassword()`.

## API admin de usuarios

Arquivo: `src/app/api/admin/users/route.ts`

Esta API pertence operacionalmente ao modulo Gerenciar Equipe, mas altera Auth diretamente.

### `POST /api/admin/users`

Cria ou reativa usuario. A rota:

1. chama `verifyAdmin()`;
2. exige profile com `role = 'admin'`;
3. cria admin client com `SUPABASE_SERVICE_ROLE_KEY`;
4. chama `admin.auth.admin.createUser()`;
5. faz upsert em `profiles` com `status = 'active'`;
6. se o e-mail ja existir, procura em `admin.auth.admin.listUsers()`, remove banimento, atualiza senha/metadados e reativa o profile.

Payload:

```ts
{
  email: string
  password: string
  fullName: string
  role?: 'admin' | 'supervisor' | 'producao'
  specialty?: UserSpecialty | null
}
```

Erros:

| Condicao                                  | Status |
| ----------------------------------------- | ------ |
| solicitante nao autenticado/nao admin     | `403`  |
| `email`, `password` ou `fullName` ausente | `400`  |
| senha menor que 6                         | `400`  |
| erro Supabase Auth/profile                | `500`  |

### `DELETE /api/admin/users?id=<uuid>`

Bloqueia usuario:

1. exige admin;
2. atualiza `profiles.status = 'blocked'`;
3. aplica banimento via `admin.auth.admin.updateUserById(id, { ban_duration: '876600h' })`;
4. retorna `{ success: true }`.

Ponto de atencao: se o banimento falhar, o erro e logado, mas o bloqueio em `profiles` nao e revertido.

## Banco de dados

| Objeto        | Uso                                                                 |
| ------------- | ------------------------------------------------------------------- |
| `auth.users`  | Conta Supabase Auth, e-mail, senha, confirmacao, banimento          |
| `profiles`    | Profile aplicacional: nome, role, status, permissao, especialidade  |
| `user_roles`  | Tabela auxiliar historica para RLS/helpers como `is_agent()`        |

Campos centrais em `profiles`:

- `id`;
- `full_name`;
- `email`;
- `avatar_url`;
- `role`;
- `status`;
- `specialty`;
- `permissions`;
- `is_team_admin`;
- `autorizado_tirar_analise_ia`;
- `created_at`;
- `updated_at`.

Roles atuais usadas pela aplicacao:

| Role         | Uso principal                                      |
| ------------ | -------------------------------------------------- |
| `admin`      | Administracao completa e API admin                 |
| `supervisor` | Acesso a areas administrativas permitidas          |
| `producao`   | Usuario operacional padrao                         |

Statuses:

| Status    | Comportamento esperado                                      |
| --------- | ----------------------------------------------------------- |
| `active`  | Pode usar rotas autenticadas                                |
| `pending` | Sessao pode existir, mas `isAuthenticated` fica falso       |
| `blocked` | Proxy faz sign out em `/admin`; UI deve impedir uso normal  |

## RLS e helpers SECURITY DEFINER

Migration de referencia: `supabase/migrations/20260505190000_fix_profiles_rls_recursion.sql`

Helpers:

| Helper                            | Retorno              | Uso                                       |
| --------------------------------- | -------------------- | ----------------------------------------- |
| `get_user_role(uuid)`             | `public.user_role`   | Obter role sem recursao em policy         |
| `get_user_status(uuid)`           | `public.user_status` | Obter status sem recursao em policy       |
| `is_admin()`                      | `boolean`            | Guardas admin                             |
| `is_admin_or_supervisor()`        | `boolean`            | Guardas admin/supervisor                  |
| `is_active_user()`                | `boolean`            | Guardas de usuario ativo                  |

Policies vigentes em `profiles`:

| Policy                         | Operacao | Regra                                           |
| ------------------------------ | -------- | ----------------------------------------------- |
| `profiles_select_self_or_admin` | SELECT   | `id = auth.uid()` ou admin/supervisor           |
| `profiles_insert_self_or_admin` | INSERT   | `id = auth.uid()` ou admin                      |
| `profiles_update_self_or_admin` | UPDATE   | `id = auth.uid()` ou admin                      |

Regra critica do projeto: nao consultar `profiles` diretamente dentro de `USING()`/`WITH CHECK()` de policies. Use os helpers `SECURITY DEFINER`, senao pode ocorrer `42P17: infinite recursion detected in policy`.

## Trigger `handle_new_user`

O trigger de signup ja teve varias regressoes e deve ser tratado como ponto sensivel.

Historico relevante:

| Migration                                                        | Papel                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `20260112091518_create_profile_trigger.sql`                      | Cria trigger inicial para `profiles`                                |
| `20260112160000_bugfix_user_roles_trigger.sql`                   | Passa a criar `user_roles` no signup                                |
| `20260113000000_bugfix_008_role_from_metadata.sql`               | Le role de `raw_user_meta_data`                                     |
| `20260113000001_remove_approval_flow.sql`                        | Remove fluxo de aprovacao                                           |
| `20260114100000_bugfix_009_consolidate_trigger.sql`              | Garante `status = active`                                           |
| `20260207135000_apply_producao_role.sql`                         | Atualiza role padrao para `producao`; versao mais recente no repo   |

Fluxo obrigatorio esperado:

1. signup cria usuario em `auth.users`;
2. `public.handle_new_user` cria/atualiza `profiles`;
3. o mesmo fluxo deve criar `user_roles`;
4. novo usuario deve conseguir logar e acessar rotas protegidas.

Ponto de atencao atual: a migration mais recente no repo, `20260207135000_apply_producao_role.sql`, recria `handle_new_user` com `profiles`, `role = producao` e `status = active`, mas nao mostra `INSERT INTO public.user_roles`. Antes de modificar ou reaplicar esse trigger, conferir a funcao vigente no banco e corrigir para manter `profiles` e `user_roles`, conforme regra critica do `AGENTS.md`.

Sem `user_roles`, policies/helpers legados que dependem de `is_agent()` podem bloquear queries silenciosamente e gerar tela em branco apos login.

## Edge Functions e `_shared/auth.ts`

Arquivo: `supabase/functions/_shared/auth.ts`

Funcoes:

| Funcao              | Uso                                                                         |
| ------------------- | --------------------------------------------------------------------------- |
| `requireAuth(req)`  | Valida header `Authorization: Bearer <jwt>` e retorna user/clientes         |
| `requireAdmin(req)` | Chama `requireAuth` e valida `profiles.role = admin` via service role       |
| `getServiceClient()`| Retorna client service role sem validar usuario; usar apenas em webhooks    |
| `isAuthError()`     | Type guard para retorno de erro                                             |

Padrao para Edge Functions chamadas pelo frontend:

```ts
const authResult = await requireAuth(req)
if (isAuthError(authResult)) {
  return authResult.error
}
const { user, serviceClient } = authResult
```

Deploy esperado para funcoes com validacao interna:

```bash
supabase functions deploy nome-da-funcao --no-verify-jwt
```

Motivo: se `verify_jwt` ficar no padrao implicito `true`, o runtime pode barrar a request antes do codigo executar, gerando "401 mas logs vazios".

## Templates de e-mail Supabase

Arquivos:

- `docs/SUPABASE_EMAIL_TEMPLATES.md`;
- `supabase/templates/recovery.html`;
- `supabase/config.toml`.

O Supabase Cloud nao aplica automaticamente o template local do repositorio. Para atualizar remoto, usar o Dashboard ou script documentado:

```powershell
$env:SUPABASE_ACCESS_TOKEN="seu-token-do-dashboard"
node scripts/update-supabase-recovery-template.mjs
```

Sempre testar enviando novo e-mail real de recuperacao depois de alterar template, redirect ou callback.

## Dependencias externas e variaveis

| Variavel                         | Uso                                                |
| -------------------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`       | Browser, server, proxy e admin client             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Browser, server e proxy                           |
| `SUPABASE_SERVICE_ROLE_KEY`      | API admin e Edge Functions privilegiadas          |
| `SUPABASE_ACCESS_TOKEN`          | Script de atualizacao de template no Cloud        |

Bibliotecas centrais:

- `@supabase/ssr`;
- `@supabase/supabase-js`;
- `react-hook-form`;
- `zod`;
- `@hookform/resolvers/zod`;
- Next.js App Router.

## Pontos de atencao

- Alteracoes em `use-auth.tsx` afetam todo o produto autenticado.
- Alteracoes em `src/proxy.ts` podem bloquear login, admin ou rotas publicas.
- Nao trocar `auth.getUser()` por `auth.getSession()` no proxy; `getUser()` valida o JWT e renova sessao.
- O proxy so verifica role/status em `/admin`; outras rotas dependem do client e de RLS.
- `RegisterForm` faz verificacao tardia de `profiles`, mas nao resolve trigger quebrado.
- O fluxo publico de cadastro aceita role escolhida pelo usuario; qualquer endurecimento exige decisao de produto.
- `profiles.status = pending` deixa `isAuthenticated` falso e pode esconder todo o shell autenticado.
- `profiles.status = blocked` precisa estar alinhado com banimento no Supabase Auth.
- A API admin usa service role; nunca expor `SUPABASE_SERVICE_ROLE_KEY` para client components.
- Antes de criar policy nova, validar contra a regra anti-recursao de RLS.
- Antes de alterar `handle_new_user`, confirmar explicitamente criacao de `user_roles`.

## Checklist de validacao

### Fluxos publicos

- Abrir `/login` anonimo e confirmar campos, links para cadastro e esqueci senha.
- Tentar login com campos vazios e e-mail invalido.
- Fazer login com usuario ativo e confirmar redirecionamento para `/dashboard`.
- Abrir `/register`, criar usuario de teste e confirmar criacao de `profiles` e `user_roles`.
- Abrir `/forgot-password`, enviar e-mail real e confirmar resposta neutra.
- Abrir link recebido no e-mail e confirmar passagem por `/auth/callback`.
- Definir nova senha em `/reset-password` e confirmar retorno para `/login?password_updated=1`.

### Fluxos autenticados

- Acessar `/profile` e confirmar nome, email, role e status.
- Acessar rota autenticada sem sessao e confirmar redirect para `/login`.
- Acessar rota publica com usuario ativo e confirmar redirect para `/dashboard`.
- Acessar `/admin` como admin/supervisor e confirmar permissao.
- Acessar `/admin` como `producao` e confirmar redirect para `/chat`.
- Bloquear usuario e confirmar que nao consegue usar o produto.

### Banco/RLS/Edge

- Verificar logs/browser por `42P17` apos mexer em `profiles` ou policies.
- Verificar `SELECT * FROM user_roles WHERE user_id = '<novo_id>'` apos signup.
- Testar Edge Function chamada pelo frontend com usuario logado e confirmar primeiro `console.log`.
- Confirmar deploy de Edge Functions com `--no-verify-jwt` quando usarem `_shared/auth.ts`.

### Testes automatizados

- `pnpm test -- src/components/auth/__tests__/auth-forms.test.tsx`
- `pnpm test -- src/lib/validations/__tests__/auth.test.ts`
- `pnpm test -- src/lib/supabase/__tests__/client.test.ts src/lib/supabase/__tests__/server.test.ts`
- `pnpm test` para suite completa quando houver alteracao de comportamento.
- `pnpm build && pnpm test` antes de PR com mudanca funcional.

## Referencias cruzadas

- `.context/modules/meu-perfil/README.md`: consumo de `useAuth()` e exibicao de `profiles`.
- `.context/modules/gerenciar-equipe/README.md`: criacao, reativacao, bloqueio, roles e permissoes.
- `.context/modules/painel-admin/README.md`: guardas de `/admin` e Edge Functions administrativas.
- `docs/SUPABASE_EMAIL_TEMPLATES.md`: recuperacao de senha.
- `AGENTS.md`: regras criticas de RLS, Edge Functions e trigger `handle_new_user`.
