# Modulo Mensagens Rapidas e Padronizacao de Resposta

Documentacao seletiva criada a partir do modulo legado, mantendo apenas regras de negocio e contratos Supabase.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/mensagens-rapidas/README.md`
- `.context/modules_old/modules/chat/README.md`

## Regras de negocio preservadas

- Mensagens rapidas sao respostas padrao reutilizadas pelo atendimento.
- No Chat, digitar `/` abre seletor rapido e selecionar uma mensagem injeta conteudo no input.
- Variaveis como `{nome}` podem ser usadas, mas o processamento depende do consumidor.
- O CRUD precisa invalidar caches/listas usadas pelo Chat para evitar resposta antiga.
- Mensagens podem ser globais ou restritas conforme policies vigentes; nao assumir escopo sem validar RLS.

## Supabase e dados

| Recurso | Papel |
| ------- | ----- |
| `mensagens_padrao` | Tabela de respostas padronizadas |
| `profiles` | Possivel vinculo de criador/usuario conforme schema |
| Chat | Consumidor operacional via seletor rapido |

## RLS e permissoes

- Leitura deve permitir usuarios autenticados que podem atender.
- Escrita/edicao/remocao deve ser restrita conforme regra de admin/supervisor ou dono, dependendo da policy vigente.
- Se mensagens forem compartilhadas por toda equipe, evitar policy que esconda respostas de outros usuarios.

## Lacunas de validacao

- Confirmar schema atual de `mensagens_padrao`.
- Confirmar se ha escopo por usuario/equipe ou mensagens globais.
- Validar se `{nome}` usa nome do cliente, contato da conversa ou outro fallback.
