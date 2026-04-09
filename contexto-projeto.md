---
name: gestao-associados-front
description: "Contexto completo do frontend \"Gestão de Associados\" — um Painel Administrativo em Angular 20 + Bootstrap 5. Use esta skill SEMPRE que o usuário mencionar o frontend desse projeto, pedir para criar/editar páginas, componentes, services, models, rotas, ou qualquer camada da aplicação Angular. Também use quando o usuário quiser entender como o frontend se conecta com o backend, pedir para implementar uma nova feature no painel, ou perguntar sobre os padrões de código do front. Contém: stack, arquitetura, padrões obrigatórios, estado atual de todos os componentes/services/models, decisões de UX e mapa completo de correspondência com o backend."
---
 
# Projeto: Gestão de Associados — Frontend (Painel ADM)
 
## Stack
 
- **Angular 20.3** (standalone components, signals, computed)
- **TypeScript 5.9** (strict mode)
- **Bootstrap 5.3** + **Bootstrap Icons 1.13** (CSS global + JS bundle)
- **RxJS 7.8** (Observables para HTTP)
- **Zone.js 0.15** (change detection)
- **Angular CLI 20.3** com builder `@angular/build:application`
- **Prettier** (printWidth: 100, singleQuote: true, angular parser para HTML)
- **Karma + Jasmine** (testes unitários)
- **Backend**: API REST em Java 21 + Spring Boot (porta 8080, JWT stateless)
- **Projeto Angular**: `admccfront` (prefix: `app`)
 
---
 
## Arquitetura do Projeto
 
```
src/
├── app/
│   ├── core/                          ← Singleton (carrega 1x)
│   │   └── auth/                      ← Autenticação completa
│   │       ├── auth.model.ts          ← LoginRequest, LoginResponse, UsuarioLogado
│   │       ├── auth.service.ts        ← login(), logout(), getToken(), temPermissao()
│   │       ├── auth.interceptor.ts    ← Injeta Bearer + trata 401
│   │       ├── auth.guard.ts          ← authGuard, roleGuard()
│   │       ├── index.ts              ← Barrel export
│   │       └── login/                 ← Tela de login
│   │           ├── login.ts/html/css
│   ├── components/
│   │   ├── pages/                     ← Páginas (1 por rota)
│   │   │   ├── dashboard/             ← Dashboard (dados mock)
│   │   │   └── equipes/              ← Equipes (service real)
│   │   └── shared/                    ← Componentes reutilizáveis
│   │       └── navbar/               ← Menu lateral colapsável
│   ├── models/                        ← DTOs (espelham backend)
│   │   ├── associado.model.ts
│   │   ├── cluster.model.ts
│   │   └── equipe.model.ts
│   ├── services/                      ← Chamadas HTTP
│   │   ├── associado.service.ts
│   │   ├── cluster.service.ts
│   │   └── equipe.service.ts
│   ├── app.ts                         ← Root component
│   ├── app.html                       ← Layout: sidebar + router-outlet
│   ├── app.css                        ← Layout global
│   ├── app.config.ts                  ← Providers (router, http, interceptor)
│   └── app.routes.ts                  ← Rotas com lazy loading + guards
├── environments/
│   ├── environment.ts                 ← Produção (api.admcc.com.br)
│   └── environment.development.ts     ← Dev (localhost:8080)
├── styles.css                         ← Estilos globais (Inter, scrollbar)
├── index.html                         ← SPA entry point (pt-BR)
└── main.ts                            ← Bootstrap da aplicação
```
 
---
 
## Padrões Obrigatórios de Código
 
### Componentes
- **Standalone**: todo componente usa `standalone: true` (sem NgModules)
- **Signals**: estado local com `signal()`, derivados com `computed()`
- **Injeção**: usar `inject()` em vez de constructor injection
- **Nomenclatura**: arquivo = `nome.ts` (sem `.component`), classe = `NomePascalCase`
- **Seletores**: `app-nome-do-componente`
- **Imports**: apenas o necessário (CommonModule, FormsModule, etc.)
- **CSS**: arquivo próprio por componente (não inline)
 
