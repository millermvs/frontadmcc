import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnInit,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ModalService } from '../../../../../core/modal.service';
import { EquipeResponseDto } from '../../../../../models/equipe.model';
import { VisitanteExternoResponseDto } from '../../../../../models/visitante-externo.model';
import { EquipeService } from '../../../../../services/equipe.service';
import { VisitanteExternoService } from '../../../../../services/visitante-externo.service';

function cpfValidator(ctrl: AbstractControl): ValidationErrors | null {
  if (!ctrl.value) return null;
  const digitos = (ctrl.value as string).replace(/\D/g, '');
  return digitos.length === 11 ? null : { cpfInvalido: true };
}

@Component({
  selector: 'app-registrar-visitante-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registrar-visitante.modal.html',
  styleUrl: './registrar-visitante.modal.css',
})
export class RegistrarVisitanteModal implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private modalService            = inject(ModalService);
  private visitanteExternoService = inject(VisitanteExternoService);
  private equipeService           = inject(EquipeService);
  private fb                      = inject(FormBuilder);

  // =========================================================================
  // FORMULÁRIO
  // =========================================================================

  form = this.fb.group({
    nomeCompleto: ['', [Validators.required, Validators.maxLength(100)]],
    cpf:          ['', [Validators.required, cpfValidator]],
    empresa:      ['', [Validators.maxLength(100)]],
    telefone:     ['', [Validators.required]],
    dataReuniao:  ['', [Validators.required]],
    idEquipe:     [null as number | null, [Validators.required]],
  });

  // =========================================================================
  // SIGNALS
  // =========================================================================

  equipes    = signal<EquipeResponseDto[]>([]);
  salvando   = signal(false);
  erroModal  = signal<string | null>(null);

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this.equipeService.listarEquipes(0, 100).subscribe({
      next: (resposta) => this.equipes.set(resposta.items),
      error: () => this._mostrarErroNaModal(this.erroModal, 'Erro ao carregar equipes.'),
    });
  }

  // =========================================================================
  // MÁSCARAS — formatação visual (strip no submit)
  // =========================================================================

  aplicarMascaraCpf(valor: string): void {
    const mascarado = this._mascaraCpf(valor);
    this.form.get('cpf')!.setValue(mascarado, { emitEvent: true });
  }

  aplicarMascaraTelefone(valor: string): void {
    const mascarado = this._mascaraTelefone(valor);
    this.form.get('telefone')!.setValue(mascarado, { emitEvent: true });
  }

  // =========================================================================
  // SUBMIT
  // =========================================================================

  salvar(): void {
    if (this.form.invalid || this.salvando()) return;

    this.salvando.set(true);
    const raw = this.form.getRawValue();

    const dto = {
      nomeCompleto: raw.nomeCompleto!.trim(),
      cpf:          raw.cpf!.replace(/\D/g, ''),
      empresa:      raw.empresa?.trim() || null,
      telefone:     raw.telefone!.replace(/\D/g, ''),
      dataReuniao:  raw.dataReuniao!,
      idEquipe:     raw.idEquipe!,
    };

    this.visitanteExternoService.registrar(dto).subscribe({
      next: (visitante: VisitanteExternoResponseDto) => {
        this.salvando.set(false);
        this.modalService.fechar(visitante);
      },
      error: (err: HttpErrorResponse) => {
        this.salvando.set(false);
        if (err.status === 422) {
          this._mostrarErroNaModal(
            this.erroModal,
            err.error?.mensagem ?? 'Operação não permitida.'
          );
        } else if (err.status === 404) {
          this._mostrarErroNaModal(this.erroModal, 'Equipe não encontrada.');
        } else {
          this._mostrarErroNaModal(
            this.erroModal,
            err.status === 0
              ? 'Servidor indisponível. Verifique sua conexão.'
              : 'Erro ao registrar visitante. Tente novamente.'
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
  // PRIVADOS
  // =========================================================================

  private _mostrarErroNaModal(sinal: WritableSignal<string | null>, mensagem: string): void {
    sinal.set(mensagem);
    setTimeout(() => sinal.set(null), 3000);
  }

  private _mascaraCpf(valor: string): string {
    const d = valor.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  private _mascaraTelefone(valor: string): string {
    const d = valor.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
}
