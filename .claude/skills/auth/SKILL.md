---
name: auth
description: Tocar em autenticacao, sessao ou controle de acesso — `AuthService`, `authInterceptor`, `authGuard`, signals de usuario logado, esconder/mostrar elementos por perfil, ler token, tratar 401. Triggers — login/logout, proteger rota, esconder botao ADM-only, customizar request com Authorization, receber 401 em endpoint.
---

# Skill: auth

Receita operacional para trabalhar em autenticacao, sessao e controle
de acesso. Para as regras, **CLAUDE.md Secao 10** (Autenticacao e Seguranca).
Especialmente a subsecao **10.5 (Analogias Backend ↔ Frontend)** — foi
concentrada la para os arquivos de `core/auth/` ficarem enxutos.

Arquivos em jogo:

```
src/app/core/auth/
  auth.service.ts      -> login, logout, signals de sessao, temPermissao
  auth.interceptor.ts  -> injeta Bearer token, trata 401 global
  auth.guard.ts        -> protege rotas
  auth.model.ts        -> LoginRequest, LoginResponse, UsuarioLogado
```

---

## Quando usar

- Implementar tela de login.
- Proteger rota nova com guard.
- Esconder/mostrar elemento conforme perfil do usuario.
- Adicionar cabecalho / tratar resposta customizada no interceptor.
- Diagnosticar "sessao expirou" ou comportamento inesperado em 401.

## Quando NAO usar

- Validar permissao de dados no backend: responsabilidade dele via `@PreAuthorize`. Frontend so esconde UI.
- Guardar token em cookie ou sessionStorage: so localStorage com prefixo `admcc_` (CLAUDE.md 10.3).

---

## Conceitos obrigatorios (antes de codar)

### role vs perfil — NAO CONFUNDIR

| Campo  | Valores                           | Uso                                    |
|--------|-----------------------------------|----------------------------------------|
| role   | `ROLE_ADM`, `ROLE_ASSOCIADO`      | Apenas Spring Security backend         |
| perfil | `ADM_CC`, `DIRETOR`, `ASSOCIADO`  | **Fonte de verdade para decisoes UI**  |

O `AuthService` expoe `role()` apenas por compatibilidade. Na UI, usar
SEMPRE `perfil()` ou `temPermissao(...)`. Escrever `@if (role() === 'ROLE_ADM')`
e bug latente.

### Stateless

O backend nao guarda sessao. Logout so apaga o token local — nao chama
endpoint. Token expira em 8h (configurado no `TokenService` do backend).
Ver CLAUDE.md 10.5.

### Signal > BehaviorSubject

Estado de sessao e exposto como `signal<UsuarioLogado | null>`. Componentes
consomem via `authService.usuario()` / `isAutenticado()` / `perfil()` — Angular
rerrenderiza automaticamente quando muda.

---

## Receitas

### R1. Consumir o usuario logado em um componente

```
private authService = inject(AuthService);

// No template:
@if (authService.isAutenticado()) {
  <span>Ola, {{ authService.usuario()\!.nome }}</span>
}
```

### R2. Esconder elemento para nao-ADM

```
@if (authService.temPermissao('ADM_CC')) {
  <button>Inativar associado</button>
}
```

Passar multiplos perfis permite OR:

```
@if (authService.temPermissao('ADM_CC', 'DIRETOR')) { ... }
```

### R3. Proteger rota com guard

No `app.routes.ts`:

```
{
  path: 'pages',
  canActivate: [authGuard],
  children: [ ... ]
}
```

Rotas dentro de `/pages` herdam o guard. A rota `/login` fica **fora** desse grupo.

### R4. Executar acao apos login

Componente de login:

```
this.authService.login(credenciais).subscribe({
  next: () => this.router.navigate(['/pages/dashboard']),
  error: (err) => this.tratarErroLogin(err),
});
```

O service ja atualiza o signal internamente via `tap()`. O componente so decide para onde navegar.

### R5. Forcar logout programatico

```
this.authService.logout();
// ja limpa storage, zera signal e redireciona para /login
```

### R6. Adicionar header customizado ao interceptor

O interceptor atual so injeta `Authorization`. Se precisar adicionar outro header (ex: `X-Client-Version`), clonar com ambos no mesmo `setHeaders`:

```
const reqComToken = token
  ? req.clone({ setHeaders: {
      Authorization: `Bearer ${token}`,
      'X-Client-Version': environment.version,
    }})
  : req.clone({ setHeaders: { 'X-Client-Version': environment.version } });
```

Lembrar: HttpRequest e imutavel. Sempre `req.clone(...)`, nunca mutar.

### R7. Tratar 401 em endpoint especifico

Nao tratar — o interceptor global ja faz logout + redirect em qualquer 401.
Tratar manualmente 401 em componente e antipadrao (duplica comportamento).

Se o endpoint PRECISA retornar 401 sem deslogar (caso raro), pensar em mudar o
status no backend para outro codigo (ex: 422 para regra de negocio).

### R8. Endpoint publico (sem token)

O interceptor so adiciona `Authorization` quando tem token no storage. Em
fluxo de login, como ainda nao tem token, o POST /auth/login sai sem header —
funciona naturalmente.

Se precisar de um endpoint autenticado por outro mecanismo (ex: webhook), e
uma excecao — avaliar um interceptor condicional via `HttpContext`.

---

## Checklist

- [ ] Decisoes de UI usam `perfil()` ou `temPermissao(...)`, nunca `role()`
- [ ] Nenhum componente le `localStorage` diretamente — tudo via `AuthService`
- [ ] Rotas protegidas tem guard (em si mesmas ou via grupo pai)
- [ ] Elementos ADM-only estao **escondidos** (nao desabilitados) para outros perfis
- [ ] Token so no `localStorage` com chave prefixada (`admcc_`)
- [ ] Zero log de CPF / senha / token no `console`
- [ ] Interceptor clona request com `req.clone(...)` — nunca muta
- [ ] 401 e tratado globalmente, nao replicado em cada componente
- [ ] Logout nao chama backend (JWT e stateless)

---

## Erros comuns

- **Usar `role` para decidir o que mostrar**: vai falhar porque `role` e `ROLE_ADM` / `ROLE_ASSOCIADO` enquanto a UI espera `ADM_CC` / `DIRETOR` / `ASSOCIADO`. Usar `perfil`.
- **Chamar `logout()` em cada subscribe com erro 401**: o interceptor ja faz. Duplicar produz navegacao dupla / loops.
- **Tentar mutar `req.headers`**: HttpRequest e imutavel. Clonar via `req.clone({ setHeaders: {...} })`.
- **Guardar senha ou CPF em storage**: **NUNCA**. Apenas token + dados minimos de exibicao (`UsuarioLogado`).
- **`@if (user.role === 'ROLE_ADM')` no template**: antipadrao do projeto. Use `authService.temPermissao('ADM_CC')`.
- **Deixar botao ADM visivel para outros perfis confiando no backend**: o backend bloqueia (403) — mas a UX fica ruim. Esconder no template.
- **Verificar autenticacao chamando backend para "validar token"**: desnecessario. Basta `isAutenticado()`. Se token expirou, a primeira chamada HTTP retorna 401 e o interceptor desloga.
- **Chamar endpoint `/auth/logout` no backend**: nao existe, e stateless. `logout()` e local.
