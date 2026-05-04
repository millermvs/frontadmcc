---
paths:
  - "**/*.service.ts"
  - "**/*.interceptor.ts"
  - "**/components/**/*.ts"
  - "**/*.modal.ts"
---

# Tratamento de erros HTTP

<!--
  Carrega quando o Claude mexe em arquivos que fazem ou recebem chamadas HTTP.
  Componentes/modais entram porque é lá que o subscribe.error trata o erro.
-->

## Hierarquia de erros HTTP

| Status | Significado | Ação no Frontend |
|---|---|---|
| **400** | Erro de validação | marcar campos inválidos + mensagens do backend |
| **401** | Não autenticado | logout automático + redirect para `/login` |
| **403** | Sem permissão | toast: "Você não tem permissão para esta ação" |
| **404** | Não encontrado | toast: "Registro não encontrado" |
| **409** | Conflito (duplicidade) | toast/alerta: mensagem do backend (ex: "CPF já cadastrado") |
| **422** | Regra de negócio violada | toast/alerta: mensagem do backend |
| **500** | Erro interno do servidor | toast genérico: "Erro interno. Tente novamente." |
| **0 / Network** | Servidor indisponível | toast: "Servidor indisponível. Verifique sua conexão." |

## Normalização de erros de validação

O Spring Boot serializa erros de campos aninhados com o caminho completo. Ex: erro no campo `cep` dentro de `localPresencial` vem como `"localPresencial.cep": "mensagem"`.

O componente normaliza esse objeto antes de usar as chaves para exibição inline — pegando sempre o último segmento do caminho (`.split('.').pop()`). Assim o template acessa `errosValidacao()['cep']` direto, sem conhecer o nível de aninhamento.

## Formato de erro do backend

**Erros gerais:**
```json
{
  "datetime": "2026-04-07T14:30:00",
  "status": 422,
  "message": "Descrição legível do erro"
}
```

**Erros de validação (400):**
```json
{
  "datetime": "2026-04-07T14:30:00",
  "status": 400,
  "message": "Erro de validação",
  "errors": {
    "campo1": "mensagem do erro",
    "campo2": "mensagem do erro"
  }
}
```

## Interceptor de erros

- **401:** tratado globalmente no `AuthInterceptor` (logout + redirect).
- **Demais erros:** tratados **no componente** que fez a chamada (dentro do `subscribe.error`).
- O componente decide como exibir (toast, inline, modal).

## Regra de ouro

- **Nunca** ignore erros com `.subscribe()` vazio ou `.catch(() => {})`.
- **Nunca** exiba stack trace ou detalhes técnicos para o usuário.
- **Sempre** mensagem legível e acionável ("o que deu errado + o que fazer").
