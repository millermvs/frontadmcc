---
paths:
  - "**/*.model.ts"
  - "**/models/**/*.ts"
---

# Models (DTOs)

<!--
  Carrega só ao mexer em arquivos de model. Regra central: separação
  Request vs Response, e o que cada um pode conter.
-->

## Regra fundamental

Models são **interfaces** TypeScript (não classes). Contratos puros de dados — sem lógica, sem métodos, sem construtores.

## Separação obrigatória

Toda entidade que participa de operações CRUD tem **no mínimo** dois DTOs:

| Tipo | Papel | Conteúdo |
|---|---|---|
| **ResponseDto** | Dados lidos da API (GET, retorno de POST) | Campos "resolvidos" (ex: `nomeEquipe` em vez de `idEquipe`). Reflete o que o backend retorna |
| **RequestDto** | Dados enviados para a API (POST, PUT) | FKs apenas pelo ID (ex: `idEquipe`). Campos editáveis pelo usuário |

## Regras de tipagem

| Regra | Detalhe |
|---|---|
| Datas | sempre `string` (ISO 8601). Backend envia `yyyy-MM-dd` ou `yyyy-MM-ddTHH:mm:ss` |
| Enums | `type` literal union (ex: `type StatusEquipe = 'Ativa' \| 'Em formacao' \| 'Inativa'`) |
| Nullable | `\| null` (não `?` no tipo, mas sim na propriedade) |
| IDs | sempre `number` (refletindo BIGSERIAL do backend) |
| Monetário | `number` (backend envia BigDecimal como número) |
| Booleano | `boolean` (nunca 0/1 ou "S"/"N") |

## Nomenclatura

| Elemento | Convenção | Exemplo |
|---|---|---|
| Arquivo | `kebab-case.model.ts` | `equipe.model.ts` |
| Interface Response | `NomeResponseDto` | `EquipeResponseDto` |
| Interface Request | `NomeRequestDto` | `EquipeRequestDto` |
| Paginação | `PaginacaoResponseDto<T>` | genérico, único no projeto |
| Type alias (enums visuais) | `NomeStatus` | `StatusEquipe`, `ModeloReuniao` |

## Um model, múltiplos DTOs

Um arquivo `.model.ts` pode conter múltiplas interfaces do mesmo domínio:

```
equipe.model.ts
├── EquipeResponseDto      (leitura)
├── EquipeRequestDto       (escrita)
├── StatusEquipe           (type alias)
└── ModeloReuniao          (type alias)
```
