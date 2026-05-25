# Modulo Pauta e Planejamento de Entregas

Documentacao seletiva criada a partir do modulo legado, mantendo apenas regras de negocio e contratos Supabase.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/pauta/README.md`
- `.context/modules_old/modules/producao/README.md`
- `.context/modules_old/modules/gerenciar-equipe/README.md`

## Regras de negocio preservadas

- Pauta distribui tarefas de producao sem responsavel.
- Atribuicao depende de membros ativos e especialidade compativel.
- Supervisores/admins podem distribuir; usuarios operacionais devem ver apenas o que a permissao permitir.
- Atribuir tarefa atualiza `production_tasks.assigned_to`.
- Pauta depende dos mesmos slugs e status de Producao.
- Abrir detalhe de tarefa a partir da Pauta deve preservar retorno para `/pauta`.

## Supabase e dados

| Recurso | Papel |
| ------- | ----- |
| `production_tasks` | Fonte de tarefas sem responsavel e alvo de atribuicao |
| `profiles` | Membros ativos, roles e especialidades |
| `client_pipeline_stages` | Etapas e slugs do pipeline |
| `clientes_cadastro` | Dados resumidos do cliente exibidos na tarefa |

Contrato complementar:

- [etapas-subetapas.md](../producao-pipeline-operacional/etapas-subetapas.md)

## RLS e permissoes

- `production_tasks`: leitura de tarefas elegiveis e update de `assigned_to` devem ser permitidos apenas a usuarios autorizados.
- `profiles`: leitura de membros ativos precisa expor apenas campos necessarios.
- `clientes_cadastro`: usado como relacao de leitura; RLS nao deve quebrar cards da pauta.

## Lacunas de validacao

- Confirmar regra atual de especialidade (`profiles.specialty`) para distribuir video/design.
- Validar se supervisores tem permissao suficiente sem service role.
- Confirmar se atribuicao registra historico em `task_history`.
