import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  OnInit,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { ModalService } from '../../../../../core/modal.service';
import { AssociadoResponseDto } from '../../../../../models/associado.model';
import { ParceriaResponseDto } from '../../../../../models/parceria.model';
import { AssociadoService } from '../../../../../services/associado.service';
import { ParceriaService } from '../../../../../services/parceria.service';

@Component({
  selector: 'app-nova-parceria-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './nova-parceria.modal.html',
  styleUrl: './nova-parceria.modal.css',
})
export class NovaParceriaModal implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private modalService    = inject(ModalService);
  private parceriaService = inject(ParceriaService);
  private associadoService = inject(AssociadoService);
  private fb              = inject(FormBuilder);
  private destroyRef      = inject(DestroyRef);

  // =========================================================================
  // FORMULÁRIO
  //
  // Um único campo: idDestinatario (number).
  // O campo de texto visível (termoBuscaParceiro) é um signal separado —
  // o usuário digita para buscar, mas o valor enviado ao backend é o ID.
  // =========================================================================

  form = this.fb.group({
    idDestinatario: [null as number | null, Validators.required],
  });

  // =========================================================================
  // SIGNALS — AUTOCOMPLETE
  // =========================================================================

  termoBuscaParceiro  = signal('');
  sugestoes           = signal<AssociadoResponseDto[]>([]);
  parceiroSelecionado = signal<AssociadoResponseDto | null>(null);
  buscandoParceiro    = signal(false);
  mostrarSugestoes    = signal(false);

  // Subject interno que alimenta o pipe de autocomplete.
  // switchMap cancela a busca anterior a cada nova digitação.
  private _busca$ = new Subject<string>();

  // =========================================================================
  // SIGNALS — ESTADO GERAL
  // =========================================================================

  carregando = signal(false);
  erroModal  = signal<string | null>(null);

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this._busca$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(termo => termo.length >= 2),
      tap(() => this.buscandoParceiro.set(true)),
      switchMap(termo =>
        this.associadoService
          .listarAssociados(0, 8, { nome: termo, status: 'ATIVO' })
          .pipe(catchError(() => of(null)))
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(resposta => {
      this.buscandoParceiro.set(false);
      if (resposta) {
        this.sugestoes.set(resposta.items);
        this.mostrarSugestoes.set(resposta.items.length > 0);
      }
    });
  }

  // =========================================================================
  // AUTOCOMPLETE
  // =========================================================================

  onBuscaParceiro(valor: string): void {
    this.termoBuscaParceiro.set(valor);
    this.parceiroSelecionado.set(null);
    this.form.patchValue({ idDestinatario: null });

    if (valor.length < 2) {
      this.sugestoes.set([]);
      this.mostrarSugestoes.set(false);
      return;
    }

    this._busca$.next(valor);
  }

  selecionarParceiro(associado: AssociadoResponseDto): void {
    this.parceiroSelecionado.set(associado);
    this.termoBuscaParceiro.set(associado.nomeCompleto);
    this.form.patchValue({ idDestinatario: associado.idAssociado });
    this.sugestoes.set([]);
    this.mostrarSugestoes.set(false);
  }

  limparParceiro(): void {
    this.parceiroSelecionado.set(null);
    this.termoBuscaParceiro.set('');
    this.form.patchValue({ idDestinatario: null });
    this.sugestoes.set([]);
    this.mostrarSugestoes.set(false);
  }

  // Aguarda 150ms antes de ocultar para que o click na sugestão registre
  // antes do blur fechar a lista (mousedown dispara antes do blur).
  ocultarSugestoes(): void {
    setTimeout(() => this.mostrarSugestoes.set(false), 150);
  }

  // =========================================================================
  // SUBMIT
  // =========================================================================

  salvar(): void {
    if (this.form.invalid || this.carregando()) return;

    this.carregando.set(true);
    const { idDestinatario } = this.form.getRawValue();

    this.parceriaService
      .registrar({ idDestinatario: idDestinatario! })
      .subscribe({
        next: (novaParceria: ParceriaResponseDto) => {
          this.carregando.set(false);
          this.modalService.fechar(novaParceria);
        },
        error: (err: HttpErrorResponse) => {
          this.carregando.set(false);
          const mensagem =
            err.status === 422
              ? err.error?.message                                    // mensagem literal do backend — display-safe (seção 8.3 do guia)
              : err.status === 404
                ? 'Associado não encontrado. Verifique a seleção.'
                : err.status === 0
                  ? 'Servidor indisponível. Verifique sua conexão.'
                  : 'Erro ao registrar parceria. Tente novamente.';
          this._mostrarErroNaModal(this.erroModal, mensagem);
        },
      });
  }

  // =========================================================================
  // FECHAR
  // =========================================================================

  fechar(): void {
    if (this.carregando()) return;
    this.modalService.fechar(undefined);
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private _mostrarErroNaModal(sinal: WritableSignal<string | null>, mensagem: string): void {
    sinal.set(mensagem);
    setTimeout(() => sinal.set(null), 3000);
  }
}
