# Tokens visuais — referência

<!--
  SEM frontmatter `paths:` por escolha consciente: poderia ser carregado
  só em CSS/HTML, mas como é referência grande (tabelas longas), é melhor
  que o Claude leia este arquivo SOB DEMANDA quando precisar consultar
  um valor exato. Não está auto-carregado em lugar nenhum.

  Quando o Claude precisar do valor exato de uma cor ou tamanho, ele lê
  este arquivo. Para regras de COMPORTAMENTO (use variáveis, duas camadas,
  etc.), ver visual-css.md.
-->

## Paleta de cores

Tokens definidos em `src/styles.css` (bloco `:root`). **Use sempre as variáveis** — nunca hardcode hex no CSS de componente.

| Função | Variável CSS | Valor |
|---|---|---|
| Primária | `--cor-primaria` | `#2f855a` |
| Primária escura (hover) | `--cor-primaria-escura` | `#276749` |
| Primária clara (acento) | `--cor-primaria-clara` | `#48bb78` |
| Background da app | `--cor-background` | `#f4f7f5` |
| Superfície (card/modal) | `--cor-surface` | `#ffffff` |
| Superfície alternada | `--cor-surface-alt` | `#f8fafc` |
| Borda sutil | `--cor-borda` | `rgba(15,23,42,0.06)` |
| Texto principal | `--cor-texto` | `#0f172a` |
| Texto secundário | `--cor-texto-secundario` | `#64748b` |
| Texto placeholder | `--cor-texto-placeholder` | `#94a3b8` |
| Sucesso (texto) | `--cor-sucesso` | `#166534` |
| Sucesso (fundo) | `--cor-sucesso-bg` | `#dcfce7` |
| Erro (texto) | `--cor-erro` | `#991b1b` |
| Erro (fundo) | `--cor-erro-bg` | `#fee2e2` |
| Alerta (texto) | `--cor-alerta` | `#92400e` |
| Alerta (fundo) | `--cor-alerta-bg` | `#fef3c7` |
| Info (texto) | `--cor-info` | `#0369a1` |
| Info (fundo) | `--cor-info-bg` | `#e0f2fe` |

## Forma e sombra

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | `8px` | inputs, botões pequenos |
| `--radius-md` | `12px` | botões de página, avatares |
| `--radius-lg` | `18px` | KPI cards, filter bar |
| `--radius-xl` | `22px` | table cards, modais |
| `--radius-pill` | `999px` | chips de status, barras de progresso |
| `--sombra-card` | `0 10px 28px rgba(15,23,42,0.06)` | cards principais |
| `--sombra-sm` | `0 4px 14px rgba(15,23,42,0.04)` | elementos secundários |
| `--sombra-botao` | `0 4px 14px rgba(47,133,90,0.30)` | botão primário de página |

## Tipografia

| Elemento | Propriedade | Valor |
|---|---|---|
| Família | `font-family` | `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |
| Base | `font-size` | `15px` (no `body`) |
| Título de página | `.page-title` | `28px / weight 800` |
| Subtítulo de página | `.page-subtitle` | `14px / weight 400 / cor-texto-secundario` |
| Cabeçalho de tabela | `th` | `12px / weight 700 / uppercase / letter-spacing 0.5px` |
| Célula de tabela | `td` | `14px / weight 400` |
| Label de KPI | `.kpi-label` | `12px / weight 500 / uppercase / letter-spacing 0.4px` |
| Valor de KPI | `.kpi-value` | `26px / weight 800` |
| Breadcrumb ativo | `.bc-active` | `13px / weight 600 / cor-primaria` |
| Status chip | `.status-chip` | `12px / weight 600` |

## Responsividade

| Breakpoint | Dispositivo | Comportamento |
|---|---|---|
| `> 1200px` | Desktop | layout completo, sidebar expandida |
| `768px - 1200px` | Tablet | sidebar colapsada, tabela com scroll horizontal |
| `< 768px` | Mobile | sidebar oculta (hamburger), cards empilhados |
