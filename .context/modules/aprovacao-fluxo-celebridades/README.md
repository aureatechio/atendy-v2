# Modulo Aprovacao e Fluxo de Celebridades

Documentacao seletiva criada a partir do modulo legado, mantendo apenas regras de negocio e contratos Supabase.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/celebridade/README.md`
- `.context/modules_old/modules/notificacoes/README.md`
- `.context/modules_old/modules/producao/README.md`

## Regras de negocio preservadas

- Celebridade organiza clientes/pecas que dependem de aprovacao ou retorno de celebridade.
- Status de aprovacao diferenciam aguardando, aprovado, reprovado e retorno pendente.
- Reprovacao deve gerar sinal operacional para ajuste.
- Troca de celebridade altera contrato do cliente e impacta producao, aprovacoes e notificacoes.
- Notificacoes do tipo `celebrity_*` devem navegar para `/celebridade`.
- Relatorio de celebridade precisa preservar diferenca entre aprovado, reprovado e aguardando retorno.

## Supabase e dados

| Recurso | Papel |
| ------- | ----- |
| `clientes_cadastro` | Cliente, celebridade atual, troca solicitada e celebridade anterior |
| `production_tasks` | Tarefas associadas ao fluxo de producao |
| `kanban_pecas` | Pecas em aprovacao |
| `task_pecas` | Vinculo entre task e peca |
| `celebrity_approvals` | Status de aprovacao por peca/task |
| `system_notifications` | Notificacoes persistidas para aprovacao/reprovacao |
| `client_pipeline_stages` | Etapas relacionadas a celebridade e retorno |

## RLS e permissoes

- Fluxos de aprovacao devem respeitar permissao de producao/supervisao.
- Insercao de notificacoes de sistema precisa garantir `target_user_id` correto.
- Se `celebrity_approvals` for exposta por Data API, RLS deve limitar leitura/escrita a usuarios operacionais autorizados.

## Lacunas de validacao

- Confirmar schema atual de `celebrity_approvals`.
- Confirmar se status `aguardando_retorno`, `reprovado` e `aprovado` continuam vigentes.
- Validar se troca de celebridade atualiza todos os campos dependentes em `clientes_cadastro`.
