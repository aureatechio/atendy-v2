---
name: module-context-docs
description: Especialista em criar e atualizar documentacoes de contexto para modulos do projeto Atendy. Use sempre que o usuario pedir para documentar um modulo, criar README em .context/modules, atualizar contexto tecnico, transformar leitura de codigo em documento de modulo, padronizar documentacao modular, comparar com .context/modules_old ou usar o template de .context/module-documentation-template.md.
---

# Module Context Docs

Use esta skill para criar documentacao tecnica de contexto para modulos do Atendy.

O objetivo nao e escrever documentacao generica. O objetivo e produzir um README que permita a um agente futuro entender rapidamente o modulo, seus contratos, seus riscos e como validar mudancas sem precisar redescobrir tudo do zero.

## Fontes Canonicas

Leia estas fontes antes de escrever ou atualizar um documento:

- Template atual: `.context/module-documentation-template.md`
- Documentos novos: `.context/modules/`
- Documentos antigos de referencia: `.context/modules_old/modules/`
- Codigo fonte: `src/`
- Supabase local: `supabase/migrations/`, `supabase/functions/`
- Tipos: `src/types/`
- Testes: `src/**/__tests__/`, `e2e/`

Se o modulo tocar Supabase, Auth, RLS, Edge Functions ou migrations, trate o banco como parte do modulo. Nao descreva apenas a UI.

## Quando Criar vs Atualizar

- Crie um novo documento quando o modulo ainda nao tiver pasta em `.context/modules/<slug>/README.md`.
- Atualize o documento existente quando o modulo ja estiver documentado.
- Se o usuario pedir apenas para "ler", "entender" ou "mapear", nao escreva arquivo ate ele pedir.
- Se houver modulo antigo equivalente em `.context/modules_old/modules/<slug>/README.md`, use-o como referencia, mas confirme tudo no codigo atual antes de afirmar.

## Workflow Obrigatorio

1. Identifique o modulo, o slug esperado e a rota principal.
2. Leia o template em `.context/module-documentation-template.md`.
3. Procure documentos relacionados em `.context/modules/` e `.context/modules_old/modules/`.
4. Mapeie arquivos por busca, usando `rg --files` e `rg`:
   - rotas em `src/app/`;
   - componentes em `src/components/`;
   - hooks em `src/hooks/`;
   - stores, libs e validacoes relacionadas;
   - API routes em `src/app/api/`;
   - Edge Functions em `supabase/functions/`;
   - migrations, RPCs, views, tabelas, triggers e policies em `supabase/migrations/`;
   - testes unitarios, integracao e e2e.
5. Leia os arquivos mais importantes, nao apenas nomes de arquivos.
6. Escreva o README seguindo o template, removendo secoes que nao se aplicam.
7. Marque incertezas como lacunas conhecidas em vez de inventar comportamento.
8. Ao terminar, releia o README criado e confirme que todos os caminhos citados existem ou estao claramente marcados como historicos/lacunas.

## Estrutura Esperada do README

Use esta ordem como padrao:

1. `# Modulo [Nome]`
2. Descricao curta e `Ultima atualizacao: AAAA-MM-DD`
3. `## Objetivo`
4. `## Principais caminhos`
5. `## Funcionamento geral`
6. Entradas, rotas e query params, quando houver
7. Telas e componentes
8. Hooks, stores e contratos
9. APIs, RPCs e Edge Functions, quando houver
10. Banco de dados e entidades relacionadas
11. Permissoes, RLS e autorizacao
12. Integracoes e dependencias
13. Regras de negocio
14. Realtime, cache e sincronizacao, quando houver
15. Pontos de atencao e riscos conhecidos
16. Como testar ou validar
17. Lacunas conhecidas
18. Referencias cruzadas
19. Checklist para futuros agentes

Mantenha a estrutura pragmatica: secoes vazias devem ser removidas; secoes importantes para o modulo devem ser detalhadas.

## Padrao de Escrita

- Escreva em portugues tecnico, direto e operacional.
- Prefira ASCII nos documentos de contexto do projeto, seguindo o padrao dos READMEs antigos: `Modulo`, `Producao`, `validacao`, `permissoes`.
- Cite caminhos reais entre crases.
- Nomeie hooks, RPCs, tabelas, policies e componentes exatamente como no codigo.
- Use tabelas para mapas de caminhos, permissoes, estados visuais e contratos.
- Use listas numeradas para fluxos de usuario e funcionamento geral.
- Nao use tom de marketing.
- Nao documente intencao ideal se o codigo atual faz outra coisa. Documente o comportamento atual e registre a lacuna.

## Nivel de Detalhe

O documento deve responder:

- Qual problema operacional o modulo resolve?
- Qual e a rota principal?
- Quais arquivos orquestram o fluxo?
- Quais componentes sao pontos de alto acoplamento?
- Quais hooks carregam ou alteram dados?
- Quais query keys, filtros, payloads ou contratos sao importantes?
- Quais tabelas, views, RPCs, triggers, policies e Edge Functions sustentam o modulo?
- Quais permissoes existem em UI, API e banco?
- Quais outros modulos dependem deste contrato?
- O que costuma quebrar?
- Como validar uma mudanca sem depender de memoria?

## Comandos Uteis de Mapeamento

Use comandos nesta linha, adaptando o termo do modulo:

```bash
rg --files src supabase .context | rg -i 'termo|slug|rota'
rg -n "useNomeDoHook|nome_da_rpc|tabela_relevante|/rota" src supabase
rg -n "^#|^##|^###" .context/modules_old/modules .context/modules
```

Para listar migrations relacionadas:

```bash
rg -n "nome_da_tabela|nome_da_rpc|nome_da_funcao|policy|trigger" supabase/migrations
```

## Supabase e RLS

Quando houver banco:

- Liste migrations que criam ou alteram tabelas, views, RPCs e policies.
- Diferencie `security invoker`, `security definer` e service role quando isso afetar seguranca.
- Explique quais roles ou usuarios podem selecionar, inserir, atualizar e remover.
- Aponte riscos de recursion em RLS, policies permissivas ou lacunas sem policy.
- Se depender de ambiente remoto, registre a necessidade de validacao remota em `Lacunas conhecidas`.

## Saida Esperada

Ao finalizar, informe:

- caminho do README criado ou atualizado;
- quais fontes principais foram usadas;
- se houve lacunas ou pontos que precisam de validacao futura;
- que tipo de verificacao foi feita, por exemplo leitura do arquivo final ou confirmacao de caminhos.

Nao prometa que comportamento foi testado se voce apenas leu codigo e escreveu documentacao.
