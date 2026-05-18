# Modulo Perfil e Operacao Pessoal do Atendente

Documentacao seletiva criada a partir do modulo legado, mantendo apenas regras de negocio e contratos Supabase.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/meu-perfil/README.md`
- `.context/modules_old/modules/auth/README.md`

## Regras de negocio preservadas

- Perfil exibe dados do usuario autenticado a partir de `profiles`.
- Tela legada era read-only: avatar, nome, email, role, status e data de cadastro.
- Falta de profile para usuario logado e estado inconsistente que deve ser tratado como alerta.
- Avatar pode vir de `profiles.avatar_url` ou integracoes externas, mas nao deve quebrar se ausente.
- Status e role exibidos devem refletir o mesmo contrato usado por Auth.

## Supabase e dados

| Recurso | Papel |
| ------- | ----- |
| `profiles` | Fonte principal do perfil operacional |
| Supabase Auth session | Identidade do usuario logado |
| `handle_new_user` | Garante criacao do profile no signup |

## RLS e seguranca

- Usuario deve poder ler o proprio profile.
- Admin/supervisor podem ter leitura adicional conforme modulo de governanca.
- Usuario comum nao deve atualizar role/status/permissoes por UI de perfil.

## Lacunas de validacao

- Confirmar se o perfil atual continua read-only ou ganhou edicao.
- Validar campos atuais de avatar e nome exibido.
- Confirmar se `profiles.email` e fonte canonica ou se email vem de `auth.users`.
