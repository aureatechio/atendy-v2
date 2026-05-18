# Modulo Mensagens Rapidas

Documentacao tecnica do modulo Mensagens Rapidas.

Ultima atualizacao: 2026-05-11

## Objetivo

O modulo Mensagens Rapidas centraliza respostas padronizadas que podem ser inseridas no Chat por atalho. Ele cobre duas superficies:

- administracao das mensagens em `/mensagens-rapidas`;
- uso operacional no input do Chat quando o usuario digita `/`.

As mensagens ficam na tabela `mensagens_padrao`. A tela de administracao manipula titulo, atalho, conteudo e status ativo/inativo. O Chat consome apenas mensagens ativas.

## Principais caminhos

| Area                  | Caminho                                                          | Papel                                                                |
| --------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| Rota de administracao | `src/app/(auth)/mensagens-rapidas/page.tsx`                      | CRUD client-side das mensagens padrao                                |
| Hook principal        | `src/hooks/use-mensagens-padrao.ts`                              | Queries/mutations de `mensagens_padrao` e processamento de variaveis |
| Seletor no Chat       | `src/components/chat/quick-replies.tsx`                          | Dropdown acionado por `/` no campo de mensagem                       |
| Input do Chat         | `src/components/chat/chat-input.tsx`                             | Detecta `/`, abre seletor e injeta conteudo selecionado              |
| Schema e seed         | `supabase/migrations/20260207160000_create_mensagens_padrao.sql` | Cria tabela, indices, RLS e exemplos iniciais                        |
| Tipos Supabase        | `src/types/supabase.ts`                                          | Contrato TypeScript gerado para `mensagens_padrao`                   |

## Funcionamento geral

1. Um usuario acessa `/mensagens-rapidas`.
2. A pagina chama `useMensagensPadraoAll()` para listar registros ordenados por `titulo`.
3. A busca local filtra por `titulo`, `atalho` ou `conteudo`.
4. Ao criar ou editar, a pagina normaliza o atalho com `trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')`.
5. Criacao, edicao, ativacao/desativacao e exclusao invalidam os caches `['mensagens-padrao']` e `['mensagens-padrao-all']`.
6. No Chat, `QuickReplies` abre quando o usuario digita `/`.
7. O dropdown filtra mensagens ativas por titulo, atalho ou conteudo.
8. Ao selecionar uma mensagem, o Chat insere o conteudo no campo de texto.
9. O helper `processarMensagemPadrao` substitui `{nome}` pelo nome do cliente quando o consumidor fornece esse valor.

## Tela `/mensagens-rapidas`

Arquivo: `src/app/(auth)/mensagens-rapidas/page.tsx`

Responsabilidades:

- renderizar lista de mensagens cadastradas;
- abrir dialog de criacao/edicao;
- alternar `is_active`;
- excluir registros com confirmacao;
- mostrar dicas de uso, incluindo a variavel `{nome}`.

Campos do formulario:

| Campo       | Origem      | Observacao                                                |
| ----------- | ----------- | --------------------------------------------------------- |
| `titulo`    | input texto | Obrigatorio na UI                                         |
| `atalho`    | input texto | Normalizado para letras, numeros, `_` e `-`               |
| `conteudo`  | textarea    | Obrigatorio na UI                                         |
| `is_active` | switch      | Usado apenas em edicao; criacao inicia como ativo no hook |

Estados relevantes:

| Estado            | Comportamento                                 |
| ----------------- | --------------------------------------------- |
| carregando        | spinner central                               |
| erro              | alerta com mensagem generica                  |
| lista vazia       | card vazio com orientacao para criar mensagem |
| busca sem retorno | card vazio especifico para a busca aplicada   |

## Hooks e contratos

Arquivo: `src/hooks/use-mensagens-padrao.ts`

### `useMensagensPadrao()`

Query key:

```ts
;['mensagens-padrao']
```

Consulta mensagens ativas:

```ts
supabase
  .from('mensagens_padrao')
  .select('*')
  .eq('is_active', true)
  .order('titulo', { ascending: true })
```

Uso principal: Chat e componentes que precisam apenas de respostas disponiveis para uso.

### `useMensagensPadraoAll()`

Query key:

