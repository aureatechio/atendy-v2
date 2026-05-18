# Modulo Meu Perfil

Documentacao tecnica do modulo Meu Perfil.

Ultima atualizacao: 2026-05-11

## Objetivo

O modulo Meu Perfil exibe os dados do usuario autenticado em `/profile`. A tela atual e somente leitura: mostra avatar, nome, email, role, status e data de cadastro, alem de um link de retorno para Clientes.

Edicao de usuarios, roles, status e permissoes acontece em outros modulos administrativos. Este modulo depende diretamente de `useAuth()` e da tabela `profiles`.

## Principais caminhos

| Area                    | Caminho                                                                 | Papel                                                             |
| ----------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Rota principal          | `src/app/(auth)/profile/page.tsx`                                       | Renderiza dados do profile autenticado                            |
| Auth context            | `src/hooks/use-auth.tsx`                                                | Carrega sessao Supabase, usuario e registro em `profiles`         |
| Hooks de profiles       | `src/hooks/use-profiles.ts`                                             | Consultas auxiliares de profiles ativos                           |
| Avatar de conversa      | `src/hooks/use-profile-picture.ts`                                      | Busca foto de perfil WhatsApp para conversas, nao para `/profile` |
| Edge de avatar WhatsApp | `supabase/functions/zapi-get-profile-picture/index.ts`                  | Consulta Z-API e persiste `conversations.avatar_url`              |
| Compat de profiles      | `supabase/migrations/20260109143621_compat_profiles_for_sprint0.sql`    | Garante campos `full_name`, `role` e `status` em `profiles`       |
| RLS de profiles         | `supabase/migrations/20260505190000_fix_profiles_rls_recursion.sql`     | Policies com helpers `SECURITY DEFINER` para evitar recursao      |
| Trigger de signup       | `supabase/migrations/20260114100000_bugfix_009_consolidate_trigger.sql` | Ultima consolidacao conhecida do `handle_new_user`                |

## Funcionamento geral

1. A pagina `/profile` chama `useAuth()`.
2. Enquanto auth/profile carregam, renderiza estado de loading.
3. Se nao houver `profile`, renderiza alerta de dados indisponiveis.
4. Com profile carregado, monta:
   - avatar;
   - nome;
   - email;
   - role;
   - status;
   - data de cadastro em `America/Sao_Paulo`.
5. O botao "Voltar" navega para `/clientes`.

## Tela `/profile`

Arquivo: `src/app/(auth)/profile/page.tsx`

Campos exibidos:

| Campo visual     | Origem               | Fallback                        |
| ---------------- | -------------------- | ------------------------------- |
| Avatar           | `profile.avatar_url` | inicial de `full_name` ou email |
| Nome             | `profile.full_name`  | `user.email`                    |
| Email            | `user.email`         | `-`                             |
| Role             | `profile.role`       | label "Membro"                  |
| Status           | `profile.status`     | label "Ativo" para valor ativo  |
| Data de cadastro | `profile.created_at` | `-`                             |

Labels de role:

| Valor        | Label      |
| ------------ | ---------- |
| `admin`      | Admin      |
| `supervisor` | Supervisor |
| `producao`   | Producao   |
| outros/null  | Membro     |

Labels de status:

| Valor       | Label              |
| ----------- | ------------------ |
| `active`    | Ativo              |
| `pending`   | Pendente aprovacao |
| `blocked`   | Bloqueado          |
| outros/null | Pendente           |

## Auth context

Arquivo: `src/hooks/use-auth.tsx`

Responsabilidades:

- observar `supabase.auth.onAuthStateChange`;
- buscar `profiles` por `user.id`;
- expor estado de sessao, usuario e profile;
- centralizar `signIn`, `signUp`, `signOut`, `resetPassword`, `updatePassword`;
- expor derivacoes de autorizacao.

Derivacoes relevantes:

| Campo                        | Regra atual                              |
| ---------------------------- | ---------------------------------------- |
| `isAuthenticated`            | `!!user && profile?.status === 'active'` |
| `isPending`                  | `profile?.status === 'pending'`          |
| `isBlocked`                  | `profile?.status === 'blocked'`          |
| `isAdmin`                    | `profile?.role === 'admin'`              |
| `isSupervisor`               | `profile?.role === 'supervisor'`         |
| `specialty`                  | `profile?.specialty`                     |
| `isTeamAdmin`                | `profile?.is_team_admin === true`        |
| `isAutorizadoTirarAnaliseIA` | campo homonimo no profile                |

