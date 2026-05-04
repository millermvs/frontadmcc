# Arquitetura de camadas

<!--
  Sem `paths:` → carrega em toda sessão. É mapa mental de uso constante.
  Mantido enxuto: árvore de pastas + dois fluxos. Detalhes vivem nas rules específicas.
-->

## Estrutura de pastas

```
src/
├── app/
│   ├── core/                          ← Singletons (auth, interceptors, guards, modal.service)
│   │   ├── auth/                      ← Auth completa (service, guard, interceptor)
│   │   ├── interceptors/
│   │   ├── guards/
│   │   └── modal.service.ts
│   ├── components/
│   │   ├── pages/                     ← 1 pasta por rota
│   │   │   └── nome-pagina/
│   │   │       ├── nome-pagina.ts
│   │   │       ├── nome-pagina.html   ← zero tags de modal
│   │   │       ├── nome-pagina.css
│   │   │       ├── nome-pagina.spec.ts
│   │   │       └── modais/            ← modais exclusivos da página
│   │   └── shared/                    ← reutilizáveis (navbar, modal, toast)
│   ├── models/                        ← interfaces (DTOs)
│   ├── services/                      ← 1 service por domínio
│   ├── helpers/                       ← funções puras
│   ├── pipes/
│   ├── enums/
│   ├── app.ts / app.html / app.css    ← root layout
│   ├── app.config.ts                  ← providers (router, http, interceptor)
│   └── app.routes.ts                  ← rotas (lazy loading + guards)
├── environments/
│   ├── environment.ts                 ← produção
│   └── environment.development.ts     ← dev (localhost)
├── styles.css                         ← globais (reset, tipografia, variáveis CSS)
├── index.html
└── main.ts
```

## Fluxo de dados (pipeline de interação)

```
[Usuário]
  → Componente (captura: click, submit, input)
    → Service (envia request HTTP com DTO tipado)
      → [Backend API]
    ← Service (Observable<ResponseDto>)
  ← Componente (atualiza signal, re-renderiza template)
[Usuário]
```

**Regra de ouro:** dados nunca pulam camadas. Componente **jamais** acessa API direto. Service **jamais** manipula DOM/template.

## Fluxo de estado

| Tipo | Mecanismo | Exemplo |
|---|---|---|
| Local do componente | `signal()` / `computed()` | filtros, flags de loading, form data |
| Service (HTTP) | `Observable<T>` | dados do backend |
| Auth global | `signal()` no AuthService | usuário logado, perfil, token |
| Rota | `ActivatedRoute` / params | parâmetros da URL |
| Persistente | `localStorage` | token JWT, dados do usuário |

**Proibido:** "mega-service" que armazena tudo. Cada service cuida do **seu** domínio.
