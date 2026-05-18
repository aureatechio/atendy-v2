# Especificação de Design

## 1) Escopo
- **Arquivos de origem:** `index.html`, `funil.html`
- **Objetivo:** Capturar os design tokens e diretrizes consistentes aplicadas nas telas atuais para uso em refatoração, integração com React/Next.js e manutenção de UI.
- **Modelo visual:** Interface tipo dashboard (administrativa) com sidebar fixa, topo com ações, cards/KPI, filtros, tabela e fluxograma.

## 2) Design Tokens (CSS Variables)

```css
:root {
  --bg: #f8fafc;
  --surface: #ffffff;
  --surface-2: #f1f5f9;
  --border: #e2e8f0;
  --border-strong: #cbd5e1;

  --text: #0f172a;
  --text-muted: #64748b;
  --text-subtle: #94a3b8;

  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --primary-soft: #eef2ff;

  --success: #10b981;
  --success-soft: #d1fae5;
  --warning: #f59e0b;
  --warning-soft: #fef3c7;
  --danger: #ef4444;
  --danger-soft: #fee2e2;
  --info: #0ea5e9;
  --info-soft: #e0f2fe;

  --purple: #8b5cf6;
  --purple-soft: #ede9fe;

  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 4px 12px rgba(15, 23, 42, 0.06);
  --shadow-lg: 0 12px 28px rgba(15, 23, 42, 0.08);

  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;

  --sidebar-w: 232px;
  --header-h: 64px;
}
```

## 3) Tipografia
- `font-family` base: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- `font-size` base: `14px`
- `line-height` base: `1.5`
- Monoespaçada para valores/código: `JetBrains Mono`
  - `"JetBrains Mono", monospace`
- Google Fonts importados:
  - `Inter` com pesos `400, 500, 600, 700`
  - `funil.html` ainda traz peso extra `800`

### Escala tipográfica observada
- 9.5px
- 10px
- 10.5px
- 11px
- 11.5px
- 12px
- 12.5px
- 13px
- 13.5px
- 14px
- 14.5px
- 15px
- 16px
- 24px
- 28px
- 32px

## 4) Layout e grade
- Estrutura global: grade de aplicação
  - `display: grid; grid-template-columns: var(--sidebar-w) 1fr;`
- Altura mínima da app: `100vh`
- Sidebar fixa:
  - altura `100vh`
  - borda direita em `var(--border)`
- Header:
  - altura `var(--header-h)`
  - `position: sticky` no topo

## 5) Espaçamento (tokens derivados)
- Espaçamento mais recorrente:
  - `4px, 5px, 6px, 7px, 8px, 10px, 12px, 14px, 16px, 18px, 20px, 22px, 24px, 26px, 28px, 30px, 32px, 36px, 40px`
- Paddings de container de página:
  - `28px` (desktop) com variação mobile responsiva para menor valor.

## 6) Borda / raio / sombras
- Raios de borda:
  - pequeno: `6px`
  - padrão: `10px`
  - grande: `14px`
  - círculos/avatars: `50%`
  - badges arredondadas: `999px`
- Sombra aplicada por nível:
  - `sm`, `md`, `lg` conforme tokens do `:root`

## 7) Cores semânticas e de estado

### Estados de dados (semântica atual)
- Sucesso: `--success` e `--success-soft`
- Atenção: `--warning` e `--warning-soft`
- Erro: `--danger` e `--danger-soft`
- Informação: `--info` e `--info-soft`
- Primário: `--primary`, `--primary-hover`, `--primary-soft`

### Variações inline usadas em componentes
- `--col-color` (fluxo/funil de produção)
- `--stage-color` (etapas)

## 8) Componentes (padrões visuais)

### Sidebar
- fundo: `var(--surface)`
- link ativo: `var(--primary-soft)` + texto/ícone `var(--primary-hover)`
- item ativo deve contrastar com `box-radius: var(--radius-sm)`
- separação por `var(--border)`

### Inputs, selects, botões e controles de filtro
- Inputs/selects com `1px solid var(--border)`, fundo `var(--surface)`, raio `var(--radius)`
- Foco padrão:
  - `border-color: var(--primary)`
  - glow/outline simulada `0 0 0 3px rgba(99, 102, 241, 0.12)`
- Botões de ação geralmente em tamanho `34–36px`

### Cards / painéis
- superfícies em `var(--surface)`
- borda `var(--border)`
- sombra `var(--shadow-md)` ou `var(--shadow-lg)`
- raio em `var(--radius)` ou `var(--radius-lg)`

### Tabelas
- cabeçalho com fonte `12.5px`, linhas de borda suave, alternância/hover suave via `var(--surface-2)`
- valores numéricos frequentemente em `font-variant-numeric: tabular-nums`

### Funil (pipeline)
- colunas com largura mínima entre `160–180px`
- marcadores de etapa/pills usam `border-radius: 999px`
- conectores e barras com `border-radius: 999px`

## 9) Regras de implementação
- Manter `background`, `text`, `border` e estados a partir do token set.
- Sempre usar tokens semânticos antes de hexadecimais diretos.
- Evitar uso de novas cores fora do sistema sem registrar extensão do token.
- Para chips/badges, preferir `background: var(--surface-2)` e `color: var(--text-muted)` por padrão.
- Interações hover: transição curta `0.12s` e retorno de 0.15s para campos.

## 10) Migração recomendada para app atual
1. Criar arquivo central de tokens: `styles/tokens.css`.
2. Importar no `globals.css` e manter `:root` único.
3. Substituir valores inline (quando repetidos) por variáveis semânticas.
4. Padronizar gradientes/cores utilitárias por classes utilitárias temáticas.
5. Documentar novos tokens em seção dedicada do changelog de design.

## 11) Nomenclatura de tokens (convenção)
- `--color-*` para novos tokens de cor
- `--space-*` para novos espaçamentos escalares
- `--font-*` para novas tipografias
- `--radius-*` para geometrias
- `--shadow-*` para elevações
- `--motion-*` para transições/animações