### Services
- `@Injectable({ providedIn: 'root' })` — singleton global
- Injeção de `HttpClient` via `inject()`
- Cada service mapeia 1 domínio do backend
- Métodos retornam `Observable<T>` tipado
- URL vem do `environment.api.dominio.metodo`
- Paginação: `HttpParams` com `number` e `size`
 
### Models (DTOs)
- `interface` (não class) — são contratos de dados, não objetos
- Sufixo `ResponseDto` para leitura, `RequestDto` para escrita
- Response usa nomes em texto (ex: `nomeCluster`); Request usa IDs (ex: `idCluster`)
- `PaginacaoResponseDto<T>` genérico: `conteudo`, `numeroPagina`, `tamanhoPagina`, `totalElementos`, `totalPaginas`, `ultimaPagina`
- Datas como `string` (ISO 8601) — backend envia `yyyy-MM-dd` ou `yyyy-MM-ddTHH:mm:ss`
 
### Rotas
- Lazy loading: `loadComponent: () => import(...)` (não import estático)
- Rotas protegidas: `canActivate: [authGuard]` no pai `pages`
- Rotas ADM-only: `canActivate: [roleGuard('ADM_CC')]`
- Redirect padrão: `''` → `/pages/dashboard`
- Wildcard: `'**'` → `/pages/dashboard`
 
### Environments
- Centralizado: todos os endpoints ficam em `environment.api.*`
- Endpoints estáticos: `listar: \`\${baseUrl}/equipes\``
- Endpoints dinâmicos: `buscarPorId: (id: number) => \`\${baseUrl}/equipes/\${id}\``
- Dev: `http://localhost:8080/api/v1`
- Prod: `https://api.admcc.com.br/api/v1`
- `angular.json` faz `fileReplacements` no build de development
 
### Estilo Visual
- Cor primária: `#2f855a` (verde C+C)
- Gradientes: `#1a5632` → `#2f855a` → `#38a169`
- Background: `#f4f7f5`
- Texto: `#0f172a` (escuro), `#64748b` (secundário)
- Font: Inter (system stack fallback)
- Cards: `background: white`, `border-radius: 12px`, `box-shadow` sutil
- Responsivo: breakpoints em `768px` (tablet) e `480px` (mobile)
 
---
 
## Autenticação — Correspondência Frontend ↔ Backend
 
O sistema de auth do frontend espelha o backend (JWT stateless). A tabela mostra como cada peça se corresponde:
 
| Frontend | Backend | Função |
|----------|---------|--------|
| `auth.model.ts` (LoginRequest) | `LoginRequestDto` | Corpo do POST /login |
| `auth.model.ts` (LoginResponse) | Response do AuthController | `{ token, nome, email, role, idAssociado }` |
| `auth.model.ts` (UsuarioLogado) | `UsuarioAutenticado` | Dados do usuário durante a sessão |
| `auth.service.ts` → login() | `AuthService.autenticar()` | Executa o login |
| `auth.service.ts` → getToken() | `TokenService.gerarToken()` | Backend gera, front armazena |
| `auth.service.ts` → temPermissao() | `@PreAuthorize("hasRole()")` | Controle de acesso visual |
| `auth.interceptor.ts` | `SecurityFilter` (invertido) | Filter RECEBE token; Interceptor ENVIA token |
| `auth.guard.ts` → authGuard | `.anyRequest().authenticated()` | Bloqueia rotas sem login |
| `auth.guard.ts` → roleGuard() | `.hasRole("ADM")` | Bloqueia rotas sem permissão |
| `localStorage` | `SecurityContextHolder` | Onde a sessão fica armazenada |
 
