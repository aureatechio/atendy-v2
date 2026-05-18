# Modulo Gestao de Usuarios, Acesso e Governanca

Documentacao seletiva criada a partir dos modulos legados, mantendo apenas regras de negocio e contratos Supabase.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/auth/README.md`
- `.context/modules_old/modules/gerenciar-equipe/README.md`

## Regras de negocio preservadas

- Somente `admin` deve criar, bloquear, reativar ou alterar dados sensiveis de usuarios internos.
- `supervisor` pode acessar areas administrativas permitidas, mas nao deve receber privilegios equivalentes a service role.
- "Excluir usuario" no produto significa bloquear `profiles.status` e banir/desabilitar Auth, preservando historico.
- Quando email ja existe, o fluxo admin pode reativar usuario, remover banimento, atualizar senha/metadados e fazer upsert do profile.
- `specialty` afeta Producao, Pauta, Celebridade e Dashboards; nao e campo apenas visual.
- Permissoes JSON incluem capacidades como `can_view_dashboard`, `can_view_reports`, `can_manage_team`.

## Supabase, RPCs e API admin

| Recurso | Papel |
| ------- | ----- |
| `profiles` | Perfil, status, role, especialidade e permissoes |
| `user_roles` | Compatibilidade com helpers/policies legadas |
| `get_team_members_with_email` | RPC para listar membros com email |
| `POST /api/admin/users` | Cria/reactiva usuario usando service role |
| `DELETE /api/admin/users?id=<uuid>` | Bloqueia/desativa usuario |
| `auth.users` | Fonte Auth controlada por Supabase |

## RLS e autorizacao

- APIs admin devem revalidar usuario como `admin`; nao confiar apenas no menu.
- Service role pertence apenas a server/API/Edge controlado.
- Policies de `profiles` devem permitir self para leitura basica e admin/supervisor conforme regra, evitando recursao via helpers.

## Lacunas de validacao

- Confirmar se `get_team_members_with_email` ainda existe no banco remoto.
- Validar o contrato atual de `permissions` antes de adicionar novas flags.
- Confirmar fluxo de banimento/desbanimento no Supabase Auth vigente.
