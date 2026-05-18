# Modulo Gerenciar Equipe

Documentacao tecnica do modulo Gerenciar Equipe.

Ultima atualizacao: 2026-05-08

## Objetivo

O modulo Gerenciar Equipe centraliza a administracao de usuarios internos da Aurea: criacao de contas, reativacao de usuarios ja existentes, bloqueio de acesso, definicao de funcao, especialidade, permissoes de telas e autorizacao para remover analises de IA.

A tela principal fica em `/admin/equipe` e e operada apenas por usuarios com `profile.role = 'admin'`. Ela tambem se conecta a fluxos de producao, porque as especialidades, permissoes e flags gravadas em `profiles` afetam filtros, visibilidade de rotas e operacoes em outros modulos.

## Principais caminhos

| Area               | Caminho                                                                                                          | Papel                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Rota principal     | `src/app/(auth)/admin/equipe/page.tsx`                                                                           | UI completa de gerenciamento de membros                                                   |
| API admin          | `src/app/api/admin/users/route.ts`                                                                               | Cria, reativa e bloqueia usuarios usando service role                                     |
| Modal em producao  | `src/components/producao/team-members-modal.tsx`                                                                 | Modal admin acionado a partir de cards de producao; manipula o mesmo dominio de permissao |
| Entrada no menu    | `src/components/layout/user-menu.tsx`                                                                            | Exibe o link "Gerenciar Equipe" apenas para admin                                         |
| Auth client        | `src/hooks/use-auth.tsx`                                                                                         | Carrega `profiles` e expoe `isAdmin`, `isSupervisor`, `specialty` e flags derivadas       |
| Proxy auth         | `src/proxy.ts`                                                                                                   | Protege `/admin` no servidor para admin/supervisor                                        |
| Rotulo de presenca | `src/lib/presence/route-labels.ts`                                                                               | Mapeia `/admin/equipe` para "Gerenciar equipe"                                            |
| Tipos              | `src/types/supabase.ts`                                                                                          | Define `UserRole`, `UserSpecialty`, `UserPermissions` e `TeamMember`                      |
| RPC de listagem    | `supabase/migrations/20260209120000_create_get_team_members_with_email.sql`                                      | Cria `get_team_members_with_email()`                                                      |
| Permissoes JSON    | `supabase/migrations/20260207110000_add_user_permissions.sql`                                                    | Adiciona `profiles.permissions`                                                           |
| Especialidades     | `supabase/migrations/20260205140000_add_user_specialty.sql`                                                      | Adiciona `profiles.specialty` e `is_team_admin`                                           |
| Role producao      | `supabase/migrations/20260207130000_rename_attendant_to_producao.sql` e `20260207135000_apply_producao_role.sql` | Adiciona/aplica role `producao`                                                           |
| RLS vigente        | `supabase/migrations/20260505190000_fix_profiles_rls_recursion.sql`                                              | Recria helpers e policies de `profiles` sem recursao                                      |

## Funcionamento geral

1. O usuario admin acessa `/admin/equipe`, geralmente pelo `UserMenu`.
2. O proxy permite rotas `/admin` para `admin` e `supervisor`, mas a propria pagina `/admin/equipe` verifica `isAdmin`; se nao for admin, redireciona para `/admin` e renderiza `null`.
3. A pagina chama `supabase.rpc('get_team_members_with_email')` para listar membros ativos com email vindo de `auth.users`.
4. A UI permite buscar por nome e filtrar por especialidade.
5. Cada membro pode ser expandido para editar:
   - `role`;
   - `specialty`;
   - `permissions`;
   - `autorizado_tirar_analise_ia`.
6. A criacao de usuario usa `POST /api/admin/users`.
7. A exclusao visual usa `DELETE /api/admin/users?id=<uuid>`, que bloqueia o profile e bane o usuario no Supabase Auth.

## Tela principal

### `src/app/(auth)/admin/equipe/page.tsx`

Componente client-side que concentra UI e mutacoes do modulo.

Estados principais:

| Estado                         | Uso                                                     |
| ------------------------------ | ------------------------------------------------------- |
| `members`                      | Lista de membros retornada pela RPC                     |
| `localPermissions`             | Edicoes locais de `UserPermissions` antes do salvamento |
| `searchQuery`                  | Busca client-side por `full_name`                       |
| `specialtyFilter`              | Filtro client-side por `specialty`                      |
| `expandedMember`               | Controla o card aberto                                  |
| `savingMember` / `savedMember` | Feedback visual de salvamento                           |
| `showCreateModal`              | Abre modal de criacao                                   |
| `deletingMember`               | Abre confirmacao de bloqueio/exclusao                   |

Operacoes diretas na pagina:

