# Modal de Cadastro de Equipe — Resumo da Implementação

**Data:** 2026-04-09 (revisado)
**Abordagem final:** Bootstrap nativo + `[(ngModel)]` inline na página

---

## O que foi criado?

A modal de cadastro de equipe vive **dentro da própria página** `equipes.html`, seguindo o mesmo padrão já utilizado em outras páginas do projeto.

Nenhum componente separado foi criado para a modal.

---

## Como funciona

### Abrindo a modal

O Bootstrap controla a abertura via atributos HTML — sem nenhum código Angular:

```html
<button
  class="btn-nova-equipe"
  type="button"
  data-bs-toggle="modal"
  data-bs-target="#modalNovaEquipe"
>
  Nova Equipe
</button>
```

Não há `(click)`, não há `signal`, não há lógica TypeScript envolvida na abertura.

### Fechando a modal

O Bootstrap também controla o fechamento — via `data-bs-dismiss`:

```html
<button type="button" class="btn-secondary" data-bs-dismiss="modal">Cancelar</button>
<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
```

Após salvar com sucesso, a modal é fechada programaticamente via Bootstrap API:

```typescript
import { Modal } from 'bootstrap';

// Dentro de salvarNovaEquipe(), após sucesso:
const modalEl = document.getElementById('modalNovaEquipe');
const modal = Modal.getInstance(modalEl!);
modal?.hide();
```

### Preenchendo os campos

Os campos do formulário usam `[(ngModel)]` ligado diretamente ao objeto `novaEquipe` declarado no componente:

```html
<input
  type="text"
  class="form-control"
  [(ngModel)]="novaEquipe.nomeEquipe"
  placeholder="Ex: C+C Zona Leste"
/>

<select class="form-select" [(ngModel)]="novaEquipe.diaReuniao">
  <option value="" disabled>Selecione...</option>
  <option *ngFor="let dia of DIAS_REUNIAO" [value]="dia">{{ dia }}</option>
</select>
```

### Salvando

O botão "Salvar" chama o método do componente passando o objeto preenchido:

```html
<button
  type="button"
  class="btn-primary"
  (click)="salvarNovaEquipe(novaEquipe)"
  [disabled]="carregandoModal()"
>
  @if (carregandoModal()) {
    <span class="spinner-border spinner-border-sm"></span> Salvando...
  } @else {
    Salvar Equipe
  }
</button>
```

---

## O que existe no componente TypeScript

O objeto do formulário e o método de reset:

```typescript
novaEquipe: EquipeRequestDto = this.criarEquipeVazia();

private criarEquipeVazia(): EquipeRequestDto {
  return {
    nomeEquipe: '',
    diaReuniao: '' as any,
    horarioReuniao: '',
    modeloReuniao: '' as any,
    localPresencial: {
      rua: '',
      numero: '',
      complemento: null,
      bairro: '',
      cidade: '',
      uf: '',
      cep: '',
    },
    linkReuniaoOnline: null,
    idDiretorTerritorio: 0,
    idDiretorEquipe: 0,
  };
}
```

Os signals relevantes (sem `modalAberta` — quem controla isso é o Bootstrap):

```typescript
carregandoModal = signal(false);
erroModalEquipe = signal<string | null>(null);
```

O método de salvar:

```typescript
salvarNovaEquipe(request: EquipeRequestDto): void {
  this.carregandoModal.set(true);
  this.erroModalEquipe.set(null);

  this.equipesService.cadastrarEquipe(request).subscribe({
    next: (response) => {
      // Fechar modal via Bootstrap API
      const modalEl = document.getElementById('modalNovaEquipe');
      const modal = Modal.getInstance(modalEl!);
      modal?.hide();

      // Resetar formulário
      this.novaEquipe = this.criarEquipeVazia();

      // Recarregar lista
      this.carregarEquipes();

      // TODO: toast de sucesso
    },
    error: (err) => {
      this.erroModalEquipe.set(this.extrairMensagemErro(err));
      this.carregandoModal.set(false); // liberar botão no erro
    },
    complete: () => {
      this.carregandoModal.set(false);
    },
  });
}
```

**Atenção RxJS:** `complete` NÃO é chamado quando ocorre erro. Por isso o `carregandoModal.set(false)` precisa estar nos dois callbacks (`error` e `complete`).

---

## Por que não foi criado um componente separado?

A primeira tentativa usou um componente `CadastroEquipeModalComponent` com `@Input()` / `@Output()` e signals de visibilidade. Ela foi descartada por duas razões:

1. **Conflito de backdrop**: o componente Angular criava um elemento de overlay que ficava na frente dos campos do formulário, impedindo a interação.
2. **Padrão já existente**: todas as outras páginas do projeto já usam o Bootstrap nativo para modais. Seguir o mesmo padrão é mais simples, consistente e sem dependências extras.

A pasta `src/app/components/shared/cadastro-equipe-modal/` pode ser removida — não é mais utilizada.

---

## Lição aprendida

Antes de criar uma abstração (componente, serviço, signal), pergunte: **o Bootstrap já resolve isso?**

Para modais simples com formulário em uma única página, o padrão Bootstrap (`data-bs-toggle` / `data-bs-dismiss` / `[(ngModel)]`) é suficiente, mais previsível e mais fácil de manter.

---

## Arquivos envolvidos

| Arquivo | Papel |
|---------|-------|
| `components/pages/equipes/equipes.html` | HTML da modal + formulário completo |
| `components/pages/equipes/equipes.ts` | Objeto `novaEquipe`, método `salvarNovaEquipe()`, signal `carregandoModal` |
| `models/equipe.model.ts` | `EquipeRequestDto`, `DiaReuniao`, `ModeloReuniao`, constantes |
| `services/equipe.service.ts` | `cadastrarEquipe(dto): Observable<EquipeResponseDto>` |
