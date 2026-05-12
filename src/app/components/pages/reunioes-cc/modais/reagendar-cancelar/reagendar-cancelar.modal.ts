import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  Component,
  DestroyRef,
  OnInit,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModalService } from '../../../../../core/modal.service';
import { ToastService } from '../../../../../services/toast.service';
import { ReuniaosCCService } from '../../../../../services/reuniao-cc.service';
import {
  MotivoReagendamento,
  ReagendarCancelarRequestDto,
  ReuniaoCCResponseDto,
} from '../../../../../models/reuniao-cc.model';

function dataFuturaValidator(ctrl: AbstractControl): ValidationErrors | null {
  if (!ctrl.value) return null;
  return new Date(ctrl.value) > new Date() ? null : { dataPassada: true };
}

@Component({
  selector: 'app-reagendar-cancelar-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reagendar-cancelar.modal.html',
  styleUrl: './reagendar-cancelar.modal.css',
})
export class ReagendarCancelarModal implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private modalService     = inject(ModalService);
  private toastService     = inject(ToastService);
  private reuniaoCCService = inject(ReuniaosCCService);
  private fb               = inject(FormBuilder);
  private destroyRef       = inject(DestroyRef);

  // =========================================================================
  // DADOS RECEBIDOS DO MODAL DE DETALHE
  // =========================================================================

  private readonly _dados = this.modalService.dados<{ reuniao: ReuniaoCCResponseDto }>();
  readonly reuniao = this._dados.reuniao;

  // =========================================================================
  // FORMULÁRIO
  //
  // Começa configurado para REAGENDAR (novaDataHora com validators).
  // mudarIntencao() adiciona/remove os validators de novaDataHora conforme toggle.
  // =========================================================================

  form = this.fb.group({
    motivo:       ['' as MotivoReagendamento | '', Validators.required],
    motivoTexto:  [null as string | null],
    novaDataHora: ['', [Validators.required, dataFuturaValidator]],
  });

  // =========================================================================
  // SIGNALS
  // =========================================================================

  intencao          = signal<'REAGENDAR' | 'CANCELAR'>('REAGENDAR');
  salvando          = signal(false);
  erroModal         = signal<string | null>(null);
  motivoSelecionado = signal<string>('');

  // =========================================================================
  // OPÇÕES DO SELECT DE MOTIVO
  // =========================================================================

  readonly OPCOES_MOTIVO: { valor: MotivoReagendamento; label: string }[] = [
    { valor: 'COMPROMISSO_PROFISSIONAL_INADIAVEL', label: 'Compromisso profissional inadiável' },
    { valor: 'IMPREVISTO_PESSOAL_FAMILIAR',        label: 'Imprevisto pessoal ou familiar' },
    { valor: 'PROBLEMA_DE_SAUDE',                  label: 'Problema de saúde' },
    { valor: 'DIFICULDADE_LOGISTICA',              label: 'Dificuldade logística' },
    { valor: 'CONFLITO_DE_AGENDA',                 label: 'Conflito de agenda' },
    { valor: 'REAGENDAMENTO_ALINHADO',             label: 'Reagendamento alinhado entre os participantes' },
    { valor: 'OUTRO',                              label: 'Outro' },
  ];

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this.form.get('motivo')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(motivo => {
        this.motivoSelecionado.set(motivo ?? '');
        const motivoTextoCtrl = this.form.get('motivoTexto')!;
        if (motivo === 'OUTRO') {
          motivoTextoCtrl.addValidators(Validators.required);
        } else {
          motivoTextoCtrl.clearValidators();
          motivoTextoCtrl.setValue(null);
        }
        motivoTextoCtrl.updateValueAndValidity();
      });
  }

  // =========================================================================
  // TOGGLE REAGENDAR / CANCELAR
  // =========================================================================

  mudarIntencao(intencao: 'REAGENDAR' | 'CANCELAR'): void {
    this.intencao.set(intencao);
    const novaDataHoraCtrl = this.form.get('novaDataHora')!;

    if (intencao === 'REAGENDAR') {
      novaDataHoraCtrl.addValidators([Validators.required, dataFuturaValidator]);
    } else {
      novaDataHoraCtrl.clearValidators();
      novaDataHoraCtrl.setValue(null);
    }
    novaDataHoraCtrl.updateValueAndValidity();
  }

  // =========================================================================
  // SUBMIT
  // =========================================================================

  salvar(): void {
    if (this.form.invalid || this.salvando()) return;

    // Validação de antecedência mínima de 4 horas em relação à dataHora da reunião
    const diffHoras = (new Date(this.reuniao.dataHora).getTime() - Date.now()) / (1000 * 60 * 60);
    if (diffHoras < 4) {
      this.toastService.erro(
        'O reagendamento ou cancelamento deve ser solicitado com no mínimo 4 horas de antecedência.'
      );
      return;
    }

    this.salvando.set(true);
    const raw = this.form.getRawValue();

    const dto: ReagendarCancelarRequestDto = {
      motivo:       raw.motivo as MotivoReagendamento,
      motivoTexto:  raw.motivoTexto ?? null,
      novaDataHora: this.intencao() === 'REAGENDAR' && raw.novaDataHora
        ? raw.novaDataHora + ':00'
        : null,
    };

    this.reuniaoCCService.reagendarOuCancelar(this.reuniao.idReuniao, dto).subscribe({
      next: () => {
        this.salvando.set(false);
        this.modalService.fechar(true);
      },
      error: (err: HttpErrorResponse) => {
        this.salvando.set(false);
        if (err.status === 422) {
          this.toastService.erro(err.error?.mensagem ?? 'Operação não permitida.');
        } else {
          this._mostrarErroNaModal(
            this.erroModal,
            err.status === 0
              ? 'Servidor indisponível. Verifique sua conexão.'
              : 'Erro ao processar. Tente novamente.'
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

  get minNovaDataHora(): string {
    const min = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${min.getFullYear()}-${pad(min.getMonth() + 1)}-${pad(min.getDate())}T${pad(min.getHours())}:${pad(min.getMinutes())}`;
  }

  formatarDataHora(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  private _mostrarErroNaModal(sinal: WritableSignal<string | null>, mensagem: string): void {
    sinal.set(mensagem);
    setTimeout(() => sinal.set(null), 3000);
  }
}