| Funcao                              | Persistencia                                          | Observacoes                                                  |
| ----------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| `fetchMembers()`                    | `rpc('get_team_members_with_email')`                  | Retorna apenas usuarios com `profiles.status = 'active'`     |
| `handleRoleChange()`                | `profiles.role`, opcionalmente `profiles.permissions` | Ao promover para `admin`, liga permissoes de settings/equipe |
| `handleSpecialtyChange()`           | `profiles.specialty`                                  | Aceita `null` para sem especialidade                         |
| `handleToggleAutorizadoAnaliseIA()` | `profiles.autorizado_tirar_analise_ia`                | Controla acesso a monitoramento/remocao de analise IA        |
| `savePermissions()`                 | `profiles.permissions`                                | Salva o objeto inteiro de permissoes                         |
| `handleDeleteUser()`                | `DELETE /api/admin/users`                             | Remove da lista local apos sucesso                           |

### Modais internos

`CreateUserModal` coleta:

```ts
{
  email: string
  password: string
  fullName: string
  role: UserRole
  specialty: UserSpecialty | null
}
```

`DeleteConfirmModal` confirma o bloqueio do usuario. Apesar do texto "Excluir Usuario", o backend nao remove o registro: ele marca `profiles.status = 'blocked'` e aplica banimento no Supabase Auth.

## Modal relacionado em producao

`src/components/producao/team-members-modal.tsx` e um modal admin acessado pelo menu de cards em `TaskCard` quando `isAdmin` e verdadeiro. Ele lista `profiles` diretamente, sem a RPC com email, e permite alterar `role`, `specialty` e `permissions`.

Ponto de atencao: esse modal tem constantes de permissoes e labels proprias, parcialmente duplicadas em relacao a `/admin/equipe`. Ao evoluir o modelo de permissoes, atualizar os dois pontos ou consolidar a logica para evitar deriva.

## Contratos de API

### `POST /api/admin/users`

Cria ou reativa usuario. A rota:

1. chama `verifyAdmin()` usando o client server-side comum;
2. exige que o solicitante tenha `profiles.role = 'admin'`;
3. cria um admin client com `SUPABASE_SERVICE_ROLE_KEY`;
4. chama `admin.auth.admin.createUser()`;
5. grava ou atualiza `profiles` com `status = 'active'`.

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

Validacoes:

| Condicao                                  | Status | Resposta                                                |
| ----------------------------------------- | ------ | ------------------------------------------------------- |
| Usuario solicitante nao e admin           | `403`  | `{ error }`                                             |
| `email`, `password` ou `fullName` ausente | `400`  | `{ error: 'Email, senha e nome sao obrigatorios' }`     |
| Senha com menos de 6 caracteres           | `400`  | `{ error: 'A senha deve ter pelo menos 6 caracteres' }` |
| Erro Supabase Auth                        | `500`  | `{ error: createError.message }`                        |

Resposta de sucesso:

```ts
{
  success: true
  reactivated?: true
  user: {
    id: string
    email?: string
    full_name: string
    role: UserRole
  }
}
```

Quando o email ja existe, a rota procura o usuario via `admin.auth.admin.listUsers()`, remove o banimento com `ban_duration: 'none'`, atualiza senha/metadados e faz upsert do profile.

### `DELETE /api/admin/users?id=<uuid>`

Bloqueia o usuario. A rota:

1. exige admin via `verifyAdmin()`;
2. exige query param `id`;
3. atualiza `profiles.status = 'blocked'`;
4. chama `admin.auth.admin.updateUserById(id, { ban_duration: '876600h' })`.

Resposta de sucesso:

```ts
{
  success: true
}
```

Ponto de atencao: falha no banimento do Auth e logada, mas nao desfaz o bloqueio em `profiles`.

## RPC `get_team_members_with_email`

Definida em `supabase/migrations/20260209120000_create_get_team_members_with_email.sql`.

Contrato:

```sql
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  role public.user_role,
  specialty public.user_specialty,
  status public.user_status,
  permissions jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  email text
)
```

Comportamento:

- `SECURITY DEFINER`;
- `SET search_path = ''`;
- le `public.profiles`;
- faz `INNER JOIN auth.users` para obter email;
- filtra `p.status = 'active'`;
- ordena por `p.full_name ASC`;
- concede `EXECUTE` a `authenticated`.

Ponto de atencao: a funcao atualmente nao valida admin/supervisor dentro do corpo. A protecao pratica vem do acesso a `/admin/equipe`, mas qualquer usuario autenticado com permissao de executar RPC pode tentar chama-la se tiver acesso ao client. Se isso virar requisito de seguranca estrito, adicionar guarda com helper `public.is_admin()` ou ajustar grants/policy.

## Banco de dados