### Fluxo completo de login
1. Usuário preenche email + senha na tela `/login`
2. `AuthService.login()` faz `POST /api/v1/auth/login`
3. Backend valida com `AuthenticationManager` + BCrypt
4. Backend gera JWT com `TokenService.gerarToken()` (8h expiração)
5. Frontend recebe `{ token, nome, email, role, idAssociado }`
6. Frontend guarda token + dados no `localStorage`
7. Signal `_usuario` é atualizado → toda a UI reage
8. `AuthInterceptor` injeta `Authorization: Bearer <token>` em toda requisição
9. Se backend retorna 401 → interceptor chama `logout()` → redireciona para `/login`
 
### Perfis no painel
- **ADM_CC** (Nível 1): acesso total a tudo
- **DIRETOR** (Nível 2): acesso parcial — elementos sem permissão ficam **escondidos** (não desabilitados)
- **ASSOCIADO** (Nível 3): apenas APP mobile (não acessa este painel)
 
### Chaves do localStorage
- `admcc_token` — JWT puro (string)
- `admcc_usuario` — JSON serializado de `UsuarioLogado`
 
---
 
## Environments — Endpoints Completos
 
Todos os endpoints do backend (~84) estão mapeados em `environment.api.*`. Estrutura:
 
```
api.auth           → login, register
api.associados     → listar, cadastrar, buscarPorId, editar, confirmarCadastro,
                     renovarAnuidade, alterarStatus, historicoStatus, perfil,
                     editarCampo, togglePermissao
api.anuidades      → cadastrar, buscarPorId, editar, porAssociado
api.renovacoes     → porAssociado
api.cargosLideranca    → listar, cadastrar, buscarPorId, editar
api.associadosCargos   → cadastrar, buscarPorId, editar, porAssociado, porCargo
api.enderecosResidenciais → cadastrar, editar, porAssociado
api.grupamentos         → listar, cadastrar, buscarPorId, editar
api.associadosGrupamentos → cadastrar, buscarPorId, editar, porAssociado, porGrupamento
api.visibilidade        → cadastrar, buscarPorId, editar, porAssociado
api.equipes             → listar, cadastrar, buscarPorId, editar
api.equipesCargosAtivos → cadastrar, buscarPorId, editar, porEquipe, ativosPorEquipe
api.equipesDesignacao   → cadastrar, buscarPorId, editar, porEquipe
api.equipesDiretorEquipe    → cadastrar, buscarPorId, editar, porEquipe
api.equipesDiretorTerritorio → cadastrar, buscarPorId, editar, porEquipe
api.equipesLocalPresencial  → cadastrar, buscarPorId, editar, porEquipe
api.pontuacaoFaixas    → listar, cadastrar, buscarPorId, editar, ativas
api.clusters           → listar, cadastrar, buscarPorId, editar
api.atuacoesEspecificas → listar, cadastrar, buscarPorId, editar, porCluster
api.empresas           → cadastrar, buscarPorId, editar, porAssociado
api.enderecosComerciais → cadastrar, buscarPorId, editar, porEmpresa
api.perfisAssociado    → cadastrar, buscarPorId, editar, porAssociado
api.produtos           → listar, cadastrar, buscarPorId, editar, checkout
```
 
---
 
## Models Existentes (3 arquivos)
 
### associado.model.ts
- `PaginacaoResponseDto<T>` — wrapper genérico de paginação
- `AssociadoResponseDto` — 14+ campos (nomeCompleto, cpf, email, telefone, datas, status, nomes de relações)
- `AssociadoRequestDto` — usa IDs para FK (idEquipeAtual, idCluster, idAtuacaoEspecifica, etc.)
- `EnderecoResidencialResponseDto` — endereço com nomeAssociado
- `EnderecoResidencialRequestDto` — endereço com idAssociado
 
