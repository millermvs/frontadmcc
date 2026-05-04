# Nomenclatura

<!--
  Sem `paths:` → vale para qualquer arquivo. É a "ortografia" do projeto.
-->

## Arquivos

| Elemento | Convenção | Exemplo |
|---|---|---|
| Componente | `nome.ts` | `equipes.ts`, `dashboard.ts` |
| Template | `nome.html` | `equipes.html` |
| Estilos | `nome.css` | `equipes.css` |
| Testes | `nome.spec.ts` | `equipes.spec.ts` |
| Service | `nome.service.ts` | `equipe.service.ts` |
| Model | `nome.model.ts` | `equipe.model.ts` |
| Guard | `nome.guard.ts` | `auth.guard.ts` |
| Interceptor | `nome.interceptor.ts` | `auth.interceptor.ts` |
| Helper | `nome.helper.ts` | `moeda.helper.ts` |
| Pipe | `nome.pipe.ts` | `cpf.pipe.ts` |
| Enum | `nome.enum.ts` | `status.enum.ts` |
| Modal | `nome.modal.ts` | `nova-conexao.modal.ts` |
| Barrel export | `index.ts` | re-exporta tudo da pasta |

> **Decisão do projeto:** componentes usam `nome.ts` (sem `.component`). Componentes de modal usam `nome.modal.ts` para distingui-los visualmente.

## Código

| Elemento | Convenção | Exemplo |
|---|---|---|
| Classes/Interfaces | PascalCase | `Equipes`, `EquipeService`, `EquipeResponseDto` |
| Métodos/Funções | camelCase | `carregarEquipes()`, `filtrarPorStatus()` |
| Variáveis/Signals | camelCase | `termoBusca`, `equipesFiltradas` |
| Constantes | UPPER_SNAKE_CASE | `STATUS_ATIVO`, `MAX_ITENS_PAGINA` |
| Type aliases | PascalCase | `StatusEquipe`, `ModeloReuniao` |
| Seletores | kebab-case com `app-` | `app-equipes`, `app-navbar` |
| Rotas (path) | kebab-case | `/pages/equipes`, `/pages/perfil-cc` |
| CSS classes | kebab-case ou BEM | `page-header`, `kpi-card` |

## Métodos de service

| Ação | Nome | Exemplo |
|---|---|---|
| Listar (paginado) | `listar` | `listarEquipes()` |
| Buscar por ID | `buscarPorId` | `buscarEquipePorId()` |
| Cadastrar | `cadastrar` | `cadastrarEquipe()` |
| Editar | `editar` | `editarEquipe()` |
| Remover | `remover` | `removerEquipe()` |
| Ação específica | verbo descritivo | `alterarStatus()`, `renovarAnuidade()` |

## Métodos de componente

| Ação | Nome | Exemplo |
|---|---|---|
| Carregar dados iniciais | `carregar` | `carregarEquipes()` |
| Filtrar lista | `filtrar` ou nome do signal | `equipesFiltradas` (computed) |
| Abrir modal | `abrirModal` + contexto | `abrirModalCadastro()`, `abrirModalEdicao(equipe)` |
| Salvar | `salvar` | `salvarEquipe()` |
| Confirmar ação | `confirmar` + ação | `confirmarInativacao(equipe)` |
| Navegar | `irPara` | `irParaDetalhes(id)` |
