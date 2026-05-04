---
paths:
  - "**/components/**/*.ts"
  - "**/components/**/*.html"
  - "**/*.modal.ts"
---

# Padrões de componentes

<!--
  Esta rule só carrega quando o Claude mexe em arquivos de componente
  (incluindo modais e templates). Mantém o contexto enxuto em sessões
  que tocam só services ou models.

  paths cobre: pages, shared, e qualquer modal independente do local.
-->

## Anatomia obrigatória

Todo componente segue esta ordem:

```
1. IMPORTS            → decorators, módulos
2. METADATA           → @Component(standalone, selector, imports, templateUrl, styleUrl)
3. INJEÇÕES           → inject() (não constructor injection)
4. SIGNALS DE ESTADO  → signal() para mutável, computed() para derivado
5. LIFECYCLE          → ngOnInit() apenas se necessário
6. MÉTODOS PÚBLICOS   → ações chamadas pelo template
7. MÉTODOS PRIVADOS   → lógica auxiliar interna
```

## Regras de componente

| Regra | Detalhe |
|---|---|
| Standalone | `standalone: true` sempre — sem NgModules |
| Injeção | `inject()` em vez de constructor injection |
| Estado | `signal()` para mutável, `computed()` para derivado |
| Arquivos | sempre separados: `.ts` + `.html` + `.css` (nunca inline) |
| Imports | apenas o necessário (CommonModule, FormsModule, etc.) |
| Tamanho | se passar de ~200 linhas, extrair sub-componentes |

## Tipos de componentes

| Tipo | Onde fica | Característica |
|---|---|---|
| **Page** | `components/pages/` | 1 por rota, consome services, layout CRUD |
| **Shared** | `components/shared/` | reutilizável, recebe inputs, emite outputs |
| **Core** | `core/` | singleton, carrega 1x (auth, layout especial) |

## Padrão de página CRUD

Toda página CRUD segue esta estrutura visual e técnica:

```
1. Page Header     → Breadcrumb + Título + Botão "Novo X"
2. KPI Cards       → 3-4 cards com contadores por status (computed signals)
3. Filter Bar      → Input busca + selects de filtro + contador de resultados
4. Data Table      → Colunas tipadas + coluna de ações (editar, inativar)
5. Empty State     → Mensagem quando não há resultados
6. Modal           → Formulário de criação/edição (nunca página separada)
```

---

## ModalService: modais via código, não via template

**Princípio:** modais são abertos via código, não declarados no template da página. Em vez de `<app-modal>` no HTML, o componente chama:

```typescript
this.modalService.open(NovaConexaoModal, { data: { ... } })
```

**Por que isso importa:** cada modal declarada inline adiciona ~50-150 linhas ao mesmo HTML. Com 5 modais, o arquivo passa de 500 linhas — a maioria irrelevante para quem está editando a listagem. Com ModalService, o HTML da página contém apenas tabela e filtros.

### Como funciona

| Responsável | Papel |
|---|---|
| `core/modal.service.ts` | Injeta o componente modal dinamicamente via `createComponent`. Gerencia ciclo de vida. |
| Página (quem abre) | Chama `modalService.open(Componente, { data })`. Recebe resultado via `Observable<T>`. |
| Modal (componente filho) | Injeta `ModalService` para fechar a si mesmo: `modalService.close(resultado)`. |

### Fluxo

```
Página chama open(Modal, { data })
  → ModalService cria o componente e injeta no DOM
  → Modal exibe o formulário
  → Usuário salva → Modal chama close(resultado)
  → ModalService destrói o componente
  → Página recebe resultado no subscribe e atualiza estado
```

### Onde ficam os arquivos de modal

Cada modal é componente independente dentro da pasta `modais/` da página que o usa:

```
components/pages/nome-pagina/
├── nome-pagina.ts
├── nome-pagina.html      ← zero tags de modal
├── nome-pagina.css
└── modais/
    └── nome-modal/
        ├── nome-modal.modal.ts
        ├── nome-modal.modal.html
        └── nome-modal.modal.css
```

### Convenção de nomenclatura

| Elemento | Convenção | Exemplo |
|---|---|---|
| Arquivo | `nome.modal.ts` | `nova-conexao.modal.ts` |
| Classe | `NomeModal` | `NovaConexaoModal` |
| Selector | `app-nome-modal` | `app-nova-conexao-modal` |

> O seletor de um componente modal não precisa ser declarado em nenhum template — o ModalService cria programaticamente. O seletor existe apenas para conformidade com o padrão Angular standalone.

## Proibições no componente

- **Não** fazer `http.get()` ou `http.post()` direto.
- **Não** calcular regras de negócio (validação complexa, derivação de status, cálculos financeiros).
- **Não** manipular DOM diretamente (exceto via `ViewChild` para integração com libs externas).
- **Não** armazenar estado que deveria ser compartilhado entre componentes.
