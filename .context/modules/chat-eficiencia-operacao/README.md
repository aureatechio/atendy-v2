# Modulo Chat com Eficiencia de Operacao

Documentacao seletiva criada a partir dos modulos legados, mantendo apenas regras de negocio e contratos Supabase.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/chat/README.md`
- `.context/modules_old/modules/mensagens-rapidas/README.md`
- `.context/modules_old/modules/relatorio-insatisfeito/README.md`

## Regras de negocio preservadas

- A lista de conversas precisa suportar busca por nome, telefone ou conteudo e filtros por tag, responsavel, arquivadas, tipo, nao lidas e sem resposta.
- A regra de "sem resposta" e contrato compartilhado com Dashboard e filtros operacionais.
- Mensagens sao carregadas em paginas, mas renderizadas em ordem cronologica para o usuario.
- Mensagens locais de upload/envio podem aparecer antes de confirmacao remota; falha deve preservar rastreabilidade e permitir retry.
- Mensagens rapidas sao acionadas por `/` e podem conter variaveis como `{nome}`; o processamento da variavel depende do consumidor.
- Tags e classificacoes de IA podem gerar historico em `conversation_tag_history` quando associadas a insatisfacao.

## Supabase e dados

| Recurso | Papel |
| ------- | ----- |
| `conversations` | Fonte de lista, responsavel, status, arquivamento e classificacao atual |
| `messages` | Fonte de historico e status de mensagens |
| `conversation_tags` | Estado atual de tags por conversa |
| `conversation_tag_history` | Historico de entradas/saidas de tags/classificacoes |
| `mensagens_padrao` | Respostas padronizadas usadas no chat |

## Realtime

- O chat legado usa subscriptions em `messages` e `conversations` para inserts/updates/deletes.
- Mudancas de tags ou classificacoes que impactem relatorios devem invalidar caches ou gerar historico equivalente.

## Lacunas de validacao

- Confirmar se o modulo atual ainda usa realtime direto ou se migrou para outra camada.
- Confirmar se o historico de tags e obrigatorio ou nao-bloqueante nos fluxos atuais.
- Validar se mensagens rapidas continuam globais/por usuario conforme RLS vigente.
