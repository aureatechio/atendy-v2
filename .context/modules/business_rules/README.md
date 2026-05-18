# Modulo Business Rules

Indice seletivo das regras de negocio legadas que devem sobreviver a migracoes de UI/codigo.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- Todos os READMEs em `.context/modules_old/modules/`

## Regras transversais preservadas

- Usuario ativo exige `profiles.status = 'active'`.
- Roles principais: `admin`, `supervisor`, `producao`; permissoes JSON em `profiles.permissions` complementam roles em alguns fluxos.
- "Excluir" usuario interno significa bloquear profile e banir no Auth, nao apagar historico.
- Cliente arquivado usa `is_archived` e deve sair das visoes operacionais principais.
- Dashboard, Clientes, Chat e Producao compartilham filtros de destino; renomear query params quebra navegacao operacional.
- Conversa "sem resposta" deve manter regra unica entre Chat e Dashboard.
- `Insatisfeito` representa reclamacao/critica real; pedido comum de ajuste deve ser `Normal`.
- Historico de insatisfacao registra transicoes (`added`/`removed`), nao apenas estado atual.
- Tarefas de producao finalizadas nao entram em paineis operacionais de execucao.
- Etapas de pipeline sao contratos por slug; mudar slug afeta Producao, Pauta, Celebridade, Clientes e relatorios.
- Alarmes vencidos continuam reaparecendo enquanto nao forem reconhecidos.
- Mensagens rapidas podem usar variaveis como `{nome}`, mas o consumidor decide o processamento.

## Contratos Supabase transversais

| Area | Contratos |
| ---- | --------- |
| Auth | `profiles`, `user_roles`, helpers `is_admin*`, trigger `handle_new_user` |
| Clientes | `clientes_cadastro`, `client_pipeline_stages`, RPCs `get_clientes_*` |
| Chat | `conversations`, `messages`, `conversation_tags`, `conversation_tag_history` |
| Producao | `production_tasks`, `task_history`, `task_pecas`, `kanban_pecas` |
| Notificacoes | `alarms`, `system_notifications` |
| Relatorios | `get_production_dashboard_metrics`, `get_relatorio_clientes_page`, views historicas |

## Lacunas de validacao

- Este documento e indice de regras, nao substitui os modulos especificos.
- Toda regra herdada de `.context/modules_old/` precisa ser confirmada contra codigo/schema atual antes de implementacao.
