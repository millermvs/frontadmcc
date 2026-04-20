---
name: services
description: Criar ou ajustar service Angular (`*.service.ts`) que consome endpoints REST do backend. Triggers — adicionar chamada HTTP a um novo endpoint, criar service para novo dominio, implementar listagem paginada, PATCH/PUT/POST tipados.
---

# Skill: services

Receita operacional para criar `src/app/services/{dominio}.service.ts`.
Para as regras, consulte **CLAUDE.md Secao 5 (Padroes de Services)**.
Esta skill descreve sequencia de passos, convencoes e erros comuns.

---

## Quando usar

- Novo dominio no backend precisa ser consumido pelo frontend.
- Endpoint novo em dominio ja existente (ex: `PATCH /.../alterar-status`).
- Refatorar service que tem estilo antigo (constructor injection, URLs hardcoded, sem tipagem explicita).

## Quando NAO usar

- O que voce precisa ja existe em outro service — injete o service existente em vez de duplicar a chamada HTTP.
- Logica e de UI (toast, navegacao, manipulacao de DOM). Isso vive no componente, nao no service.

---

## Passo a passo

### 1. Confirmar modelos e environment

Antes de criar o service:

1. O `{dominio}.model.ts` ja existe com `RequestDto` e `ResponseDto`? (Se nao, rode a skill `models` primeiro.)
2. O bloco `environment.api.{dominio}` ja tem todas as URLs necessarias? Se nao, adicione em **ambos** `environment.ts` e `environment.development.ts` (CLAUDE.md 15.3).

### 2. Esqueleto do arquivo

```
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  {Dominio}ResponseDto,
  {Dominio}RequestDto,
} from '../models/{dominio}.model';
import { PaginacaoResponseDto } from '../models/paginacao.model';

@Injectable({ providedIn: 'root' })
export class {Dominio}Service {

  private http = inject(HttpClient);
  private api  = environment.api.{dominio};

  // metodos...
}
```

Pontos-chave:

- `@Injectable({ providedIn: 'root' })` — singleton global.
- `inject()` **sempre** — nunca constructor injection (CLAUDE.md Secao 4.2).
- URLs via `environment.api.{dominio}` — nunca hardcoded.
- `PaginacaoResponseDto` vem de `paginacao.model.ts`, nao do model de dominio.

### 3. Assinaturas padrao (CLAUDE.md 5.3)

| Acao             | Metodo                        | HTTP   | Retorno                                          |
|------------------|-------------------------------|--------|--------------------------------------------------|
| Listar paginado  | `listar(page, size)`          | GET    | `Observable<PaginacaoResponseDto<ResponseDto>>`  |
| Buscar por ID    | `buscarPorId(id)`             | GET    | `Observable<ResponseDto>`                        |
| Cadastrar        | `cadastrar(dto)`              | POST   | `Observable<ResponseDto>`                        |
| Editar           | `editar(id, dto)`             | PUT    | `Observable<ResponseDto>`                        |
| Remover          | `remover(id)`                 | DELETE | `Observable<void>`                               |
| Acao especial    | verbo descritivo              | PATCH  | `Observable<ResponseDto>` (ou especifico)        |

### 4. Paginacao — contrato unico

Request e response usam o mesmo nome `page` (zero-based). Veja `equipe.service.ts` como referencia.

```
listar(page: number = 0, size: number = 10):
    Observable<PaginacaoResponseDto<{Dominio}ResponseDto>> {

  const params = new HttpParams()
    .set('page', page.toString())
    .set('size', size.toString());

  return this.http.get<PaginacaoResponseDto<{Dominio}ResponseDto>>(
    this.api.listar, { params }
  );
}
```

Nunca mandar `number` como nome do query param — o backend le `page` (Spring Data). Comentarios no JSDoc devem refletir `?page=0&size=10`.

### 5. Endpoints aninhados / dinamicos

Quando o environment expoe funcoes dinamicas (`editar(id)`, `porAssociado(idAssociado)`), consuma-as diretamente — nao concatene strings no service.

### 6. Composicao entre services

Se precisar resolver nomes de outros dominios (ex: em associado precisa do nome da equipe), **injete** o service do outro dominio via `inject()` — nao chame `HttpClient` de outro endpoint diretamente. Isso mantem o principio de 1 service = 1 dominio.

### 7. Erros e efeitos colaterais

- O service **nao** exibe toast, **nao** navega, **nao** toca DOM.
- Erros sao tratados no componente que chamou `.subscribe()`.
- Excecao: 401 tratado globalmente no `authInterceptor` (logout + redirect — CLAUDE.md 10.1).

---

## Checklist

- [ ] Arquivo em `src/app/services/{dominio}.service.ts`
- [ ] `@Injectable({ providedIn: 'root' })`
- [ ] `inject(HttpClient)` — sem constructor
- [ ] URLs exclusivamente de `environment.api.{dominio}`
- [ ] Metodos com nomes padronizados (`listar`, `buscarPorId`, `cadastrar`, `editar`, acoes descritivas)
- [ ] Paginacao usa `'page'` e `'size'` como params
- [ ] `PaginacaoResponseDto` importado de `paginacao.model.ts`
- [ ] Retorno tipado em todos os metodos (nenhum `Observable<any>`)
- [ ] Environment atualizado em **dev + prod**
- [ ] Zero logica de UI, zero navegacao, zero toast

---

## Erros comuns

- **Constructor injection em service novo**: usar `inject()` (CLAUDE.md 4.2).
- **Hardcode de URL**: viola CLAUDE.md 5.1. Toda URL vem do environment.
- **Query param `'number'`**: vira bug silencioso porque o backend le `'page'` — ja corrigido em todo o codigo, nao reintroduzir.
- **Service fazendo toast ou redirect**: responsabilidade do componente (CLAUDE.md 2.1).
- **Service A chamando URL do dominio B**: injete o service B em vez disso.
- **Atualizar so um environment**: quebra producao silenciosamente (CLAUDE.md 15.3).
