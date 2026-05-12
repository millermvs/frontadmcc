import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { ModalService } from '../../../../../core/modal.service';
import { ToastService } from '../../../../../services/toast.service';
import { ReuniaosCCService } from '../../../../../services/reuniao-cc.service';
import {
  ReuniaoCCResponseDto,
  ReuniaoCCReagendamentoResponseDto,
  StatusReuniao,
} from '../../../../../models/reuniao-cc.model';

@Component({
  selector: 'app-detalhe-reuniao-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './detalhe-reuniao.modal.html',
  styleUrl: './detalhe-reuniao.modal.css',
})
export class DetalheReuniaoModal {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private modalService     = inject(ModalService);
  private toastService     = inject(ToastService);
  private reuniaoCCService = inject(ReuniaosCCService);

  // =========================================================================
  // DADOS RECEBIDOS DA PÁGINA
  // =========================================================================

  private readonly _dados = this.modalService.dados<{ reuniao: ReuniaoCCResponseDto }>();

  // =========================================================================
  // SIGNALS
  // =========================================================================

  reuniao    = signal<ReuniaoCCResponseDto | null>(this._dados.reuniao);
  carregando = signal(false);

  // =========================================================================
  // COMPUTED — CONTROLE DE AÇÕES
  // =========================================================================

  podeReagendarOuCancelar = computed(() => {
    const r = this.reuniao();
    if (!r) return false;
    return r.status === 'PENDENTE' || r.status === 'REAGENDADA';
  });

  podeValidar = computed(() => {
    const r = this.reuniao();
    if (!r) return false;
    return (
      !r.jaValidadaPorMim &&
      r.status !== 'CANCELADA' &&
      r.status !== 'CANCELADA_POR_NAO_VALIDACAO'
    );
  });

  diasRestantesParaValidar = computed(() => {
    const r = this.reuniao();
    if (!r) return null;
    const prazo = new Date(new Date(r.criadoEm).getTime() + 21 * 24 * 60 * 60 * 1000);
    return Math.ceil((prazo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  });

  mostrarAlertaPrazo = computed(() => {
    const dias = this.diasRestantesParaValidar();
    const r = this.reuniao();
    if (!r || dias === null) return false;
    return dias <= 7 && dias >= 0 && (r.status === 'PENDENTE' || r.status === 'REAGENDADA');
  });

  reagendamentosOrdenados = computed(() => {
    const r = this.reuniao();
    if (!r) return [];
    return [...r.reagendamentos].sort(
      (a, b) => new Date(b.registradoEm).getTime() - new Date(a.registradoEm).getTime()
    );
  });

  // =========================================================================
  // LABELS MAPEADOS
  // =========================================================================

  readonly LABELS_STATUS: Record<StatusReuniao, string> = {
    PENDENTE:                    'Pendente',
    REAGENDADA:                  'Reagendada',
    REALIZADA:                   'Realizada',
    CANCELADA:                   'Cancelada',
    CANCELADA_POR_NAO_VALIDACAO: 'Cancelada por não validação',
  };

  // =========================================================================
  // MODAIS DE AÇÃO (implementados nas Tarefas 6 e 7)
  // =========================================================================

  abrirModalReagendarCancelar(): void {}

  abrirModalValidar(): void {}

  // =========================================================================
  // FECHAR
  // =========================================================================

  fechar(): void {
    this.modalService.fechar(undefined);
  }

  // =========================================================================
  // HELPERS VISUAIS
  // =========================================================================

  classeChipStatus(status: StatusReuniao): string {
    const mapa: Record<StatusReuniao, string> = {
      PENDENTE:                    'status-chip status-pendente',
      REAGENDADA:                  'status-chip status-reagendada',
      REALIZADA:                   'status-chip status-realizada',
      CANCELADA:                   'status-chip status-cancelada',
      CANCELADA_POR_NAO_VALIDACAO: 'status-chip status-cancelada',
    };
    return mapa[status];
  }

  formatarDataHora(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  labelResultadoReagendamento(r: ReuniaoCCReagendamentoResponseDto): string {
    return r.novaDataHora ? this.formatarDataHora(r.novaDataHora) : 'Cancelamento';
  }

  // =========================================================================
  // RECARREGAR (chamado pelos modais de reagendamento/validação ao fechar)
  // =========================================================================

  recarregarReuniao(): void {
    const r = this.reuniao();
    if (!r) return;
    this.carregando.set(true);
    this.reuniaoCCService.buscarPorId(r.idReuniao).subscribe({
      next: (atualizada) => {
        this.reuniao.set(atualizada);
        this.carregando.set(false);
      },
      error: (_err: HttpErrorResponse) => {
        this.carregando.set(false);
        this.toastService.erro('Erro ao recarregar dados da reunião.');
      },
    });
  }
}
