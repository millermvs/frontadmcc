import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ModalService } from '../../../core/modal.service';
import { ToastService } from '../../../services/toast.service';
import { ReuniaosCCService } from '../../../services/reuniao-cc.service';
import { ReuniaoCCResponseDto, StatusReuniao } from '../../../models/reuniao-cc.model';
import { AgendarReuniaoModal } from './modais/agendar-reuniao/agendar-reuniao.modal';
import { DetalheReuniaoModal } from './modais/detalhe-reuniao/detalhe-reuniao.modal';

@Component({
  selector: 'app-reunioes-cc',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reunioes-cc.html',
  styleUrl: './reunioes-cc.css',
})
export class ReuniaoCC implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private reuniaoCCService = inject(ReuniaosCCService);
  private toastService     = inject(ToastService);
  protected modalService   = inject(ModalService);

  // =========================================================================
  // SIGNALS
  // =========================================================================

  reunioes     = signal<ReuniaoCCResponseDto[]>([]);
  carregando   = signal(false);
  paginaAtual  = signal(0);
  totalPaginas = signal(0);
  temProxima   = signal(false);
  temAnterior  = signal(false);

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
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this.carregarReunioes();
  }

  // =========================================================================
  // CARREGAMENTO
  // =========================================================================

  carregarReunioes(): void {
    this.carregando.set(true);

    this.reuniaoCCService.listarMinhas(this.paginaAtual(), 20).subscribe({
      next: (resposta) => {
        this.reunioes.set(resposta.items);
        this.totalPaginas.set(resposta.totalPages);
        this.temProxima.set(resposta.hasNext);
        this.temAnterior.set(resposta.hasPrevious);
        this.carregando.set(false);
      },
      error: (_err: HttpErrorResponse) => {
        this.carregando.set(false);
        this.toastService.erro('Erro ao carregar reuniões. Tente novamente.');
      },
    });
  }

  // =========================================================================
  // MODAIS (implementados nas Tarefas 4 e 5)
  // =========================================================================

  abrirModalAgendamento(): void {
    this.modalService
      .open<ReuniaoCCResponseDto>(AgendarReuniaoModal)
      .subscribe(resultado => {
        if (resultado) {
          this.toastService.sucesso('Reunião agendada com sucesso!');
          this.paginaAtual.set(0);
          this.carregarReunioes();
        }
      });
  }

  abrirModalDetalhe(reuniao: ReuniaoCCResponseDto): void {
    this.modalService
      .open<void, { reuniao: ReuniaoCCResponseDto }>(DetalheReuniaoModal, {
        data: { reuniao },
      })
      .subscribe(() => {
        this.carregarReunioes();
      });
  }

  // =========================================================================
  // PAGINAÇÃO
  // =========================================================================

  irParaPagina(pagina: number): void {
    this.paginaAtual.set(pagina);
    this.carregarReunioes();
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
    const data = new Date(iso);
    return data.toLocaleString('pt-BR', {
      day:    '2-digit',
      month:  '2-digit',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  }

  iniciaisNome(nome: string): string {
    if (!nome) return '?';
    const partes = nome.trim().split(' ').filter(Boolean);
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
  }
}
