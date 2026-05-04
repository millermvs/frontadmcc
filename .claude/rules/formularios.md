---
paths:
  - "**/*.modal.ts"
  - "**/*.modal.html"
  - "**/components/**/*.ts"
  - "**/components/**/*.html"
---

# Formulários e validação

<!--
  Carrega em componentes e modais. Validação tem regras específicas
  (especialmente o padrão de erro em modal) que mudam quando você
  está tocando esses arquivos.
-->

## Estratégia de formulários

| Complexidade | Abordagem | Quando usar |
|---|---|---|
| Simples (até 5 campos) | `FormsModule` + `[(ngModel)]` | login, filtros, busca rápida |
| Médio/Complexo (6+ campos) | `ReactiveFormsModule` + `FormBuilder` | cadastro, edição, modais com validação |

## Validação em camadas

| Nível | Responsável | O que valida | Exemplo |
|---|---|---|---|
| Formato (Frontend) | Template + Validators | obrigatórios, tamanho, formato, regex | campo vazio, CPF com 11 dígitos, email válido |
| Negócio (Backend) | API (resposta 400/409/422) | regras que dependem do estado do sistema | CPF já cadastrado, limite excedido |

**Regra:** o frontend **nunca** confia apenas na sua validação. O backend é a autoridade final. Mas o frontend valida para feedback imediato (UX).

## Formulários em modal

- Formulários **sempre** em modal (nunca página separada para criação/edição).
- Modal simples: Bootstrap modal padrão.
- Modal complexo: abas internas + scroll dentro do modal.
- **Sucesso:** fechar modal + toast de sucesso + recarregar lista.
- **Falha:** exibir erro **dentro** do modal (não fechar).

### Edição: NÃO marcar dirty manualmente

`patchValue()` não marca o formulário como dirty — e isso é o **comportamento desejado**. Em modais de edição, **NÃO** chamar `form.markAsDirty()` após `patchValue()`. O modal abre com "Salvar Alterações" desabilitado; só habilita quando o usuário modificar ao menos um campo. O Angular rastreia automaticamente via `form.dirty`.

```
[disabled]="!form.dirty || form.invalid || carregando()"
```

Chamar `markAsDirty()` manualmente derruba essa proteção.

### Padrão obrigatório de erro em modais

Todo modal tem um `signal<string | null>` dedicado para erro (ex: `erroModalXxx = signal<string | null>(null)`).

**Template:** o alerta vai **sempre no `modal-footer`**, antes dos botões, com `flex-fill`:

```html
<div class="modal-footer">
  @if (erroModalXxx()) {
    <div class="alert alert-danger d-flex align-items-center gap-2 mb-0 flex-fill" role="alert">
      <i class="bi bi-exclamation-triangle-fill flex-shrink-0" aria-hidden="true"></i>
      <span>{{ erroModalXxx() }}</span>
    </div>
  }
  <!-- botões aqui -->
</div>
```

**Componente:** NUNCA chamar `signal.set('mensagem')` direto. Usar sempre o método genérico `mostrarErroNaModal()`, que define o sinal e agenda auto-dismiss em 3s:

```typescript
private mostrarErroNaModal(sinal: WritableSignal<string | null>, mensagem: string): void {
  sinal.set(mensagem);
  setTimeout(() => sinal.set(null), 3000);
}
```

Uso: `this.mostrarErroNaModal(this.erroModalXxx, 'mensagem')`.

**Exceção — erros de carregamento inicial:** quando o modal falha ao carregar dados (antes do form aparecer), o erro substitui o spinner no body do modal e **não** usa auto-dismiss nem vai ao footer — usuário precisa ver até fechar manualmente.

## Feedback ao usuário

| Ação | Feedback |
|---|---|
| Salvamento com sucesso | toast verde + fechar modal + recarregar lista |
| Erro de validação (400) | marcar campos com erro + mensagem abaixo |
| Erro de negócio (409/422) | toast ou alerta no modal com mensagem do backend |
| Erro de servidor (500) | toast vermelho genérico: "Erro interno. Tente novamente." |
| Carregando | botão desabilitado + spinner/texto "Salvando..." |
