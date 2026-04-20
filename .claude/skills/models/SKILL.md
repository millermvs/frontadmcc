---
name: models
description: Criar ou ajustar DTOs (models) para um novo dominio vindo do backend. Triggers — criar arquivo `*.model.ts`, adicionar interface Request/Response, espelhar enum Java, expor lista de opcoes para select no template.
---

# Skill: models

Receita operacional para criar o arquivo `src/app/models/{dominio}.model.ts`
de um novo dominio. Para as regras e padroes, consulte **CLAUDE.md Secao 6
(Padroes de Models)**. Esta skill descreve apenas a sequencia de passos e
os erros comuns.

---

## Quando usar

- Chegou um novo endpoint no backend e e preciso criar os DTOs correspondentes.
- Mudou o contrato de um endpoint existente (campo renomeado, tipo alterado, enum ampliado).
- Precisa adicionar type alias / constantes de labels / lista de opcoes para select.

## Quando NAO usar

- Ja existe um model do mesmo dominio — edite o existente em vez de criar novo.
- O que voce esta tipando nao vem do backend — e estado local do componente, nao precisa virar model.
- Paginacao: **ja existe** `paginacao.model.ts` centralizado. Nunca redeclare `PaginacaoResponseDto`.

---

## Passo a passo

### 1. Mapeie o que o backend retorna

Abra o `ResponseDto` e o `RequestDto` Java no projeto BACK. Liste:

- Campos, tipos e nullability (no Java `@NotNull` / `Optional<>` / anotacoes de validacao).
- Enums referenciados (para virar `type alias`).
- Campos "resolvidos" na resposta (ex: `nomeEquipe` em vez de `idEquipe`) vs campos de escrita (ex: `idEquipe`).

### 2. Crie `src/app/models/{dominio}.model.ts`

Cabecalho obrigatorio: JSDoc de topo listando os endpoints cobertos e o
mapa Request/Response por operacao. Exemplo de estrutura:

```
/**
 * {DOMINIO}.MODEL.TS
 * DTOs para o modulo de {Dominio}.
 *
 * Segue CLAUDE.md SECAO 6 (Padroes de Models).
 *
 * Endpoints cobertos:
 *   POST /api/v1/{dominio}            -> {Dominio}RequestDto
 *   PUT  /api/v1/{dominio}/{id}       -> {Dominio}RequestDto
 *   GET  /api/v1/{dominio} (paginado) -> PaginacaoResponseDto<{Dominio}ResponseDto>
 *   GET  /api/v1/{dominio}/{id}       -> {Dominio}ResponseDto
 */
```

### 3. Ordem das secoes dentro do arquivo

1. **Type aliases** (enums do backend como `'VALOR1' | 'VALOR2'`).
2. **Constantes e labels** (`LABELS_X`, `OPCOES_X` para popular selects).
3. **ResponseDto** (leitura — usado em GET, resposta de POST/PUT).
4. **RequestDto** (escrita — body do POST e PUT).
5. DTOs auxiliares (ex: historico, acoes especiais como alterar-status).

Use separadores visuais (`// ====`) entre secoes para scanning rapido.

### 4. Regras de tipagem (cheat-sheet)

| Situacao                        | Tipo TS                          |
|--------------------------------|----------------------------------|
| IDs (BIGSERIAL no Postgres)    | `number`                         |
| Datas de negocio (DATE)        | `string` (ISO `yyyy-MM-dd`)      |
| Timestamps (TIMESTAMP)         | `string` (`yyyy-MM-ddTHH:mm:ss`) |
| Monetario (BigDecimal)         | `number`                         |
| Boolean Java                   | `boolean` (nunca `'S'`/`'N'`)    |
| Enum Java                      | type alias com literais          |
| Campo opcional (nullable DB)   | `Campo: Tipo \| null`            |
| Paginacao                      | importar de `paginacao.model.ts` |

### 5. Paginacao — NAO duplicar

Se for consumido em GET paginado, **nao** declare a interface neste arquivo.
Ela vive em `src/app/models/paginacao.model.ts` e deve ser importada
diretamente pelo service correspondente.

### 6. Constantes de label para select

Para enums que aparecem em filtros e formularios, exporte tres coisas juntas:

- `type Tipo = 'A' | 'B' | 'C'`
- `LABELS_TIPO: Record<Tipo, string>` — mapa para exibicao no template
- `OPCOES_TIPO: Array<{ valor: Tipo; label: string }>` — para iterar em `<select>`

Isso evita magic strings espalhadas por multiplos componentes.

---

## Checklist antes de considerar o model pronto

- [ ] Nome do arquivo em kebab-case: `{dominio}.model.ts`
- [ ] Interfaces Request e Response separadas (mesmo que parecam iguais hoje)
- [ ] Datas como `string` (nunca `Date` no DTO)
- [ ] Enums como type alias literal, nao `enum TypeScript`
- [ ] Campos opcionais com `| null` (match com o backend)
- [ ] Nenhum `any`
- [ ] Sem duplicar `PaginacaoResponseDto` — importar de `paginacao.model.ts`
- [ ] JSDoc de topo listando endpoints cobertos
- [ ] Se o enum aparece em UI: expor `LABELS_X` e `OPCOES_X`
- [ ] Zero metodos / classes — apenas `interface`, `type`, `const` exportadas

---

## Erros comuns

- **Tipar data como `Date`**: o JSON do backend e string; `Date` quebra parse.
- **Usar `enum` do TypeScript**: gera runtime overhead e complica comparacoes com o backend. Usar type alias literal.
- **Criar interface so para "ficar bonito"**: se o DTO nao entra ou sai da API, nao pertence a `models/`. Vai para estado local do componente.
- **Reexportar `PaginacaoResponseDto` do model**: cria multiplas fontes de verdade. Importar de `paginacao.model.ts` direto no service.
