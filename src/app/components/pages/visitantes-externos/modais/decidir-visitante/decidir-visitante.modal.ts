import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { ModalService } from '../../../../../core/modal.service';
import { ToastService } from '../../../../../services/toast.service';
import { VisitanteExternoResponseDto } from '../../../../../models/visitante-externo.model';
import { VisitanteExternoService } from '../../../../../services/visitante-externo.service';

@Component({
  selector: 'app-decidir-visitante-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './decidir-visitante.modal.html',
  styleUrl: './decidir-visitante.modal.css',
})
export class DecidirVisitanteModal {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private modalService            = inject(ModalService);
  private toastService            = inject(ToastService);
  private visitanteExternoService = inject(VisitanteExternoService);

  // =========================================================================
  // DADOS RECEBIDOS DA PÁGINA
  // =========================================================================

  readonly visitante = this.modalService.dados<{
    visitante: VisitanteExternoResponseDto;
    tipo: 'validar' | 'recusar';
  }>().visitante;

  readonly tipo = this.modalService.dados<{
    visitante: VisitanteExternoResponseDto;
    tipo: 'validar' | 'recusar';
  }>().tipo;

  // =========================================================================
  // SIGNALS — ESTADO
  // =========================================================================

  executando = signal(false);
  erroModal  = signal<string | null>(null);

  // =========================================================================
  // COMPUTED — COPY DINÂMICO
  // =========================================================================

  get titulo(): string {
    return this.tipo === 'validar' ? 'Validar Visitante' : 'Recusar Visitante';
  }

  get labelBotao(): string {
    return this.tipo === 'validar' ? 'Confirmar Validação' : 'Confirmar Recusa';
  }

  get labelExecutando(): string {
    return this.tipo === 'validar' ? 'Validando…' : 'Recusando…';
  }

  get iconeAcao(): string {
    return this.tipo === 'validar' ? 'bi-check-circle-fill' : 'bi-x-circle-fill';
  }

  // =========================================================================
  // AÇÃO
  // =========================================================================

  confirmar(): void {
    if (this.executando()) return;

    this.executando.set(true);

    const acao$ =
      this.tipo === 'validar'
        ? this.visitanteExternoService.validar(this.visitante.idVisitanteExterno)
        : this.visitanteExternoService.recusar(this.visitante.idVisitanteExterno);

    acao$.subscribe({
      next: (atualizado: VisitanteExternoResponseDto) => {
        this.executando.set(false);
        this.modalService.fechar(atualizado);
      },
      error: (err: HttpErrorResponse) => {
        this.executando.set(false);
        if (err.status === 422) {
          const msg: string = err.error?.mensagem ?? 'Operação não permitida.';
          this.toastService.erro(msg);
        } else {
          this._mostrarErroNaModal(
            this.erroModal,
            err.status === 0
              ? 'Servidor indisponível. Verifique sua conexão.'
              : 'Erro ao processar visitante. Tente novamente.'
          );
        }
      },
    });
  }

  // =========================================================================
  // FECHAR
  // =========================================================================

  fechar(): void {
    if (this.executando()) return;
    this.modalService.fechar(undefined);
  }

  // =========================================================================
  // PRIVADOS
  // =========================================================================

  private _mostrarErroNaModal(sinal: WritableSignal<string | null>, mensagem: string): void {
    sinal.set(mensagem);
    setTimeout(() => sinal.set(null), 3000);
  }
}