### equipe.model.ts
- `EquipeResponseDto` — nomeEquipe, status, dia/horário/modelo reunião, datas formação/lançamento, numeroComponentes, pontuacaoMensal
- `EquipeRequestDto` — mesmos campos sem ID e sem calculados
- `PaginacaoResponseDto<T>` — duplicado (consolidar futuramente)
 
### cluster.model.ts
- `ClusterResponseDto` — idCluster, nome
- `ClusterRequestDto` — nome
- `AtuacaoEspecificaResponseDto` — id, nome, nomeCluster, idCluster
- `AtuacaoEspecificaRequestDto` — nome, idCluster
- `PaginacaoResponseDto<T>` — duplicado (consolidar futuramente)
 
### Pendência: PaginacaoResponseDto duplicado
Existe em 3 arquivos de model. Deve ser consolidado em `core/models/paginacao.model.ts` como fonte única.
 
---
 
## Services Existentes (3 arquivos)
 
### equipe.service.ts
- `listarEquipes(page, size)` → GET paginado
- `buscarEquipePorId(id)` → GET por ID
- `cadastrarEquipe(dto)` → POST
- `editarEquipe(id, dto)` → PUT
 
### associado.service.ts
- CRUD de associado (listar, buscar, cadastrar, editar)
- CRUD de endereço residencial (listar por associado, cadastrar, editar)
 
### cluster.service.ts
- CRUD de cluster (listar, buscar, cadastrar, editar)
- CRUD de atuação específica (listar, listar por cluster, buscar, cadastrar, editar)
 
### Padrão de service — receita para novos services
```typescript
@Injectable({ providedIn: 'root' })
export class NomeService {
  private http = inject(HttpClient);
  private apiUrl = environment.api.dominio;
 
  listar(page = 0, size = 10): Observable<PaginacaoResponseDto<NomeResponseDto>> {
    const params = new HttpParams()
      .set('number', page.toString())
      .set('size', size.toString());
    return this.http.get<PaginacaoResponseDto<NomeResponseDto>>(this.apiUrl.listar, { params });
  }
 
  buscarPorId(id: number): Observable<NomeResponseDto> {
    return this.http.get<NomeResponseDto>(this.apiUrl.buscarPorId(id));
  }
 
  cadastrar(dto: NomeRequestDto): Observable<NomeResponseDto> {
    return this.http.post<NomeResponseDto>(this.apiUrl.cadastrar, dto);
  }
 
  editar(id: number, dto: NomeRequestDto): Observable<NomeResponseDto> {
    return this.http.put<NomeResponseDto>(this.apiUrl.editar(id), dto);
  }
}
```
 
---
 
## Componentes Existentes
 
### Navbar (`components/shared/navbar/`)
- Menu lateral colapsável: 56px fechado → 200px aberto
- 11 itens de menu com ícones Bootstrap Icons
- `routerLinkActive="active-link"` para item ativo
- Cor: fundo `#2f855a`, texto branco, active = `#1a4731` + borda `#a7f3d0`
- Signal: `sidebarExpanded` (toggle)
 
### Dashboard (`components/pages/dashboard/`)
- **DADOS 100% MOCK** — hardcoded nos signals do componente
- Hero panel com KPIs de negócio (equipes, associados, conexões, visitantes)
- Grid de cards resumo, painéis de equipes, agenda, ranking, conexões
- Types locais: CardResumo, AgendaItem, ConexaoItem, EquipeResumo, RankingItem
- Helpers: `textoMoeda()` (BRL), `percentualFormacao()`, classes CSS por status
 
### Equipes (`components/pages/equipes/`)
- **CONSOME SERVICE REAL** — `EquipeService.listarEquipes()`
- KPIs: total, ativas, em formação, inativas (computed signals)
- Filtros: busca por texto + status + modelo reunião
- Tabela com: avatar/iniciais, status badge, reunião, progresso formação, ações
- Ações: editar (TODO: modal), inativar/reativar (TODO: service call)
- Responsive com breakpoints
 
