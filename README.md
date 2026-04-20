# ADM C+C — Painel Administrativo

Painel de back-office da rede **C+C** para gestão completa de associados, equipes, módulos operacionais e indicadores de performance.

---

## Sobre o Projeto

A rede C+C é uma organização de networking empresarial estruturada em equipes, onde associados trocam conexões estratégicas, indicações de negócios e realizam reuniões bilaterais periódicas.

Este repositório contém o **Painel Administrativo** (ADM C+C) — a interface web exclusiva para a equipe administrativa, responsável por:

- Cadastro e gestão completa de associados
- Configuração de equipes e lideranças
- Controle de status, anuidades e renovações
- Acompanhamento dos módulos operacionais semanais
- Visualização de indicadores e relatórios de performance

> O ecossistema completo também inclui uma **API REST** (back-end) e um **Aplicativo Mobile** para os associados — ambos em repositórios separados.

---

## Stack

| Tecnologia | Versão |
|---|---|
| Angular | 20.3 |
| TypeScript | 5.9 |
| Bootstrap | 5.3 |
| Bootstrap Icons | 1.13 |
| RxJS | 7.8 |
| Node.js | 22+ recomendado |

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) 22 ou superior
- [Angular CLI](https://angular.dev/tools/cli) 20

```bash
npm install -g @angular/cli
```

---

## Instalação

```bash
# 1. Clone o repositório
git clone <url-do-repositorio>
cd "FRONT - Gestão Associados"

# 2. Instale as dependências
npm install
```

---

## Rodando o projeto

```bash
# Servidor de desenvolvimento (http://localhost:4200)
ng serve

# Com reload automático ao salvar
ng build --watch --configuration development
```

---

## Build para produção

```bash
ng build
```

Os artefatos são gerados na pasta `dist/`. O build de produção já aplica otimizações de performance e tree-shaking.

---

## Testes

```bash
# Testes unitários (Karma + Jasmine)
ng test
```

---

## Módulos do Sistema

O painel é estruturado em fases de entrega, alinhadas ao PRD do produto:

| Fase | Módulo | Descrição |
|---|---|---|
| 1 | Cadastro Inicial | Dados pessoais, empresa, status e classificação do associado |
| 2 | Seguro | Cadastro de seguro de vida/funeral e beneficiários |
| 3 | Perfil C+C | Perfil público do associado na rede |
| 4 | Operacional | Reuniões, Conexões, Parcerias, Visitantes (ciclo semanal) |
| 5 | Indicadores | Painel de performance, rankings e relatórios |

### Perfis de acesso

| Perfil | Nível | Permissões |
|---|---|---|
| ADM C+C | 1 | Acesso total — cria, edita e valida qualquer dado |
| Diretores | 2 | Acesso gerencial — valida presenças e designa lideranças |
| Associado | 3 | Acesso via APP mobile — perfil e módulos operacionais |

---

## Estrutura de Pastas

```
src/
├── app/
│   ├── core/           # Serviços globais, guards, interceptors
│   ├── shared/         # Componentes, pipes e diretivas reutilizáveis
│   ├── features/       # Módulos funcionais (associados, equipes, etc.)
│   └── app.routes.ts   # Roteamento principal
├── assets/             # Imagens e recursos estáticos
└── styles/             # Estilos globais
```

---

## Padrões de Desenvolvimento

- Arquitetura baseada em **componentes standalone** (Angular 17+)
- Formulários reativos com `ReactiveFormsModule`
- Comunicação com a API via `HttpClient` com interceptors de autenticação
- Estilo com **Bootstrap 5** + **Bootstrap Icons**
- Formatação de código com **Prettier** (printWidth: 100, singleQuote)
- Commits seguindo **Conventional Commits**

---

## Links Úteis

- [Angular Documentation](https://angular.dev)
- [Angular CLI Reference](https://angular.dev/tools/cli)
- [Bootstrap 5](https://getbootstrap.com/docs/5.3)
- [Bootstrap Icons](https://icons.getbootstrap.com)
