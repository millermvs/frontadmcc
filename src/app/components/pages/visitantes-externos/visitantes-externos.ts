import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { ModalService } from '../../../core/modal.service';
import {
  LABELS_STATUS_VISITANTE,
  StatusVisitante,
  VisitanteExternoResponseDto,
} from '../../../models/visitante-externo.model';
import { EquipeResponseDto } from '../../../models/equipe.model';
import { EquipeService } from '../../../services/equipe.service';
import { VisitanteExternoService } from '../../../services/visitante-externo.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-visitantes-externos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './visitantes-externos.html',
  styleUrl: './visitantes-externos.css',
})
export class VisitantesExternos implements OnInit {

  // =========================================================================
  // INJEÃ‡Ã•ES
  // =========================================================================

  protected authService             = inject(AuthService);
  private visitanteExternoService   = inject(VisitanteExternoService);
  private equipeService             = inject(EquipeService);
  private toastService              = inject(ToastService);
  private modalService              = inject(ModalService);

  // =========================================================================
  // SIGNALS â€” EQUIPES (dropdown de filtro)
  // =========================================================================

  equipes             = signal<EquipeResponseDto[]>([]);
  equipeSelecionadaId = signal<number | null>(null);

  // =========================================================================
  // SIGNALS â€” LISTA E PAGINAÃ‡ÃƒO
  // =========================================================================

  visitantes    = signal<VisitanteExternoResponseDto[]>([]);
  carregando    = signal(false);
  paginaAtual   = signal(0);
  totalItens    = signal(0);
  totalPaginas  = signal(0);
  temProxima    = signal(false);
  temAnterior   = signal(false);

  // =========================================================================
  // COMPUTED â€” PERMISSÃƒO
  // =========================================================================

  podeDecidirVisitante = computed(() =>
    this.authService.temPermissao('ADM_CC', 'DIRETOR')
  );

  // =========================================================================
  // CONSTANTE â€” LABELS DE STATUS (acessÃ­vel no template)
  // =========================================================================

  readonly labelsStatus = LABELS_STATUS_VISITANTE;

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  ngOnInit(): void {
    this.carregarEquipes();
  }

  // =========================================================================
  // CARREGAMENTO
  // =========================================================================

  private carregarEquipes(): void {
    this.equipeService.listarEquipes(0, 100).subscribe({
      next: (resposta) => this.equipes.set(resposta.items),
      error: () => this.toastService.erro('Erro ao carregar equipes.'),
    });
  }

  carregarVisitantes(pagina: number = 0): void {
    const idEquipe = this.equipeSelecionadaId();
    if (idEquipe === null) return;

    this.carregando.set(true);

    this.visitanteExternoService.listarPorEquipe(idEquipe, pagina).subscribe({
      next: (resposta) => {
        this.visitantes.set(resposta.items);
        this.paginaAtual.set(resposta.page);
        this.totalItens.set(resposta.totalItems);
        this.totalPaginas.set(resposta.totalPages);
        this.temProxima.set(resposta.hasNext);
        this.temAnterior.set(resposta.hasPrevious);
        this.carregando.set(false);
      },
      error: (_err: HttpErrorResponse) => {
        this.carregando.set(false);
        this.toastService.erro('Erro ao carregar visitantes. Tente novamente.');
      },
    });
  }

  // =========================================================================
  // SELEÃ‡ÃƒO DE EQUIPE
  // =========================================================================

  selecionarEquipe(idEquipe: string): void {
    const id = idEquipe ? Number(idEquipe) : null;
    this.equipeSelecionadaId.set(id);
    this.visitantes.set([]);
    if (id !== null) this.carregarVisitantes(0);
  }

  // =========================================================================
  // PAGINAÃ‡ÃƒO
  // =========================================================================

  proximaPagina(): void {
    if (this.temProxima()) this.carregarVisitantes(this.paginaAtual() + 1);
  }

  paginaAnterior(): void {
    if (this.temAnterior()) this.carregarVisitantes(this.paginaAtual() - 1);
  }

  // =========================================================================
  // MODAIS
  // =========================================================================

  abrirModalRegistrar(): void {
    import('./modais/registrar-visitante/registrar-visitante.modal').then(
      ({ RegistrarVisitanteModal }) => {
        this.modalService
          .open<VisitanteExternoResponseDto>(RegistrarVisitanteModal)
          .subscribe((resultado) => {
            if (resultado) {
              this.toastService.sucesso('Visitante registrado com sucesso!');
              if (this.equipeSelecionadaId() !== null) {
                this.carregarVisitantes(0);
              }
            }
          });
      }
    );
  }

  abrirModalDecidir(
    visitante: VisitanteExternoResponseDto,
    tipo: 'validar' | 'recusar'
  ): void {
    import('./modais/decidir-visitante/decidir-visitante.modal').then(
      ({ DecidirVisitanteModal }) => {
        this.modalService
          .open<VisitanteExternoResponseDto, { visitante: VisitanteExternoResponseDto; tipo: 'validar' | 'recusar' }>(
            DecidirVisitanteModal,
            { data: { visitante, tipo } }
          )
          .subscribe((resultado) => {
            if (resultado) {
              const mensagem =
                tipo === 'validar'
                  ? 'Visitante validado com sucesso!'
                  : 'Visitante recusado.';
              this.toastService.sucesso(mensagem);
              this.carregarVisitantes(this.paginaAtual());
            }
          });
      }
    );
  }

  // =========================================================================
  // HELPERS VISUAIS
  // =========================================================================

  classeStatus(status: StatusVisitante): string {
    const classes: Record<StatusVisitante, string> = {
      AGUARDANDO_VALIDACAO: 'status-chip status-formacao',
      VALIDADO:             'status-chip status-ativa',
      NAO_VALIDADO:         'status-chip status-inativa',
    };
    return classes[status] ?? 'status-chip';
  }

  formatarData(iso: string): string {
    if (!iso) return 'â€”';
    return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }
}