### Login (`core/auth/login/`)
- Split-screen: painel marca (gradient verde) + painel formulário
- Campos: email + senha com ícones
- States: `carregando`, `mensagemErro`
- Erros: 401/403 → "E-mail ou senha incorretos", 0 → "Servidor indisponível"
- Botão desabilitado enquanto campos vazios ou carregando
 
---
 
## Layout e Rotas
 
### Estrutura de rotas
```
/login                    → Login (pública, sem guard)
/pages                    → canActivate: [authGuard]
  /pages/dashboard        → Dashboard (lazy loaded)
  /pages/equipes          → Equipes (lazy loaded)
/                         → redirect → /pages/dashboard
/**                       → redirect → /pages/dashboard
```
 
### Layout da aplicação
```
┌─────────────────────────────────────┐
│ ┌──────┐ ┌────────────────────────┐ │
│ │      │ │                        │ │
│ │Navbar│ │    <router-outlet>     │ │
│ │      │ │                        │ │
│ │(side)│ │   (main-content)       │ │
│ │      │ │                        │ │
│ └──────┘ └────────────────────────┘ │
└─────────────────────────────────────┘
```
- Navbar é `position: sticky`, sempre visível
- Main content: `flex: 1`, `overflow-y: auto`
- Login NÃO mostra navbar (rota fora do layout principal)
 
---
 
## Padrão de Página CRUD (baseado em Equipes)
 
Toda nova página CRUD deve seguir esta estrutura:
 
### Estrutura visual
```
1. Page Header     → Breadcrumb + Título + Botão "Novo X"
2. KPI Cards       → 3-4 cards com contadores por status
3. Filter Bar      → Input busca + selects de filtro + contador resultados
4. Data Table      → Colunas com dados + coluna de ações (editar, inativar)
5. Empty State     → Mensagem quando não há resultados
```
 
### Estrutura do componente
```typescript
@Component({ standalone: true, imports: [CommonModule, FormsModule] })
export class NomePage implements OnInit {
  private service = inject(NomeService);
 
  // Estado
  dados = signal<NomeResponseDto[]>([]);
  termoBusca = signal('');
  filtroStatus = signal('');
 
  // Computed
  dadosFiltrados = computed(() => { /* combina filtros */ });
  totalPorStatus = computed(() => { /* conta por status */ });
 
  ngOnInit() { this.carregar(); }
 
  carregar() {
    this.service.listar().subscribe({
      next: (res) => this.dados.set(res.conteudo),
      error: (err) => console.error(err),
    });
  }
}
```
 
### Formulários em modal
- Formulários simples (até ~5 campos): modal Bootstrap
- Formulários complexos (Associado, Seguro): modal grande com abas internas e scroll
- Todos os formulários usam modal — nunca página separada
 
---
 
## Decisões de UX Tomadas
 
| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Permissões visuais | Esconder elementos | ADM vê tudo; Diretor não vê o que não pode usar |
| Formulários | Modal (sempre) | Complexos usam abas/scroll dentro do modal |
| Toast/Notificação | Componente próprio (a implementar) | Bootstrap alerts + ToastService global |
| Layout CRUD | Modelo Equipes | Header, KPIs, filtros, tabela, ações |
| Dados mock (dashboard) | Temporário | Migrar para services reais conforme backend avança |
 
---
 
## Correspondência Páginas ↔ Backend
 
| Página (menu) | Status Frontend | Services Backend Disponíveis |
|---------------|----------------|------------------------------|
| Dashboard | Implementado (mock) | Indicadores (Sprint 9 — pendente) |
| Equipes | Implementado (real) | EquipeService ✅ |
| Associados | Não implementado | AssociadoService, AnuidadeService, RenovacaoService ✅ |
| Clusters | Não implementado | ClusterService, AtuacaoEspecificaService ✅ |
| Atuações | Não implementado | AtuacaoEspecificaService ✅ |
| Reuniões | Não implementado | Sprint 6 — pendente no backend |
| Conexões | Não implementado | Sprint 7 — pendente no backend |
| Parcerias | Não implementado | Sprint 7 — pendente no backend |
| Visitantes | Não implementado | Sprint 8 — pendente no backend |
| Relatórios | Não implementado | Sprint 10 — pendente no backend |
| Perfil C+C | Não implementado | PerfilAssociadoService ✅ |
 
