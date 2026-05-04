---
paths:
  - "**/app.routes.ts"
  - "**/auth/**/*.ts"
  - "**/*.guard.ts"
  - "**/*.interceptor.ts"
---

# Roteamento e autenticação

<!--
  Carrega quando o Claude mexe em rotas, auth, guards ou interceptors.
  Tem a distinção crítica role vs perfil que precisa estar SEMPRE
  presente nesses arquivos.
-->

## Estrutura de rotas

```
/login                       → pública (sem guard, sem layout principal)
/pages                       → protegida por authGuard (layout com navbar)
  /pages/dashboard           → lazy loaded
  /pages/equipes             → lazy loaded
  /pages/associados          → lazy loaded
  /pages/clusters            → lazy loaded
  /pages/cargos-lideranca    → lazy loaded
/                            → redirect → /pages/dashboard
/**                          → redirect → /pages/dashboard (wildcard)
```

## Regras de roteamento

| Regra | Detalhe |
|---|---|
| Lazy loading | toda página via `loadComponent: () => import(...)` |
| Guards | rotas dentro de `/pages` herdam `authGuard` do pai |
| Controle ADM | rotas ADM-only protegidas por visibilidade na navbar (`@if (isAdm())`) + `@PreAuthorize` no backend. `roleGuard` em `core/auth/auth.guard.ts` aplicado quando necessário |
| Redirect | rota raiz e wildcard → `/pages/dashboard` |
| Login | `/login` **fora** de `/pages` (sem navbar, sem guard) |

## Convenção de nomes

| Elemento | Convenção | Exemplo |
|---|---|---|
| Path | kebab-case | `/pages/equipes`, `/pages/perfil-cc` |
| Parâmetros | camelCase | `:idEquipe`, `:idAssociado` |
| Query params | camelCase | `?page=0&size=10` |

---

## Fluxo de autenticação

```
1. Usuário preenche email + senha em /login
2. AuthService.login() → POST /api/v1/auth/login
3. Backend valida → retorna { token, nome, email, role, perfil, idAssociado }
4. Frontend armazena token + dados no localStorage
5. Signal do AuthService atualiza → toda UI reage
6. Interceptor injeta "Authorization: Bearer <token>" em toda requisição
7. Backend retorna 401 → interceptor chama logout() → redirect /login
```

## Distinção crítica: `role` vs `perfil`

| Campo | Valor exemplo | Dono | Uso |
|---|---|---|---|
| `role` | `'ROLE_ADM'`, `'ROLE_ASSOCIADO'` | Spring Security | **Apenas** mecanismo de autorização do backend |
| `perfil` | `'ADM_CC'`, `'DIRETOR'`, `'ASSOCIADO'` | Lógica de negócio | **Único campo** que o frontend deve usar para decisões de UI |

`AuthService` expõe dois computeds: `role` (mantido para não quebrar legado) e `perfil` (fonte de verdade). O método `temPermissao(...perfis)` verifica `perfil`, não `role`.

> **Atenção:** usar `role` para controle de UI resulta em comportamento incorreto.

## Controle de acesso visual

| Nível | Mecanismo | Exemplo |
|---|---|---|
| Rota | guard (authGuard, roleGuard) | bloqueia `/pages` sem login |
| Elemento | `@if (authService.temPermissao('ADM_CC'))` | esconde botão "Excluir" para não-ADM |
| Campo | lógica no template | esconde "Anuidade" para Diretor |

**Regra:** elementos sem permissão são **escondidos** (não desabilitados). Usuário não deve ver o que não pode usar.

## Segurança de dados

- Token JWT **apenas** no `localStorage` com chave prefixada (`admcc_token`).
- **Proibido:** token em cookie acessível por JS, em sessionStorage, ou variável global.
- **Proibido:** dados sensíveis (senhas, CPFs) em logs do console.
- **Proibido:** stack traces ou detalhes de erro do backend em produção.

## Analogias Backend ↔ Frontend (mental model)

| Backend (Spring Security) | Frontend (Angular + signals) |
|---|---|
| `AuthService.autenticar()` | `AuthService.login()` |
| `TokenService.gerarToken()` | Frontend NÃO gera — apenas armazena |
| `TokenService.validarToken()` | `AuthService.isAutenticado()` (existe token?) |
| `SecurityFilter` | `authInterceptor` (functional interceptor) |
| `SecurityContextHolder` | `localStorage` + `signal<UsuarioLogado>` |
| `@PreAuthorize("hasRole(...)")` | `temPermissao(...perfis)` (UI apenas) |
| `SecurityContextHolder.clearContext()` | `AuthService.logout()` |

**Direcionalidade do token:** o `SecurityFilter` RECEBE o token no header e valida. O `authInterceptor` faz o oposto: PEGA do localStorage e COLOCA no header. Um é porteiro que verifica quem entra; o outro é a carteirinha que se apresenta.

**Stateless:** backend não mantém sessão; o JWT carrega a identidade. Por isso `logout()` não chama endpoint — basta apagar o token local.

**Imutabilidade do HttpRequest:** no interceptor, requisições são imutáveis (como records em Java). Para adicionar header, clonar com `req.clone({ setHeaders: { ... } })`.

**Reatividade via signal:** o `signal<UsuarioLogado | null>` substitui o `SecurityContextHolder`. Quando muda, qualquer `@if (authService.isAutenticado())` re-renderiza automaticamente.

**Permissão no frontend é ESTÉTICA, não segurança:** `temPermissao()` decide o que MOSTRAR; o backend ainda valida cada endpoint com `@PreAuthorize`. Se o frontend esquecer de esconder um botão, o backend responde 403 — não há vazamento de autorização.