### Tabelas e colunas relevantes

| Objeto                                 | Uso                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `auth.users`                           | Conta de autenticacao, email, senha e banimento                               |
| `profiles.id`                          | FK logica para `auth.users.id`; chave usada em toda a app                     |
| `profiles.full_name`                   | Nome exibido na equipe e outros modulos                                       |
| `profiles.avatar_url`                  | Avatar exibido nos cards                                                      |
| `profiles.role`                        | `admin`, `supervisor` ou `producao`                                           |
| `profiles.status`                      | `pending`, `active` ou `blocked`                                              |
| `profiles.specialty`                   | Especialidade operacional do usuario                                          |
| `profiles.permissions`                 | JSON granular de acesso a telas/acoes                                         |
| `profiles.is_team_admin`               | Flag legada/usada em producao para visibilidade de equipe                     |
| `profiles.autorizado_tirar_analise_ia` | Flag que habilita monitoramento/acoes sobre analise IA                        |
| `user_roles`                           | Tabela auxiliar de roles usada por policies antigas/helpers como `is_agent()` |

### `UserPermissions`

Tipo em `src/types/supabase.ts`:

```ts
export interface UserPermissions {
  can_view_dashboard: boolean
  can_view_clients: boolean
  can_edit_clients: boolean
  can_view_tasks: boolean
  can_edit_tasks: boolean
  can_view_chat: boolean
  can_send_messages: boolean
  can_view_reports: boolean
  can_view_team: boolean
  can_manage_team: boolean
  can_view_settings: boolean
  can_manage_settings: boolean
  can_view_pipeline: boolean
  can_edit_pipeline: boolean
}
```

A tela principal exibe apenas um subconjunto como "Acesso as Telas":

- `can_view_chat`;
- `can_view_tasks`;
- `can_view_clients`;
- `can_view_dashboard`;
- `can_view_settings`;
- `can_view_team`.

O objeto inteiro e salvo em `profiles.permissions`. Valores ausentes caem no `DEFAULT_PERMISSIONS` do frontend.

### Roles e especialidades

Roles vigentes no tipo TypeScript:

- `admin`;
- `supervisor`;
- `producao`.

Especialidades vigentes no tipo TypeScript:

- `roteirista`;
- `video`;
- `design`;
- `audio`;
- `atendimento`;
- `gestor`;
- `celebridade`;
- `aprovacao_celebridade`.

Ponto de atencao: migrations antigas de `user_specialty` podem nao listar todos os valores que o TypeScript/UI usa atualmente. Antes de adicionar novas especialidades ou depender delas em SQL, confirmar o enum real do ambiente Supabase.

## RLS e permissoes

### `profiles`

A migration `20260505190000_fix_profiles_rls_recursion.sql` recria helpers `SECURITY DEFINER`:

- `get_user_role(uuid)`;
- `get_user_status(uuid)`;
- `is_admin()`;
- `is_admin_or_supervisor()`;
- `is_active_user()`.

Policies vigentes:

| Policy                          | Operacao | Regra                               |
| ------------------------------- | -------- | ----------------------------------- |
| `profiles_select_self_or_admin` | `SELECT` | proprio usuario ou admin/supervisor |
| `profiles_insert_self_or_admin` | `INSERT` | proprio usuario ou admin            |
| `profiles_update_self_or_admin` | `UPDATE` | proprio usuario ou admin            |

Regra critica do repositorio: nao criar policy que consulte `profiles` diretamente dentro de `USING`/`WITH CHECK`; usar sempre helpers `SECURITY DEFINER` para evitar `42P17: infinite recursion detected in policy`.

### Autorizacao em camadas

| Camada                        | Comportamento                                              |
| ----------------------------- | ---------------------------------------------------------- |
| `src/proxy.ts`                | Protege `/admin` para `admin` ou `supervisor`              |
| `/admin/equipe`               | Exige `isAdmin`; supervisor e redirecionado para `/admin`  |
| `/api/admin/users`            | Exige `profiles.role = 'admin'` em `verifyAdmin()`         |
| Updates diretos em `profiles` | Dependem de RLS; admin pode atualizar qualquer profile     |
| RPC de listagem               | Executavel por `authenticated`; ver ponto de atencao acima |

## Regras de negocio

- Somente admin gerencia equipe pela tela principal.
- Criar usuario exige email, senha e nome completo.
- Usuarios criados pela API ja saem com `status = 'active'`.
- "Excluir" no produto significa bloquear o profile e banir no Auth, nao remover dados historicos.
- Promover alguem para `admin` liga automaticamente:
  - `can_view_settings`;
  - `can_manage_settings`;
  - `can_view_team`;
  - `can_manage_team`.