```ts
;['mensagens-padrao-all']
```

Consulta todos os registros ordenados por titulo. Uso principal: tela de administracao.

### Mutations

| Hook                      | Operacao                               | Invalidacoes                               |
| ------------------------- | -------------------------------------- | ------------------------------------------ |
| `useCreateMensagemPadrao` | `insert({ titulo, atalho, conteudo })` | `mensagens-padrao`, `mensagens-padrao-all` |
| `useUpdateMensagemPadrao` | `update(data).eq('id', id)`            | `mensagens-padrao`, `mensagens-padrao-all` |
| `useDeleteMensagemPadrao` | `delete().eq('id', id)`                | `mensagens-padrao`, `mensagens-padrao-all` |

### `processarMensagemPadrao`

Assinatura:

```ts
processarMensagemPadrao(conteudo: string, nomeCliente?: string): string
```

Comportamento:

- se `nomeCliente` existir, substitui todas as ocorrencias de `{nome}`;
- se nao existir, retorna o conteudo original.

## Seletor rapido no Chat

Arquivo: `src/components/chat/quick-replies.tsx`

Contrato:

```ts
interface QuickRepliesProps {
  searchTerm: string
  onSelect: (conteudo: string) => void
  onClose: () => void
}
```

Comportamento:

- abre como popover absoluto acima do input;
- filtra por `titulo`, `atalho` e `conteudo`;
- suporta teclado:
  - `ArrowDown`;
  - `ArrowUp`;
  - `Enter`;
  - `Escape`;
- mostra atalhos no formato `/atalho`;
- seleciona a primeira opcao quando o usuario confirma com Enter.

Ponto de integracao: o processamento de `{nome}` nao acontece dentro de `QuickReplies`; quem chama `onSelect` decide se usa `processarMensagemPadrao`.

## Banco de dados

Migration base:

`supabase/migrations/20260207160000_create_mensagens_padrao.sql`

Tabela:

```sql
create table public.mensagens_padrao (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  atalho text not null,
  conteudo text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Indices:

- `idx_mensagens_padrao_atalho`;
- `idx_mensagens_padrao_is_active`.

Seed inicial:

- saudacao;
- orcamento;
- prazo;
- obrigado;
- retorno.

## Permissoes e RLS

Policies criadas na migration:

| Policy                               | Regra                                                                 |
| ------------------------------------ | --------------------------------------------------------------------- |
| `Usuarios autenticados podem ver...` | `SELECT` para usuarios autenticados somente quando `is_active = true` |
| `Admins podem gerenciar...`          | `ALL` para usuarios cujo profile tem `role = 'admin'`                 |

Ponto critico: a policy administrativa consulta `profiles` dentro do `USING`/`WITH CHECK`. Pelas regras atuais do projeto, novas policies devem usar helpers `SECURITY DEFINER` como `public.is_admin()` para evitar risco de recursao RLS. Se essa policy for revisitada, substituir o `EXISTS (SELECT ... FROM profiles ...)` por helper.

## Pontos de atencao

- A rota `/mensagens-rapidas` nao possui guard explicito na pagina. A seguranca final depende da RLS.
- `atalho` nao tem constraint `unique` na migration. Dois registros podem compartilhar o mesmo atalho e o dropdown exibira ambos.
- Criacao nao envia `is_active`; depende do default `true` no banco.
- Usuarios nao-admin conseguem consultar apenas registros ativos pela policy, mas a tela de administracao tenta carregar todos. Se a tela for exclusiva de admin, adicionar guard de rota melhora UX e reduz queries bloqueadas.
- O conteudo pode conter variaveis alem de `{nome}`, mas hoje apenas `{nome}` tem processamento implementado.

## Checklist de validacao

- Criar mensagem com titulo, atalho e conteudo.
- Confirmar normalizacao do atalho.
- Editar conteudo e status ativo/inativo.
- Verificar que mensagens inativas somem do seletor do Chat.
- Digitar `/` no Chat e navegar pelo dropdown com teclado.
- Selecionar uma mensagem e confirmar insercao no input.
- Testar mensagem com `{nome}` no fluxo que fornece nome do cliente.
- Se alterar RLS, testar como admin, supervisor/producao e usuario comum.
