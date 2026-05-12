---
name: doc-componente
description: >
  Use esta skill sempre que o usuário quiser documentar o funcionamento de um componente Angular do projeto Gestão Associados.
  Triggers: "documenta o componente X", "escreve o fluxo de X", "documenta como funciona X", "gera a documentação de X",
  "cria o fluxo de funcionamento", "quero documentar", "preciso do fluxo do componente".
  A skill lê todos os arquivos relevantes (model, service, .ts do componente, .html, rotas, modais) e produz
  uma documentação em prosa corrida — sem headers, sem bullets — no mesmo estilo dos fluxos já existentes
  no projeto (ex: Fluxo de Equipes, Fluxo de Clusters, Fluxo de Cargos de Liderança).
  Acione sempre que o usuário mencionar documentação, fluxo de funcionamento ou quiser registrar como um componente foi construído.
---

# Skill: Documentar Componente

## O que esta skill produz

Uma documentação narrativa em prosa do funcionamento completo de um componente Angular — do model ao template, passando pelo service. O resultado final é um arquivo Markdown com parágrafos corridos, sem headers, sem bullets, no estilo já estabelecido no projeto.

## Arquivos a ler

Antes de escrever qualquer coisa, leia **todos** os arquivos relevantes para o componente. Para um componente `nome-componente`, os arquivos típicos são:

- `src/app/models/nome-componente.model.ts` — DTOs, type aliases, constantes
- `src/app/services/nome-componente.service.ts` — métodos HTTP, URLs, decisões de carregamento
- `src/app/components/pages/nome-componente/nome-componente.ts` — lógica do componente
- `src/app/components/pages/nome-componente/nome-componente.html` — estrutura de formulários, modais, referências @ViewChild
- `src/app/app.routes.ts` — rota, lazy loading, guards
- Qualquer modal em `src/app/components/pages/nome-componente/modais/` — cada modal tem seu próprio `.ts` e `.html`

Se o componente usa helpers (`src/app/helpers/`), services auxiliares ou outros models, leia também. Não escreva nada até ter lido tudo.

## Roteiro de análise (mental, não aparece no output)

Percorra cada camada nesta ordem antes de escrever:

1. **Model**: Quais DTOs existem? Há type aliases ou enums TypeScript? Existem constantes de labels/listas para `<select>`? O `PaginacaoResponseDto<T>` está duplicado aqui (já existe em outro model)?
2. **Service**: Quais métodos expõe? Todas as URLs vêm do `environment`? Algum carregamento é **lazy** (só disparado sob demanda, nunca antecipado)?
3. **Rota**: Qual o path? Tem `loadComponent` (lazy loading)? Quais guards protegem?
4. **ngOnInit**: O que roda na inicialização? São chamadas em paralelo (`forkJoin`) ou sequenciais? Há assinaturas com `takeUntilDestroyed`?
5. **Estado**: Quais `signal()` e `computed()` existem? O que é estado local vs. derivado? O que filtra client-side vs. server-side?
6. **KPI cards**: São `computed()` derivados do signal principal? Recalculam automaticamente?
7. **Formulários**: São `ReactiveFormsModule`? Há validators dinâmicos (`setValidators` + `updateValueAndValidity`)? O `patchValue()` é seguido de `markAsDirty()` nos modais de edição?
8. **Modais**: Como são abertos/fechados? Usam `@ViewChild` nos botões Bootstrap ou `document.getElementById`? Há carregamento lazy ao abrir (GET por ID)?
9. **Tratamento de erros**: O método é centralizado (`tratarErroModal`) ou inline? Como erros aninhados do Spring Boot são normalizados?
10. **Pós-CRUD**: Após cadastro, volta para página 0? Após edição, mantém página atual?
11. **Decisões conscientes**: O que foi feito de forma intencional que merece ser documentado explicitamente? Inconsistências entre este componente e os anteriores?
12. **Contratos com o backend**: O que o `PUT` não aceita no body? O que só existe após o backend criar o recurso?

## Como escrever o output

### Formato obrigatório: prosa corrida, sem headers

O documento é uma narrativa técnica — a forma como um desenvolvedor sênior explicaria o componente para um colega em uma revisão de código. Não é uma referência; é transferência de conhecimento. Por isso:

**Proibido absolutamente:**
- `## Qualquer coisa` — nenhum header de nível 2 ou abaixo
- `### Qualquer coisa` — nenhum sub-header
- Listas com `-` ou `*` no início de linha
- Numeração sequencial `1.`, `2.`, `3.`

**Permitido:**
- `# Título do documento` — apenas o título geral (uma vez, no topo)
- **Negrito** no meio de um parágrafo, para introduzir um novo tópico: `**Modais.**`, `**Tratamento de erros.**`, `**KPI cards.**`
- `código inline` para nomes de arquivos, métodos, signals, DTOs, constantes

A razão pela qual headers são proibidos: eles transformam o documento em índice de referência. O objetivo aqui é diferente — queremos que o leitor entenda o *raciocínio* por trás de cada decisão, não apenas saiba que "o componente tem modais". Parágrafos corridos forçam o autor a conectar as ideias e explicar os porquês.

**Mesmo para componentes muito complexos** (múltiplos modais, vários services, dezenas de signals), a regra vale. A complexidade se resolve com parágrafos mais longos e **negrito** para sinalizar mudança de tópico dentro do parágrafo, não com headers.

### Estrutura de cada parágrafo

- Um parágrafo = um conceito ou camada
- Não misture model com service no mesmo parágrafo
- Comece pelo arquivo ou elemento central: "O `conexao.model.ts` define…", "O `ConexaoService` expõe…"
- Frases curtas e diretas. Diga o que acontece **e por quê**

### O que sempre incluir

- Quando um carregamento é lazy, diga explicitamente que **nunca é antecipado**
- Quando um trade-off é consciente, nomeie: "Essa decisão consciente…", "Esse trade-off é intencional…"
- Quando algo **não** acontece (sem GET adicional, sem filtragem server-side, status não enviado no PUT), diga — o que não existe é tão informativo quanto o que existe
- Quando este componente diverge do padrão de um anterior, aponte como "evolução de padrão" ou "inconsistência"
- Quando o Spring Boot serializa algo de forma que o frontend precisa adaptar (ex: caminhos aninhados em erros), explique o problema e a solução
- Sempre use `signal()` e `computed()` com parênteses e em código inline ao referenciar esses construtos

### O que evitar

- Nunca descreva o HTML linha a linha. O template importa apenas onde revela decisões arquiteturais
- Nunca liste endpoints sem explicar o contexto de quando são chamados
- Nunca diga "o componente tem um formulário" sem explicar o comportamento real desse formulário

## Onde salvar o arquivo

Salve o resultado em `src/app/components/pages/nome-componente/` com o nome `## N — Fluxo de NomeComponente.md`, seguindo a numeração sequencial dos documentos já existentes no projeto. Pergunte ao usuário qual é o número correto se não souber.

## Exemplo de abertura de parágrafo (não copie, use como referência de tom)

> O `conexao.model.ts` define quatro interfaces e dois type aliases. `ConexaoResponseDto` carrega… O type alias `TipoConexao` (`'QUENTE' | 'MORNO' | 'FRIO'`) espelha o enum Java exatamente como o backend o serializa…

O parágrafo começa pelo arquivo, nomeia o que contém, e explica as decisões de design — não apenas lista campos.