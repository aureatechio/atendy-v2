# Modulo Frontend

Documentacao seletiva de contratos de frontend que representam regras de negocio ou acesso a dados.

Ultima atualizacao: 2026-05-18

## Fontes legadas

- `.context/modules_old/modules/dashboard/README.md`
- `.context/modules_old/modules/clientes/README.md`
- `.context/modules_old/modules/chat/README.md`
- `.context/modules_old/modules/producao/README.md`
- `.context/modules_old/modules/auth/README.md`

## Regras de negocio que aparecem no frontend

- Query params de navegacao entre modulos sao contratos de negocio, nao detalhe visual.
- Dashboard envia filtros para Clientes, Chat e Producao; consumidores precisam reconhecer os mesmos valores.
- UI pode ocultar acoes por role/permissao, mas APIs/RLS devem revalidar.
- Estados de loading/vazio/erro nao devem mascarar falha de RLS como "sem dados" sem sinalizacao quando a acao exige permissao.
- Frontend nao deve expor service role, segredos Z-API ou chaves privadas.
- Dados derivados criticos (`prazoStatus`, sem resposta, insatisfacao, task finalizada) precisam alinhar UI e Supabase/RPC.

## Contratos de rotas legadas relevantes

| Rota | Contrato de negocio |
| ---- | ------------------- |
| `/dashboard` | Cards operacionais e filtros de destino |
| `/clientes` | Cadastro, filtros, pipeline e sidebar |
| `/chat` | Conversas, mensagens e sem resposta |
| `/producao` | Board e filtros de task |
| `/pauta` | Distribuicao de tarefas sem responsavel |
| `/celebridade` | Aprovacao e retorno de celebridade |
| `/relatorio-insatisfeito` | Historico de insatisfacao |
| `/admin` | Dashboard admin com autorizacao reforcada |

## Lacunas de validacao

- Confirmar quais rotas legadas existem no projeto atual.
- Separar regra de negocio que deve migrar para RPC/API de regra meramente visual.
- Evitar recriar logica complexa apenas no client quando ela afeta RLS, auditoria ou relatorios.
