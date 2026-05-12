import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
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
  OpcaoTangibilidade,
  ProspectRequestDto,
  ReuniaoCCResponseDto,
  TangibilidadeRequestDto,
  ValidarReuniaoRequestDto,
} from '../../../../../models/reuniao-cc.model';

// Validator de grupo: exige ao menos 1 prospect quando nenhumaPossibilidadeProspect = false.
function prospectsValidator(group: AbstractControl): ValidationErrors | null {
  const nenhuma = group.get('nenhumaPossibilidadeProspect')?.value as boolean;
  if (nenhuma) return null;
  const arr = group.get('prospects') as FormArray;
  return arr && arr.length >= 1 ? null : { prospectsObrigatorio: true };
}

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
  // prospects — FormArray dinâmico (0–3 itens); obrigatório >= 1 quando
  //             nenhumaPossibilidadeProspect = false (validator de grupo).
  // tangibilidades — FormArray com 10 grupos fixos (um por OpcaoTangibilidade).
  // =========================================================================

  form = this.fb.group({
    nenhumaPossibilidadeProspect: [false],
    prospects:     this.fb.array([]),
    tangibilidades: this.fb.array([]),
  }, { validators: prospectsValidator });

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
  // GETTERS — acesso tipado aos FormArrays
  // =========================================================================

  get prospectsArray(): FormArray {
    return this.form.get('prospects') as FormArray;
  }

  get tangibilidadesArray(): FormArray {
    return this.form.get('tangibilidades') as FormArray;
  }

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    // Quando nenhumaPossibilidadeProspect muda para true, limpa a lista de prospects
    this.form.get('nenhumaPossibilidadeProspect')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(nenhuma => {
        if (nenhuma) this.prospectsArray.clear();
        this.form.updateValueAndValidity();
      });

    // Inicializa os 10 grupos fixos de tangibilidade
    this.OPCOES_TANGIBILIDADE.forEach(op => {
      const grupo: FormGroup = this.fb.group({
        marcado:       [false],
        opcao:         [op.valor],
        descricaoOutro: [null as string | null],
      });

      // OUTRO: adiciona/remove validators em descricaoOutro conforme checkbox
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
  // PROSPECTS — adicionar / remover
  // =========================================================================

  adicionarProspect(): void {
    if (this.prospectsArray.length >= 3) return;
    this.prospectsArray.push(this.fb.group({
      nomeProspect: ['', Validators.required],
      nomeEmpresa:  ['', [Validators.required, Validators.maxLength(30)]],
    }));
  }

  removerProspect(index: number): void {
    this.prospectsArray.removeAt(index);
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

    // Erro de grupo: nenhumaPossibilidade = false mas sem prospects
    if (this.form.errors?.['prospectsObrigatorio']) {
      this.toastService.erro('Informe ao menos um prospect ou marque "Nenhuma possibilidade".');
      return;
    }

    // Erros de campo (nomeProspect/nomeEmpresa/descricaoOutro)
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const nenhumaPossibilidade = this.form.get('nenhumaPossibilidadeProspect')!.value as boolean;

    const prospectos: ProspectRequestDto[] = nenhumaPossibilidade
      ? []
      : this.prospectsArray.controls.map(g => ({
          nomeProspect: g.get('nomeProspect')!.value as string,
          nomeEmpresa:  g.get('nomeEmpresa')!.value as string,
        }));

    const dto: ValidarReuniaoRequestDto = {
      nenhumaPossibilidadeProspect: nenhumaPossibilidade,
      prospects:     prospectos,
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
