---
paths:
  - "**/*.html"
  - "**/*.css"
  - "**/*.scss"
---

# Visual e CSS — comportamento

<!--
  REGRAS de comportamento visual (carrega ao mexer em template/CSS).
  As TABELAS de tokens (paleta exata, tipografia, breakpoints) ficam em
  visual-tokens.md, lido sob demanda quando precisar consultar valores.
  Separação intencional: comportamento é regra ativa; tokens são referência.
-->

## Princípios de design

- **Consistência:** toda página segue o mesmo layout base (header, KPIs, filtros, tabela).
- **Hierarquia visual:** tamanho, peso e cor de fonte para guiar o olhar.
- **Espaçamento generoso:** padding e margin suficientes para não sufocar.
- **Feedback imediato:** toda ação tem resposta visual (loading, toast, highlight).

## Sistema de CSS — duas camadas

**Regra fundamental:** antes de escrever qualquer estilo em componente, **verifique se a classe já existe em `styles.css`**.

### Camada 1: `src/styles.css` (global, sem encapsulamento)

Contém tudo que é compartilhado entre páginas. Qualquer padrão que aparece em mais de um componente deve estar aqui.

**Classes globais existentes (resumo):**

| Seção | Classes |
|---|---|
| Variáveis CSS | `:root` com todos os tokens (ver `visual-tokens.md`) |
| Page Layout | `.page-header`, `.breadcrumb-nav`, `.bc-item`, `.bc-active`, `.bc-sep`, `.page-title`, `.page-subtitle` |
| Botão de página | `.btn-acao-pagina` |
| KPI Cards | `.kpi-card`, `.kpi-icon-*` (total, ativo, pendente, inativo), `.kpi-info`, `.kpi-label`, `.kpi-value` |
| Filter Bar | `.filter-bar`, `.filter-search-wrap`, `.filter-search-input`, `.filter-selects`, `.filter-select-wrap`, `.filter-select`, `.filter-count` |
| Table Container | `.table-card`, `.table-wrapper` |
| Botões de ação | `.btn-acao`, `.btn-editar`, `.btn-inativar`, `.btn-reativar`, `.btn-cargo` |
| Status Chips | `.status-chip` + variantes (`.status-ativa`, `.status-formacao`, etc.) |
| Agenda Chips | `.agenda-chip` + variantes |
| Badges conexão | `.badge-quente`, `.badge-morna`, `.badge-fria` |
| Utilitários cor | `.soft-success`, `.soft-primary`, `.soft-warning`, `.soft-info` (e `.icon-soft-*`) |
| Empty State | `.empty-state`, `.empty-icon`, `.empty-title`, `.empty-subtitle` |
| Modal | `.btn-salvar-modal` |

### Camada 2: `componente.css` (encapsulado pelo Angular)

Apenas o exclusivo daquela página: background da página, estilos internos da tabela (colunas específicas, avatares, barras de progresso), modais próprios, ajustes responsivos para elementos próprios.

**Proibição:** não declare em `componente.css` nenhuma classe que já existe em `styles.css`. O Angular com `ViewEncapsulation.Emulated` encapsula via atributo `[_ngcontent-xxx]`, mas isso **não justifica duplicar** — aumenta o bundle e cria divergências de manutenção.

## Componentes visuais estabelecidos

| Componente | Classe(s) raiz | Notas |
|---|---|---|
| Card de KPI | `.kpi-card` + `.kpi-icon-*` | sempre em grid Bootstrap `col-*` |
| Barra de filtros | `.filter-bar` | colocar antes da `.table-card` |
| Container de tabela | `.table-card > .table-wrapper > table` | `overflow-x` no wrapper |
| Chip de status | `.status-chip .status-*` | nunca altere `padding` por componente |
| Botão de ação tabela | `.btn-acao .btn-editar` | sempre dentro de `.acoes-group` |
| Empty state | `.empty-state` (dentro de `td[colspan]`) | padding via `!important` intencional |
| Botão salvar modal | `.btn-salvar-modal` | `[disabled]="!form.dirty \|\| form.invalid \|\| carregando()"` |
| Botão primário página | `.btn-acao-pagina` ou alias local | sempre no `.page-header` |

## Regras de CSS

- **1 arquivo CSS por componente** — nunca inline styles no template.
- **Variáveis sempre** — use `var(--cor-primaria)` em vez de `#2f855a`.
- **Nunca `!important`** — exceção documentada: `.empty-state { padding: 56px 20px !important }` para sobrescrever padding nativo do `td` Bootstrap.
- **Encapsulamento respeitado** — com `ViewEncapsulation.Emulated`, estilos são automaticamente escopados. Não use `::ng-deep` sem justificativa documentada.
- **Não redeclare em componente** — se a classe existe em `styles.css`, use direto no template. Não redefina.
- **Media queries no componente** — cada componente define apenas ajustes responsivos dos seus elementos exclusivos. Page-layout global já está nos media queries do `styles.css`.

> Para valores exatos (cores, tamanhos, breakpoints, sombras), consultar `visual-tokens.md`.