- Alterar de `admin` para outro role nao desliga automaticamente permissoes previamente concedidas.
- `can_view_team` e `can_manage_team` sao permissoes granulares no JSON, mas a rota `/admin/equipe` hoje usa `role === 'admin'` como gate real.
- `specialty` afeta outros fluxos de producao, pauta, celebridade e dashboards; nao tratar como campo meramente visual.
- `autorizado_tirar_analise_ia` controla acesso ao item de monitoramento no menu lateral e deve ser validado tambem no fluxo que executa a acao sensivel.

## Dependencias externas e ambiente

`src/app/api/admin/users/route.ts` precisa das variaveis:

```txt
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Sem elas, `createAdminClient()` lanca erro e as rotas de criacao/bloqueio retornam erro interno.

## Pontos de atencao

- A tela principal e o modal de producao duplicam labels, defaults e logica de permissoes. Mudancas no contrato de `UserPermissions` devem atualizar ambos.
- A RPC `get_team_members_with_email()` expoe emails via `SECURITY DEFINER` para `authenticated`; revisar se a leitura deve ser estritamente admin.
- `verifyAdmin()` consulta `profiles` pelo client server-side comum; se RLS de `profiles` quebrar, a API pode negar admin valido.
- O upsert de `profiles` na criacao/reativacao nao escreve `user_roles`. O trigger `handle_new_user` deveria criar esse registro, mas rotas admin que fazem upsert manual precisam ser avaliadas com a regra do `AGENTS.md`: usuario sem `user_roles` pode sofrer bloqueio silencioso em policies legadas.
- A migration `20260207135000_apply_producao_role.sql` recria `handle_new_user` sem `INSERT INTO user_roles`; isso e historicamente sensivel no projeto.
- O bloqueio atual primeiro atualiza `profiles.status`; se o banimento no Auth falhar, o usuario fica bloqueado pela app/proxy, mas pode nao estar banido no Auth.
- O termo "Excluir Usuario" na UI pode induzir manutencao errada: a operacao e soft-delete/bloqueio.
- A lista principal mostra apenas `status = 'active'`; usuarios `blocked` ou `pending` nao aparecem para auditoria/reactivacao pela tela.
- O proxy permite supervisor entrar em `/admin`, mas `/admin/equipe` restringe no cliente. Manter isso claro ao mover guards.
- Alguns textos nos arquivos aparecem com encoding quebrado no workspace; ao editar, cuidar para nao ampliar churn de encoding.

## Como testar ou validar

### Validacao estatica

1. Rodar `npm run type-check`.
2. Rodar `npm run lint`.
3. Conferir se `src/types/supabase.ts` continua alinhado com `profiles.permissions`, `user_role` e `user_specialty`.

### Fluxo admin manual

1. Login com usuario `admin`.
2. Acessar `/admin/equipe` pelo menu do usuario.
3. Confirmar listagem com nome, email, role e especialidade.
4. Buscar por nome e filtrar por especialidade.
5. Expandir um membro e alterar role, specialty e permissoes.
6. Salvar permissoes e atualizar a tela para confirmar persistencia.
7. Alternar `Monitor IA` e verificar se o menu lateral passa a exibir/ocultar `Monitoramento` para esse usuario apos novo login/refresh de profile.

### Criacao e reativacao

1. Criar usuario novo com role `producao`.
2. Confirmar registro em `auth.users`.
3. Confirmar registro em `profiles` com `status = 'active'`.
4. Confirmar registro correspondente em `user_roles`, quando aplicavel ao ambiente.
5. Fazer login com o novo usuario e validar acesso basico.
6. Bloquear o usuario pela tela.
7. Confirmar `profiles.status = 'blocked'` e banimento em `auth.users`.
8. Criar novamente com o mesmo email para validar fluxo de reativacao.

### Sanidade RLS

1. Login completo como admin.
2. Acessar `/admin/equipe`.
3. Abrir console do browser e verificar ausencia de `42P17`.
4. Verificar logs Supabase por `infinite recursion`.
5. Testar acesso como supervisor: deve passar pelo proxy `/admin`, mas nao deve operar `/admin/equipe`.
6. Testar acesso como `producao`: deve ser redirecionado pelo proxy ou pela pagina, dependendo da rota.

## Lacunas conhecidas

- Nao ha testes automatizados especificos para `/admin/equipe` ou `/api/admin/users`.
- Nao ha rota para listar usuarios bloqueados/pending na UI.
- Nao ha confirmacao visual detalhada quando `DELETE /api/admin/users` falha depois de bloquear parcialmente.
- A API de criacao nao valida explicitamente se `role` e `specialty` pertencem aos enums antes de enviar ao Supabase.
- A autorizacao granular `can_manage_team` nao e usada como gate principal da tela.
