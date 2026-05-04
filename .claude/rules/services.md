---
paths:
  - "**/*.service.ts"
---

# Padrões de services

<!--
  Carrega só quando o Claude mexe em services. Em sessões de UI pura
  (template + CSS), essas regras não pesam no contexto.
-->

## Princípios

- `@Injectable({ providedIn: 'root' })` — singleton global.
- Cada service mapeia **1 domínio** do backend (1 controller = 1 service).
- Métodos retornam `Observable<T>` com tipo explícito.
- URLs vêm do `environment.api.*` — **nunca** hardcoded.
- Service **não** conhece a UI: não manipula DOM, não exibe mensagens, não navega.

## Anatomia de um service

```
1. DECORATOR         → @Injectable({ providedIn: 'root' })
2. INJEÇÕES          → HttpClient via inject()
3. URL BASE          → referência ao environment.api.dominio
4. MÉTODOS CRUD      → listar (paginado), buscarPorId, cadastrar, editar
5. MÉTODOS ESPECIAIS → ações de negócio (alterarStatus, renovar, etc.)
```

## Convenções de métodos

| Ação | Nome do método | HTTP | Retorno |
|---|---|---|---|
| Listar (paginado) | `listar(page, size)` | GET | `Observable<PaginacaoResponseDto<T>>` |
| Buscar por ID | `buscarPorId(id)` | GET | `Observable<ResponseDto>` |
| Cadastrar | `cadastrar(dto)` | POST | `Observable<ResponseDto>` |
| Editar | `editar(id, dto)` | PUT | `Observable<ResponseDto>` |
| Remover | `remover(id)` | DELETE | `Observable<void>` |
| Ação especial | `alterarStatus(id, dto)` | PATCH | `Observable<ResponseDto>` |

## Paginação

Toda listagem usa paginação. O service envia `HttpParams` com `number` (página zero-based) e `size`. A resposta segue a interface genérica:

```typescript
PaginacaoResponseDto<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
```

## Comunicação entre services

- Um service **pode** injetar outro service para compor lógica (ex: `AssociadoService` injeta `EquipeService` para resolver nomes).
- Um service **nunca** acessa o `HttpClient` de outro domínio diretamente — se precisa de dados de outra entidade, chama o service correspondente.
