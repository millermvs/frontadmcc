import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
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
  OpcaoTangibilidade,
  ReuniaoCCResponseDto,
  TangibilidadeRequestDto,
  ValidarReuniaoRequestDto,
} from '../../../../../models/reuniao-cc.model';

@Component({
  selector: 'app-validar-reuniao-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './validar-reuniao.modal.html',
  styleUrl: './validar-reuniao.modal.css',
})
export class ValidarReuniaoModal implements OnInit {

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
  // tangibilidades é um FormArray com 10 grupos fixos (um por OpcaoTangibilidade).
  // Cada grupo tem: marcado (boolean), opcao (string fixo), descricaoOutro (condicional).
  // O grupo OUTRO ganha validators em descricaoOutro quando marcado é true.
  // =========================================================================

  form = this.fb.group({
    nenhumaPossibilidadeProspect: [false],
    tangibilidades: this.fb.array([]),
  });

  // =========================================================================
  // SIGNALS
  // =========================================================================

  salvando  = signal(false);
  erroModal = signal<string | null>(null);

  // =========================================================================
  // OPÇÕES DE TANGIBILIDADE
  // =========================================================================

  readonly OPCOES_TANGIBILIDADE: { valor: OpcaoTangibilidade; label: string }[] = [
    { valor: 'CONEXAO_GERADA',             label: 'Gerou uma conexão de negócio' },
    { valor: 'PARCERIA_FIRMADA',           label: 'Firmou uma parceria' },
    { valor: 'APRESENTACAO_REALIZADA',     label: 'Realizou uma apresentação' },
    { valor: 'PROPOSTA_ENVIADA',           label: 'Enviou proposta comercial' },
    { valor: 'CONTRATO_ASSINADO',          label: 'Assinou contrato' },
    { valor: 'REUNIAO_AGENDADA',           label: 'Agendou nova reunião' },
    { valor: 'INDICACAO_RECEBIDA',         label: 'Recebeu indicação' },
    { valor: 'INDICACAO_FEITA',            label: 'Fez uma indicação' },
    { valor: 'CONHECIMENTO_COMPARTILHADO', label: 'Compartilhou conhecimento' },
    { valor: 'OUTRO',                      label: 'Outro' },
  ];

  // =========================================================================
  // GETTER — acesso tipado ao FormArray
  // =========================================================================

  get tangibilidadesArray(): FormArray {
    return this.form.get('tangibilidades') as FormArray;
  }

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this.OPCOES_TANGIBILIDADE.forEach(op => {
      const grupo: FormGroup = this.fb.group({
        marcado:       [false],
        opcao:         [op.valor],
        descricaoOutro: [null as string | null],
      });

      // Quando OUTRO é marcado, adiciona validators em descricaoOutro
      if (op.valor === 'OUTRO') {
        grupo.get('marcado')!.valueChanges
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(marcado => {
            const descCtrl = grupo.get('descricaoOutro')!;
            if (marcado) {
              descCtrl.addValidators([Validators.required, Validators.maxLength(150)]);
            } else {
              descCtrl.clearValidators();
              descCtrl.setValue(null);
            }
            descCtrl.updateValueAndValidity();
          });
      }

      this.tangibilidadesArray.push(grupo);
    });
  }

  // =========================================================================
  // SUBMIT
  // =========================================================================

  salvar(): void {
    if (this.salvando()) return;

    const selecionadas: TangibilidadeRequestDto[] = this.tangibilidadesArray.controls
      .filter(g => g.get('marcado')!.value === true)
      .map(g => ({
        opcao:         g.get('opcao')!.value as OpcaoTangibilidade,
        descricaoOutro: (g.get('descricaoOutro')!.value as string | null) ?? null,
      }));

    if (selecionadas.length === 0) {
      this.toastService.erro('Selecione ao menos uma tangibilidade.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const dto: ValidarReuniaoRequestDto = {
      nenhumaPossibilidadeProspect: this.form.get('nenhumaPossibilidadeProspect')!.value as boolean,
      prospects:     [],
      tangibilidades: selecionadas,
    };

    this.salvando.set(true);
    this.reuniaoCCService.validar(this.reuniao.idReuniao, dto).subscribe({
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
