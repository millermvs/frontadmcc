import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ModalService } from '../../../core/modal.service';
import { ParceriaResponseDto } from '../../../models/parceria.model';
import { ParceriaService } from '../../../services/parceria.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-parcerias',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './parcerias.html',
  styleUrl: './parcerias.css',
})
export class Parcerias implements OnInit {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private parceriaService = inject(ParceriaService);
  private toastService    = inject(ToastService);
  private modalService    = inject(ModalService);

  // =========================================================================
  // SIGNALS — LISTA E PAGINAÇÃO
  // =========================================================================

  parcerias      = signal<ParceriaResponseDto[]>([]);
  carregando     = signal(false);
  paginaAtual    = signal(0);
  totalItens     = signal(0);
  totalPaginas   = signal(0);
  temProxima     = signal(false);
  temAnterior    = signal(false);

  // =========================================================================
  // SIGNALS — FILTRO
  // =========================================================================

  termoBusca = signal('');

  // =========================================================================
  // COMPUTED — LISTA FILTRADA (client-side na página carregada)
  // =========================================================================

  parceirasFiltradas = computed(() => {
    const termo = this.termoBusca().toLowerCase().trim();
    if (!termo) return this.parcerias();
    return this.parcerias().filter(p =>
      p.nomeRemetente.toLowerCase().includes(termo) ||
      p.nomeDestinatario.toLowerCase().includes(termo)
    );
  });

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this.carregar();
  }

  // =========================================================================
  // CARREGAMENTO E PAGINAÇÃO
  // =========================================================================

  carregar(pagina: number = 0): void {
    this.carregando.set(true);

    this.parceriaService.listarMinhas(pagina).subscribe({
      next: (resposta) => {
        this.parcerias.set(resposta.items);
        this.paginaAtual.set(resposta.page);
        this.totalItens.set(resposta.totalItems);
        this.totalPaginas.set(resposta.totalPages);
        this.temProxima.set(resposta.hasNext);
        this.temAnterior.set(resposta.hasPrevious);
        this.carregando.set(false);
      },
      error: (_err: HttpErrorResponse) => {
        this.carregando.set(false);
        this.toastService.erro('Erro ao carregar parcerias. Tente novamente.');
      },
    });
  }

  proximaPagina(): void {
    if (this.temProxima()) this.carregar(this.paginaAtual() + 1);
  }

  paginaAnterior(): void {
    if (this.temAnterior()) this.carregar(this.paginaAtual() - 1);
  }

  // =========================================================================
  // FILTRO
  // =========================================================================

  atualizarBusca(valor: string): void {
    this.termoBusca.set(valor);
  }

  // =========================================================================
  // MODAL
  // =========================================================================

  abrirModalRegistrar(): void {
    import('./modais/nova-parceria/nova-parceria.modal').then(({ NovaParceriaModal }) => {
      this.modalService
        .open<ParceriaResponseDto>(NovaParceriaModal)
        .subscribe(resultado => {
          if (resultado) {
            this.toastService.sucesso('Parceria registrada com sucesso!');
            this.carregar(0);
          }
        });
    });
  }

  // =========================================================================
  // HELPERS VISUAIS
  // =========================================================================

  iniciaisNome(nome: string): string {
    if (!nome) return '?';
    const partes = nome.trim().split(' ').filter(Boolean);
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
  }

  formatarData(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  formatarMesCompetencia(iso: string): string {
    if (!iso) return '—';
    // T12:00:00 evita deslocamento de fuso horário (UTC → America/Sao_Paulo)
    return new Date(iso + 'T12:00:00').toLocaleString('pt-BR', {
      month: 'long', year: 'numeric',
    });
  }
}
