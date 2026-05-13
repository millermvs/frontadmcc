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
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, filter, of, switchMap, tap } from 'rxjs';
import { ModalService } from '../../../../../core/modal.service';
import { ToastService } from '../../../../../services/toast.service';
import { AssociadoService } from '../../../../../services/associado.service';
import { ReuniaosCCService } from '../../../../../services/reuniao-cc.service';
import { AssociadoResponseDto } from '../../../../../models/associado.model';
import { ReuniaoCCResponseDto, TipoReuniaoCC } from '../../../../../models/reuniao-cc.model';

function dataFuturaValidator(ctrl: AbstractControl): ValidationErrors | null {
  if (!ctrl.value) return null;
  return new Date(ctrl.value) > new Date() ? null : { dataPassada: true };
}

@Component({
  selector: 'app-agendar-reuniao-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './agendar-reuniao.modal.html',
  styleUrl: './agendar-reuniao.modal.css',
})
export class AgendarReuniaoModal implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private modalService     = inject(ModalService);
  private toastService     = inject(ToastService);
  private reuniaoCCService = inject(ReuniaosCCService);
  private associadoService = inject(AssociadoService);
  private fb               = inject(FormBuilder);
  private destroyRef       = inject(DestroyRef);

  // =========================================================================
  // FORMULÁRIO
  // =========================================================================

  form = this.fb.group({
    idAssociado2: [null as number | null, Validators.required],
    dataHora:     ['', [Validators.required, dataFuturaValidator]],
    tipo:         ['' as TipoReuniaoCC | '', Validators.required],
    local:        [null as string | null],
  });

  // =========================================================================
  // SIGNALS — AUTOCOMPLETE CONVIDADO
  // =========================================================================

  termoBuscaConvidado  = signal('');
  sugestoes            = signal<AssociadoResponseDto[]>([]);
  convidadoSelecionado = signal<AssociadoResponseDto | null>(null);
  buscandoConvidado    = signal(false);
  mostrarSugestoes     = signal(false);

  private _busca$ = new Subject<string>();

  // =========================================================================
  // SIGNALS — ESTADO GERAL
  // =========================================================================

  salvando       = signal(false);
  erroModal      = signal<string | null>(null);
  tipoSelecionado = signal<TipoReuniaoCC | ''>('');

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this._configurarAutocompletConvidado();
    this._configurarCampoLocalCondicional();
  }

  // =========================================================================
  // AUTOCOMPLETE — CONVIDADO
  // =========================================================================

  onBuscaConvidado(valor: string): void {
    this.termoBuscaConvidado.set(valor);
    this.convidadoSelecionado.set(null);
    this.form.patchValue({ idAssociado2: null });

    if (valor.length < 2) {
      this.sugestoes.set([]);
      this.mostrarSugestoes.set(false);
      return;
    }
    this._busca$.next(valor);
  }

  selecionarConvidado(associado: AssociadoResponseDto): void {
    this.convidadoSelecionado.set(associado);
    this.termoBuscaConvidado.set(associado.nomeCompleto);
    this.form.patchValue({ idAssociado2: associado.idAssociado });
    this.sugestoes.set([]);
    this.mostrarSugestoes.set(false);
  }

  limparConvidado(): void {
    this.convidadoSelecionado.set(null);
    this.termoBuscaConvidado.set('');
    this.form.patchValue({ idAssociado2: null });
    this.sugestoes.set([]);
    this.mostrarSugestoes.set(false);
  }

  ocultarSugestoes(): void {
    setTimeout(() => this.mostrarSugestoes.set(false), 150);
  }

  // =========================================================================
  // SUBMIT
  // =========================================================================

  salvar(): void {
    if (this.form.invalid || this.salvando()) return;

    this.salvando.set(true);
    const raw = this.form.getRawValue();

    this.reuniaoCCService
      .agendar({
        idAssociado2: raw.idAssociado2!,
        dataHora:     raw.dataHora + ':00',
        tipo:         raw.tipo as TipoReuniaoCC,
        local:        raw.local ?? null,
      })
      .subscribe({
        next: (reuniao: ReuniaoCCResponseDto) => {
          this.salvando.set(false);
          this.modalService.fechar(reuniao);
        },
        error: (err: HttpErrorResponse) => {
          this.salvando.set(false);
          if (err.status === 422) {
            this.toastService.erro(err.error?.message ?? 'Operação não permitida.');
          } else {
            this._mostrarErroNaModal(
              this.erroModal,
              err.status === 0
                ? 'Servidor indisponível. Verifique sua conexão.'
                : 'Erro ao agendar reunião. Tente novamente.'
            );
          }
        },
      });
  }

  // =========================================================================
  // FECHAR
  // =========================================================================

  fechar(): void {
    if (this.salvando()) return;
    this.modalService.fechar(undefined);
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  get minDataHora(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  mascararCpf(cpf: string): string {
    const d = cpf.replace(/\D/g, '');
    if (d.length !== 11) return '***.***.***-**';
    return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  }

  private _mostrarErroNaModal(sinal: WritableSignal<string | null>, mensagem: string): void {
    sinal.set(mensagem);
    setTimeout(() => sinal.set(null), 3000);
  }

  // =========================================================================
  // PRIVADOS — configuração reativa
  // =========================================================================

  private _configurarAutocompletConvidado(): void {
    this._busca$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(termo => termo.length >= 2),
      tap(() => this.buscandoConvidado.set(true)),
      switchMap(termo =>
        this.associadoService
          .listarAssociados(0, 8, { nome: termo, status: 'ATIVO' })
          .pipe(catchError(() => of(null)))
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(resposta => {
      this.buscandoConvidado.set(false);
      if (resposta) {
        this.sugestoes.set(resposta.items);
        this.mostrarSugestoes.set(resposta.items.length > 0);
      }
    });
  }

  private _configurarCampoLocalCondicional(): void {
    this.form.get('tipo')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tipo => {
        this.tipoSelecionado.set((tipo as TipoReuniaoCC | '') ?? '');
        const localCtrl = this.form.get('local')!;

        if (tipo === 'PRESENCIAL') {
          localCtrl.addValidators(Validators.required);
        } else {
          localCtrl.clearValidators();
          localCtrl.setValue(null);
        }
        localCtrl.updateValueAndValidity();
      });
  }
}
