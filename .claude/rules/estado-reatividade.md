---
paths:
  - "**/*.ts"
---

# Estado e reatividade

<!--
  Carrega em qualquer .ts. É amplo de propósito: signals e observables
  aparecem em components, services e auth. Mantido curto pra não pesar.
-->

## Hierarquia de estado

| Nível | Mecanismo | Ciclo de vida | Exemplo |
|---|---|---|---|
| Local do componente | `signal()` / `computed()` | enquanto o componente existe | filtros, flags de loading, form data |
| Service (HTTP) | `Observable<T>` via HttpClient | durante a subscription | dados do backend |
| Auth global | `signal()` no AuthService | enquanto o app roda | usuário logado, token, perfil |
| Persistente | `localStorage` | sobrevive reload | token JWT, dados do usuário |

## Regras de signal

- `signal()` para estado mutável: muda com interação do usuário.
- `computed()` para estado derivado: calculado a partir de outros signals.
- **Proibido:** `computed()` com efeitos colaterais (HTTP, console.log, navegação).
- **Proibido:** signals em excesso — se pode ser derivado, use `computed()`.

## Regras de Observable

- Toda subscription gerenciada (unsubscribe no destroy, ou `takeUntilDestroyed`).
- **`valueChanges` em formulários:** sempre com `takeUntilDestroyed(this.destroyRef)`. `DestroyRef` injetado via `inject(DestroyRef)`. Sem isso, a subscription vaza após o componente ser destruído (Observable infinito).
- Preferir `async` pipe no template quando possível (gerencia subscription automaticamente).
- **Proibido:** `.subscribe()` aninhado (callback hell). Usar operadores RxJS (`switchMap`, `mergeMap`, `forkJoin`).

## LocalStorage

- **Apenas** para dados que precisam sobreviver a um reload (token, preferências).
- Chaves com prefixo do projeto: `admcc_token`, `admcc_usuario`.
- **Proibido:** estado de UI, dados de form em andamento, dados sensíveis além do token.