---
 
## Infraestrutura Pendente (a implementar)
 
| Item | Prioridade | Descrição |
|------|-----------|-----------|
| ToastService + ToastComponent | Alta | Feedback global (sucesso/erro) usando Bootstrap alerts |
| Modal genérico | Alta | Componente wrapper para formulários reutilizáveis |
| Estrutura por feature | Média | Migrar para `features/equipes/`, `features/associados/`, etc. |
| Loading states | Média | Spinner/skeleton em todas as páginas durante carregamento |
| Error boundary | Média | Tratamento global de erros HTTP (403, 500) |
| PaginacaoResponseDto único | Baixa | Consolidar a interface duplicada em 3 models |
 
---
 
## Build & Deploy
 
### Comandos
```bash
ng serve                # Inicia dev server (localhost:4200, usa environment.development.ts)
ng build                # Build produção (usa environment.ts)
ng build --configuration=development  # Build dev
ng test                 # Roda testes (Karma + Jasmine)
```
 
### angular.json — Configurações relevantes
- Builder: `@angular/build:application`
- Styles globais: `styles.css`, `bootstrap.min.css`, `bootstrap-icons.css`
- Scripts globais: `bootstrap.bundle.min.js`
- Budget produção: 500kB warning, 1MB error (initial)
- fileReplacements: dev troca `environment.ts` → `environment.development.ts`
 
### CORS
- Backend permite `http://localhost:4200` (SecurityConfig do Spring)
- Em produção, ajustar para o domínio real
 
---
 
## Progresso vs PRD (01/04/2026)
 
| Área | Status | % |
|------|--------|---|
| Environments (endpoints) | ✅ Completo (todos os ~84 endpoints) | 100% |
| Autenticação (login, guard, interceptor) | ✅ Completo | 100% |
| Navbar + Layout | ✅ Completo | 100% |
| Dashboard | ⚠️ Funcional com dados mock | 50% |
| Equipes (listagem + filtros) | ⚠️ Listagem OK, falta modal criar/editar | 60% |
| Associados | ❌ Não iniciado | 0% |
| Clusters / Atuações | ❌ Não iniciado | 0% |
| Reuniões / Conexões / Parcerias | ❌ Não iniciado (backend pendente) | 0% |
| Visitantes | ❌ Não iniciado (backend pendente) | 0% |
| Relatórios / Indicadores | ❌ Não iniciado (backend pendente) | 0% |
| Perfil C+C | ❌ Não iniciado | 0% |
| Toast/Notificação | ❌ Não implementado | 0% |
| Modal genérico | ❌ Não implementado | 0% |
 
---
 
## Ao Criar Novos Componentes — Checklist
 
1. Criar na pasta correta (`components/pages/nome/` ou `components/shared/nome/`)
2. Usar standalone component com signals
3. Criar model (`.model.ts`) com Response e Request DTOs
4. Criar service (`.service.ts`) seguindo a receita padrão
5. Adicionar endpoints no `environment.ts` E `environment.development.ts`
6. Adicionar rota em `app.routes.ts` com lazy loading dentro de `pages` (herda authGuard)
7. Adicionar item no menu do navbar (`navbar.html`)
8. Seguir o layout CRUD padrão (header → KPIs → filtros → tabela → ações)
9. Para permissões: usar `authService.temPermissao('ADM_CC')` para esconder elementos
10. Para formulários: usar modal Bootstrap (implementar modal genérico quando disponível)
 