Ponto de comportamento: o provider tem timeout de carregamento para nao deixar a aplicacao travada se a leitura de auth/profile demorar.

## Hooks auxiliares de profiles

Arquivo: `src/hooks/use-profiles.ts`

| Hook                       | Uso principal                    |
| -------------------------- | -------------------------------- |
| `useProfiles()`            | Lista profiles ativos            |
| `useProfile(userId)`       | Busca um profile especifico      |
| `useProductionProfiles()`  | Lista usuarios de producao       |
| `useProfilesBySpecialty()` | Lista usuarios por especialidade |

Esses hooks sao usados por modulos de producao, pauta, equipe e atribuicao. Eles nao fazem parte da tela `/profile`, mas compartilham o contrato da tabela `profiles`.

## Avatar e foto de perfil

Existem dois conceitos diferentes:

| Contexto                  | Campo/tabela               | Fluxo                                                                        |
| ------------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| Usuario interno           | `profiles.avatar_url`      | Exibido em `/profile`; nao ha upload nessa tela                              |
| Cliente/conversa WhatsApp | `conversations.avatar_url` | Buscado por `useProfilePicture` via Edge Function `zapi-get-profile-picture` |

`use-profile-picture.ts` nao atualiza avatar do usuario interno. Ele consulta a Z-API por telefone, grava a foto em `conversations.avatar_url` e invalida caches de conversas.

## Banco de dados

Tabela central: `profiles`.

Campos usados por este modulo e pelo auth context:

- `id`;
- `full_name`;
- `email`;
- `avatar_url`;
- `role`;
- `status`;
- `specialty`;
- `is_team_admin`;
- `is_autorizado_tirar_analise_ia`;
- `created_at`;
- `updated_at`.

Migration de compatibilidade:

`supabase/migrations/20260109143621_compat_profiles_for_sprint0.sql`

Ela garante enums e campos de role/status usados pela UI.

## RLS e seguranca

Migration vigente de referencia:

`supabase/migrations/20260505190000_fix_profiles_rls_recursion.sql`

Helpers criados:

| Helper                            | Uso esperado                     |
| --------------------------------- | -------------------------------- |
| `public.get_user_role(uuid)`      | Obter role de qualquer usuario   |
| `public.get_user_status(uuid)`    | Obter status de qualquer usuario |
| `public.is_admin()`               | Verificar admin atual            |
| `public.is_admin_or_supervisor()` | Verificar admin ou supervisor    |
| `public.is_active_user()`         | Verificar usuario ativo          |

Policies relevantes:

- `profiles_select_self_or_admin`;
- `profiles_insert_self_or_admin`;
- `profiles_update_self_or_admin`.

Regra do projeto: nao criar policy nova com subquery direta em `profiles`. Usar os helpers acima.

## Trigger de signup

Fluxo esperado do projeto:

1. signup cria usuario em `auth.users`;
2. trigger `public.handle_new_user` cria registro em `profiles`;
3. trigger tambem deve criar registro em `user_roles`.

Ponto critico: a consolidacao `20260114100000_bugfix_009_consolidate_trigger.sql` recria `handle_new_user`. Antes de qualquer alteracao nesse trigger, confirmar que a versao vigente no banco cria tanto `profiles` quanto `user_roles`. Sem `user_roles`, helpers/policies que dependem dessa tabela podem bloquear leituras silenciosamente.

## Pontos de atencao

- `/profile` e uma tela read-only; nao implementar edicao parcial ali sem revisar fluxo de administracao de equipe.
- `profile.avatar_url` nao e sincronizado automaticamente com foto do WhatsApp.
- `isAuthenticated` exige status `active`; usuarios `pending` ou `blocked` podem ter sessao Supabase, mas nao devem passar pelos fluxos autenticados do produto.
- Alteracoes em `profiles` impactam Pauta, Producao, Chat, Dashboard, Admin e Notificacoes.
- Ao mexer em RLS de profiles, seguir o padrao `SECURITY DEFINER` para evitar `42P17: infinite recursion detected in policy`.

## Checklist de validacao

- Entrar com usuario ativo e abrir `/profile`.
- Confirmar nome, email, role e status.
- Testar usuario sem `full_name` para validar fallback para email.
- Testar usuario sem `avatar_url` para validar inicial.
- Confirmar data em formato pt-BR.
- Confirmar que o botao Voltar navega para `/clientes`.
- Se alterar auth/RLS, testar login completo e acesso a rota protegida.
- Se alterar signup, criar novo usuario e verificar registros em `profiles` e `user_roles`.
