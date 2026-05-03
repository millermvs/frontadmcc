/**
 * MODAL.SERVICE.TS
 *
 * Singleton responsável por abrir, montar e destruir componentes de modal
 * dinamicamente no DOM — sem nenhuma tag de modal no template da página.
 *
 * Fluxo:
 *   1. Página chama open(ComponenteModal, { data })
 *   2. Service cria o componente via createComponent() e o monta no document.body
 *   3. Modal exibe o formulário; ao confirmar, chama modalService.fechar(resultado)
 *   4. Service destrói o componente e emite o resultado no Observable retornado
 *   5. Página recebe o resultado no subscribe e atualiza o estado
 *
 * Passagem de dados:
 *   - A página passa dados via open(Componente, { data: { ... } })
 *   - O modal acessa os dados via this.modalService.dados<TipoDosDados>()
 *   - Não usa @Input() — o acoplamento é pelo service, não pelo template
 *
 * Por que createComponent() em vez de declarar no template?
 *   Um template com 5 modais facilmente passa de 500 linhas, a maioria
 *   irrelevante para quem edita a listagem. Com o ModalService, o HTML da
 *   página tem apenas filtros + tabela. Ver CLAUDE.md SEÇÃO 4.5.
 */
import {
  ApplicationRef,
  ComponentRef,
  EnvironmentInjector,
  Injectable,
  Type,
  createComponent,
  inject,
} from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ModalService {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private appRef    = inject(ApplicationRef);
  private envInject = inject(EnvironmentInjector);

  // =========================================================================
  // ESTADO INTERNO
  //
  // _dados      — valor opaco passado via open(); o modal recupera via dados<T>()
  // _resultado$ — Subject que emite quando o modal fecha
  // _componentRef — referência para destruição
  // _hostEl     — div adicionada ao body; removida ao fechar
  // =========================================================================

  private _dados:        unknown                    = null;
  private _resultado$:   Subject<unknown>           = new Subject();
  private _componentRef: ComponentRef<unknown> | null = null;
  private _hostEl:       HTMLElement | null         = null;

  // =========================================================================
  // ABERTURA
  // =========================================================================

  /**
   * open<TResult, TData>(component, options?)
   *
   * Cria o componente dinamicamente e o monta no document.body.
   * Retorna Observable que emite o resultado quando o modal fecha.
   *
   * TResult — tipo do valor retornado pelo modal ao fechar
   * TData   — tipo do objeto `data` passado nas options
   *
   * Exemplo de uso na página:
   *   this.modalService.open<ConexaoGeradaResponseDto>(NovaConexaoModal)
   *     .subscribe(resultado => { if (resultado) this.carregarGeradas(); });
   */
  open<TResult, TData = undefined>(
    component: Type<unknown>,
    options?: { data?: TData }
  ): Observable<TResult | undefined> {
    // Garante que não há modal aberto simultaneamente
    if (this._componentRef) {
      this._limpar();
    }

    this._dados = options?.data ?? null;

    const resultado$ = new Subject<TResult | undefined>();
    this._resultado$ = resultado$ as Subject<unknown>;

    // Cria o elemento host e monta no body
    this._hostEl = document.createElement('div');
    document.body.appendChild(this._hostEl);
    document.body.classList.add('modal-open');

    // Cria o componente Angular dinamicamente (Angular 17+)
    this._componentRef = createComponent(component, {
      environmentInjector: this.envInject,
      hostElement: this._hostEl,
    });

    this.appRef.attachView(this._componentRef.hostView);
    this._componentRef.changeDetectorRef.detectChanges();

    return resultado$.asObservable();
  }

  // =========================================================================
  // ACESSO AOS DADOS
  // =========================================================================

  /**
   * dados<T>()
   *
   * Retorna o objeto `data` passado no open(), com cast para o tipo T.
   * Chamado pelo componente modal para acessar os dados de entrada.
   *
   * Exemplo no modal:
   *   const info = this.modalService.dados<MinhaInterface>();
   *   // info.campo é tipado corretamente
   */
  dados<T>(): T {
    return this._dados as T;
  }

  // =========================================================================
  // FECHAMENTO
  // =========================================================================

  /**
   * fechar(resultado?)
   *
   * Emite o resultado no Observable, destrói o componente e limpa o DOM.
   * Chamado pelo componente modal quando o usuário confirma ou cancela.
   *
   * Se resultado for undefined (cancel), o subscriber na página pode
   * checar: `if (resultado) { ... }` para executar apenas em sucesso.
   */
  fechar<TResult>(resultado?: TResult): void {
    (this._resultado$ as Subject<TResult | undefined>).next(resultado);
    this._resultado$.complete();
    this._limpar();
  }

  // =========================================================================
  // PRIVADO
  // =========================================================================

  private _limpar(): void {
    if (this._componentRef) {
      this.appRef.detachView(this._componentRef.hostView);
      this._componentRef.destroy();
      this._componentRef = null;
    }
    if (this._hostEl?.parentNode) {
      this._hostEl.parentNode.removeChild(this._hostEl);
      this._hostEl = null;
    }
    document.body.classList.remove('modal-open');
    this._dados = null;
  }
}
