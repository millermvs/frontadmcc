---
name: components
description: Criar pagina CRUD Angular (listagem + KPIs + filtros + tabela + modal). Triggers — criar nova pagina em `components/pages/*`, adicionar tela de listagem com filtros, implementar modal de cadastro/edicao, criar KPI cards de contagem por status.
---

# Skill: components

Receita operacional para criar uma pagina CRUD padrao do sistema ADM C+C.
Para as regras, consulte **CLAUDE.md Secao 4 (Padroes de Componentes)**,
**Secao 8 (Formularios)**, **Secao 11 (Estilo Visual)** e **Secao 12 (Tratamento de Erros)**.

---

## Quando usar

- Nova pagina CRUD em `components/pages/{dominio}/`.
- Reescrever uma pagina antiga no padrao atual.
- Adicionar tela de gerenciamento (equipes, associados, cargos, etc.).

## Quando NAO usar

- Componente reutilizavel (navbar, modal generico, toast): vai em `components/shared/`, nao em `pages/`.
- Componente de apoio especifico de uma pagina (subcomponente que so faz sentido dentro dela): use subcomponente filho no mesmo diretorio.

---

## Passo a passo

### 1. Pre-requisitos

Antes de comecar a pagina:

1. Existe `{dominio}.service.ts` com os metodos CRUD? (Skill `services`)
2. Existe `{dominio}.model.ts` com DTOs + labels/opcoes? (Skill `models`)
3. A rota foi adicionada em `app.routes.ts` com lazy loading? Se nao, adicionar depois.
4. O item aparece na navbar (se for pagina visivel no menu)?

### 2. Estrutura de arquivos

```
src/app/components/pages/{dominio}/
  {dominio}.ts        -> classe do componente
  {dominio}.html      -> template
  {dominio}.css       -> estilos exclusivos (nao duplicar globais)
  {dominio}.spec.ts   -> testes
```

**Nunca** usar `.component.ts` no nome — convencao do projeto e so `{dominio}.ts` (CLAUDE.md 14.1).

### 3. Esqueleto da classe (CLAUDE.md 4.1)

Ordem obrigatoria das secoes dentro da classe:

1. `IMPORTS`
2. `METADATA` (@Component standalone com templateUrl/styleUrl)
3. `INJECOES` via `inject()`
4. `SIGNALS DE ESTADO` (signal + computed)
5. `ngOnInit` (se necessario — carga inicial)
6. `METODOS PUBLICOS` (acoes chamadas pelo template)
7. `METODOS PRIVADOS` (helpers internos)

Regras inegociaveis:

- `standalone: true` sempre.
- `inject()` no topo da classe — sem construtor.
- Estado com `signal()` e `computed()` — nunca variaveis soltas.
- Cada componente tem **3 arquivos separados** (ts/html/css). Nunca inline.

### 4. Layout visual padrao (CLAUDE.md 4.4 e 11.5)

Toda pagina CRUD segue esta sequencia de elementos:

```
<section class="page-header">             [Breadcrumb + Titulo + Botao "Novo X"]
<div class="row g-3 mb-4">                [KPI Cards — classes .kpi-card]
<div class="filter-bar">                  [Input busca + Selects + .filter-count]
<div class="table-card">                  [Wrapper da tabela com overflow-x]
  <div class="table-wrapper">
    <table>...
  <\!-- empty-state dentro de <td colspan> quando lista vazia -->
<ng-container>                            [Modal Bootstrap de cadastro/edicao]
```

Todas as classes sao **globais** (`styles.css`). NAO redeclarar nenhuma no CSS do componente. O CSS do componente so cobre elementos exclusivos daquela pagina (ex: coluna de progresso, avatar, etc.).

### 5. KPIs como `computed()`

KPIs sao contadores por status derivados da lista. Use **computed signals**, nao calcule no template:

```
totalAtivos   = computed(() => this.lista().filter(e => e.status === 'ATIVO').length);
totalInativos = computed(() => this.lista().filter(e => e.status === 'INATIVO').length);
```

### 6. Filtros enviados ao backend

Importante: **filtros e paginacao nao se misturam no cliente**. Se a listagem e paginada, o filtro DEVE ir para o backend. Filtrar em cliente apos receber so a pagina atual produz resultado incorreto (a pagina 2 pode ter registros que o filtro atual rejeita e voce nem ve).

Padrao:

