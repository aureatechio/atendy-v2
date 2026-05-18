# Modulo Auth

Documentacao seletiva criada a partir dos modulos legados, mantendo apenas regras de negocio e contratos Supabase.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/auth/README.md`
- `.context/modules_old/modules/meu-perfil/README.md`
- `.context/modules_old/modules/gerenciar-equipe/README.md`

## Regras de negocio preservadas

- Usuario autenticado so deve usar o produto quando existe `user` e `profiles.status = 'active'`.
- `profiles.status = 'pending'` mantem sessao, mas nao libera o shell autenticado.
- `profiles.status = 'blocked'` deve impedir uso e precisa estar alinhado com banimento no Supabase Auth.
- `admin` possui administracao completa; `supervisor` acessa areas administrativas permitidas; `producao` e papel operacional.
- Cadastro publico historicamente permite escolher `role`; endurecer esse fluxo exige decisao de produto.
- Signup deve criar usuario Auth, `profiles` e `user_roles`.
- Reset de senha passa por callback, atualiza senha, faz logout e volta para login com indicador de sucesso.

## Supabase Auth e dados

| Recurso | Papel |
| ------- | ----- |
| `auth.users` | Usuario Supabase Auth |
| `profiles` | Perfil operacional, role, status, permissoes e avatar |
| `user_roles` | Tabela auxiliar usada por helpers/policies legadas |
| `handle_new_user` | Trigger de signup para criar/atualizar profile e role |
| `get_user_role(uuid)` | Helper de role |
| `get_user_status(uuid)` | Helper de status |
| `is_admin()` | Helper para policies |
| `is_admin_or_supervisor()` | Helper para areas administrativas |
| `is_active_user()` | Helper para usuarios ativos |

## RLS e seguranca

- Nao consultar `profiles` diretamente dentro de policies de `profiles`; usar helpers `SECURITY DEFINER` para evitar recursao.
- Nao usar `raw_user_meta_data`/`user_metadata` como fonte de autorizacao.
- Service role nao pode aparecer em client components.
- Rotas API fora do matcher do proxy precisam validar permissao internamente.
- Edge Functions chamadas pelo frontend devem usar helper compartilhado de auth (`requireAuth`/`requireAdmin`) quando aplicavel.

## Lacunas de validacao

- Confirmar se `user_roles` ainda e usado por todas as policies atuais.
- Validar a trigger `handle_new_user` no banco remoto antes de mexer em signup.
- Confirmar se o papel `producao` continua sendo o default operacional.
