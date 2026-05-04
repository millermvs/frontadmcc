---
paths:
  - "**/*.spec.ts"
---

# Testes (Karma + Jasmine)

<!--
  Carrega só ao mexer em .spec.ts. Em sessões de implementação pura,
  essas regras não pesam no contexto.
-->

## Obrigatoriedade de prova

Nenhum componente ou service é dado como concluído sem cenários de teste cobrindo no mínimo:

| Cenário | O que testa | Exemplo |
|---|---|---|
| **Renderização** | componente cria sem erros | `expect(component).toBeTruthy()` |
| **Dados carregados** | service é chamado no init e dados exibidos | mock service → verificar template |
| **Interação** | click, submit, filtro funcionam | simular click → verificar resultado |
| **Estado vazio** | comportamento quando não há dados | empty state exibido corretamente |
| **Erro** | comportamento quando o service falha | mock erro HTTP → verificar mensagem |
| **Permissão** | elementos ocultos para roles sem acesso | mock perfil → verificar visibilidade |

## Organização

- **Testes de componente:** verificam renderização, interação e integração com service (mockado).
- **Testes de service:** verificam chamadas HTTP e transformação de dados (`HttpClientTestingModule`).
- Arquivo de teste ao lado do testado: `nome.ts` → `nome.spec.ts`.
- Nomenclatura descritiva: o nome do teste deve dizer o que valida sem precisar ler o código.

## Padrão de teste

```
GIVEN  → estado inicial (mocks configurados, componente renderizado)
WHEN   → ação executada (click, submit, chamada de método)
THEN   → verificação do resultado (template atualizado, service chamado, erro exibido)
```

## O que nunca mockar

- O template do componente (testar com o template real).
- Pipes puros (testar com dados reais).
- Lógica de computed signals (testar o resultado, não o mecanismo).