- Filtros viram parametros extras no `listar()` do service (adicionar como `HttpParams`).
- O backend expoe filtros no endpoint paginado (ex: `?page=0&size=10&status=ATIVO&nome=joao`).
- O componente recarrega a lista quando qualquer filtro muda.

Se o backend ainda nao suporta o filtro, parar e propor ao time backend — nao cair para filtro cliente em listagem paginada.

### 7. Modal de cadastro/edicao (CLAUDE.md 8.3)

- Sempre em modal Bootstrap, nunca pagina separada.
- Form reativo (`ReactiveFormsModule` + `FormBuilder`) quando tem 6+ campos; simples com `[(ngModel)]` quando ate 5.
- Em edicao: `form.patchValue(entidade)`. **NUNCA** chamar `markAsDirty()` depois — o botao "Salvar Alteracoes" deve comecar desabilitado e so habilitar quando o usuario tocar algo.
- Botao salvar: `[disabled]="\!form.dirty || form.invalid || carregando()"`.

### 8. Feedback e erros (CLAUDE.md 12)

No `.subscribe({ next, error })`:

- 400 → marcar campos invalidos com as mensagens do backend. Normalizar chaves aninhadas pelo ultimo segmento do path (`'localPresencial.cep'` -> `'cep'`).
- 409 / 422 → toast ou alerta **dentro** do modal com a mensagem do backend.
- 500 → toast vermelho generico.
- Sucesso → fechar modal + toast verde + recarregar lista.

Nunca `subscribe()` vazio, nunca `.catch(() => {})`, nunca exibir stack trace ao usuario.

### 9. Controle de acesso visual (CLAUDE.md 10.2)

Elementos ADM-only ficam **escondidos** (nao desabilitados) para outros perfis:

```
@if (authService.temPermissao('ADM_CC')) {
  <button>Inativar</button>
}
```

Use `perfil`, nao `role` — CLAUDE.md 10.1.

### 10. Rota e navbar

1. Adicionar em `app.routes.ts`:

```
{ path: '{dominio}', loadComponent: () =>
    import('./components/pages/{dominio}/{dominio}').then(m => m.{Dominio}) }
```

2. Adicionar item na navbar (se for acessivel pelo menu). Respeitar visibilidade de perfil.

---

## Checklist

- [ ] 3 arquivos separados (ts/html/css) + `.spec.ts`
- [ ] `standalone: true`
- [ ] Injecoes via `inject()`
- [ ] Estado com `signal()` / `computed()` — sem variaveis soltas
- [ ] Layout segue a sequencia: page-header, kpi-cards, filter-bar, table-card, modal
- [ ] Classes globais usadas direto no template (sem redeclarar no CSS)
- [ ] Filtros + paginacao passam pelo backend (nao filtrar cliente em lista paginada)
- [ ] Modal em vez de pagina separada para criacao/edicao
- [ ] Form em edicao: zero `markAsDirty()` manual
- [ ] Botao salvar respeita `\!form.dirty || form.invalid || carregando()`
- [ ] `.subscribe()` com `error` tratado + feedback visual ao usuario
- [ ] Elementos ADM-only escondidos com `@if (temPermissao(...))` usando `perfil`
- [ ] Rota adicionada em `app.routes.ts` com lazy loading
- [ ] Item na navbar (se aplicavel) com visibilidade correta
- [ ] Responsivo: testar mobile (< 768px) e tablet (768-1200px)
- [ ] Empty state e loading tratados no template

---

## Erros comuns

- **Pagina separada em vez de modal**: viola padrao do sistema (CLAUDE.md 8.3). Sempre modal.
- **Filtrar no cliente uma lista paginada**: resultado incorreto. Levar filtro ao backend.
- **`markAsDirty()` apos `patchValue()`**: derruba a protecao "salvar so quando houver mudanca" (CLAUDE.md 8.3).
- **Regra de negocio no componente**: calculos/validacoes complexas vivem no backend. Frontend apenas exibe e delega (CLAUDE.md 2.2).
- **Chamada HTTP direta no componente**: viola Secao 2.1. Sempre via service.
- **Usar `role` para controle de UI**: deve ser `perfil`. `role` e so para o Spring Security.
- **`.subscribe()` sem handler de erro**: deixa o usuario sem feedback em falha.
- **Redeclarar classe global no CSS do componente**: cria divergencia de manutencao (CLAUDE.md 11.4).
- **Colocar tudo em um arquivo soh > 200 linhas**: extrair subcomponentes.
