# Modulos documentados

Documentacao tecnica de modulos do produto para orientar manutencao por agentes.

| Modulo                 | Documento                             | Resumo                                                                                                                            |
| ---------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Auth                   | `auth/README.md`                      | Autenticacao Supabase, rotas publicas, AuthProvider, proxy, profiles/user_roles, RLS, triggers e recuperacao de senha             |
| Celebridade            | `celebridade/README.md`               | Aprovacao de pecas por celebridade, kanban, relatorio, notificacoes, troca de celebridade e riscos de schema/RLS                  |
| Chat                   | `chat/README.md`                      | Atendimento WhatsApp em tempo real, conversas, mensagens, midia/audio, Z-API, webhooks, realtime e normalizacao de telefone       |
| Clientes               | `clientes/README.md`                  | Cadastro operacional de clientes, RPC de listagem/metricas, sidebar, filtros, pipeline, arquivamento e integracoes                |
| Dashboard              | `dashboard/README.md`                 | Dashboard operacional em `/dashboard`, cards de atendimento/producao, rotas de destino, hooks e diferenca para dashboard admin    |
| Gerenciar Equipe       | `gerenciar-equipe/README.md`          | Administracao de usuarios internos, roles, especialidades, permissoes JSON, API admin, RPC de equipe e riscos de RLS/Auth         |
| Mensagens Rapidas      | `mensagens-rapidas/README.md`         | CRUD de respostas padrao, atalhos no Chat, hooks Supabase, RLS e variavel `{nome}`                                                |
| Meu Perfil             | `meu-perfil/README.md`                | Tela read-only do usuario autenticado, Auth context, profiles, avatar interno/WhatsApp e cuidados com signup/RLS                  |
| Notificacoes           | `notificacoes/README.md`              | Alarmes agendados, dropdown de notificacoes do sistema, sons, contratos Supabase, realtime e riscos/lacunas de RLS                |
| Painel Admin           | `painel-admin/README.md`              | Dashboard administrativo, metricas WhatsApp, presenca em tempo real, configuracao Z-API e permissoes de acesso                    |
| Pauta                  | `pauta/README.md`                     | Distribuicao de tarefas de producao sem responsavel para membros de video/design, com drag-and-drop, hooks Supabase e riscos RLS  |
| Producao               | `producao/README.md`                  | Board de tarefas de producao, pipeline, RPC otimizada, filtros, modais, subtarefas e integracoes com Pauta/Dashboard              |
| Relatorio Insatisfeito | `relatorio-insatisfeito/README.md`    | Historico de clientes/conversas classificados como `Insatisfeito`, com origem IA/manual, sessoes e pontos de atencao de dados/RLS |
| Dashboard Producao     | `modulo-dashboard-producao/README.md` | Metricas operacionais de producao, RPC agregada, filtros de periodo, componentes de dashboard e pontos de validacao               |
| Supabase MCP           | `supabase-mcp/README.md`              | Harness de preflight, alvo MCP correto, OAuth, smoke SQL e runbook para evitar uso acidental do projeto Supabase errado           |
